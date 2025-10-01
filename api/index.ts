import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';

dotenv.config();

console.log('[DIAGNOSTIC] Environment variables loaded');
console.log('[DIAGNOSTIC] SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('[DIAGNOSTIC] SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('[DIAGNOSTIC] GOOGLE_CLOUD_VISION_API_KEY exists:', !!process.env.GOOGLE_CLOUD_VISION_API_KEY);
console.log('[DIAGNOSTIC] GOOGLE_CLOUD_PROJECT_ID exists:', !!process.env.GOOGLE_CLOUD_PROJECT_ID);

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleApiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY!;

const app = new Elysia()
  .use(cors())
  .get('/', () => ({ status: 'ok' }))
  .put('/api/profile', async ({ body, set }) => {
    const { userId, reading_preferences } = body as { userId: string, reading_preferences: string[] };
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('profiles')
        .update({ reading_preferences })
        .eq('id', userId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Profile not found');
      return { success: true, profile: data[0] };
    } catch (err) {
      set.status = 500;
      return { error: (err as Error).message };
    }
  })
  .post('/content/url', async ({ body, set }) => {
    const { url, userId } = body as { url: string, userId: string };
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract title
      let title = $('h1').first().text().trim() || 
                  $('article h1').first().text().trim() ||
                  $('title').text().trim() ||
                  'Untitled';
      
      // Extract metadata
      const category = $('.category, .post-category, [class*="category"]').first().text().trim();
      const readingTime = $('[class*="reading-time"], .reading-time, .entry-meta').text().match(/(\d+\s*minute)/i)?.[0] || '';
      
      // Remove unwanted elements first
      $('script, style, nav, header, footer, aside, .navigation, .menu, .sidebar, .ad, .advertisement, .social-share, .comments, .related-posts, form, button, input, .newsletter, [class*="newsletter"], [class*="subscribe"]').remove();
      
      // Find article content with multiple strategies
      let $content = $('article .entry-content').first();
      if ($content.length === 0) $content = $('.entry-content').first();
      if ($content.length === 0) $content = $('article').first();
      if ($content.length === 0) $content = $('main').first();
      if ($content.length === 0) $content = $('.post-content, .article-content').first();
      
      // If still nothing, try to find the largest content container
      if ($content.length === 0) {
        $content = $('body');
      }
      
      // Remove h1 from content (we already have title)
      $content.find('h1').remove();
      
      // Extract paragraphs and headings
      const paragraphs: string[] = [];
      
      // Try direct children first, then all descendants
      let elements = $content.find('p, blockquote, h2, h3, h4');
      
      elements.each((_, elem) => {
        const $elem = $(elem);
        const text = $elem.text().trim();
        
        // Skip navigation, footer, header content
        const parentClasses = $elem.parentsUntil($content).map((_, p) => $(p).attr('class') || '').get().join(' ');
        if (parentClasses.match(/(nav|footer|header|menu|sidebar)/i)) return;
        
        if (text && text.length > 10) {
          const tagName = $elem.prop('tagName')?.toLowerCase();
          if (tagName === 'blockquote') {
            paragraphs.push(`> ${text}`);
          } else if (['h2', 'h3', 'h4'].includes(tagName || '')) {
            paragraphs.push(`## ${text}`);
          } else if (tagName === 'p') {
            paragraphs.push(text);
          }
        }
      });
      
      console.log(`[SCRAPER DEBUG] Found ${paragraphs.length} paragraphs`);
      console.log(`[SCRAPER DEBUG] Title: ${title}`);
      console.log(`[SCRAPER DEBUG] First 3 paragraphs:`, paragraphs.slice(0, 3));
      
      // Build structured content
      const metadata = {
        title,
        category: category || null,
        readingTime: readingTime || null,
        url
      };
      
      const structuredContent = {
        metadata,
        paragraphs
      };

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'url',
        source_info: url,
        processed_text: JSON.stringify(structuredContent)
      }).select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No data returned');
      return { success: true, contentId: data[0].id };
    } catch (err) {
      set.status = 500;
      return { error: (err as Error).message };
    }
  })
  .post('/content/upload', async ({ body, set }) => {
    const { filePath, userId } = body as { filePath: string, userId: string };
    try {
      console.log('[DIAGNOSTIC] /content/upload endpoint hit');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);

      console.log('[DIAGNOSTIC] About to lazy-load @google-cloud/vision');
      const vision = await import('@google-cloud/vision');
      console.log('[DIAGNOSTIC] Vision library loaded, creating client');
      console.log('[DIAGNOSTIC] Using auth config:', { key: googleApiKey ? 'KEY_EXISTS' : 'NO_KEY' });
      const client = new vision.ImageAnnotatorClient({ key: googleApiKey });
      console.log('[DIAGNOSTIC] Vision client created, calling textDetection');
      const [result] = await client.textDetection(publicUrl);
      const detections = result.textAnnotations;
      const processedText = detections?.[0]?.description || '';

      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'upload',
        source_info: filePath,
        processed_text: processedText
      }).select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No data returned');
      return { success: true, contentId: data[0].id };
    } catch (err) {
      set.status = 500;
      return { error: (err as Error).message };
    }
  })
  .post('/highlights', async ({ body, set }) => {
    const { contentId, text, context, userId } = body as { contentId: string, text: string, context: string, userId: string };

    if (!contentId || !text || !userId) {
      set.status = 400;
      return { error: 'Missing required fields' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('highlights').insert({
      user_id: userId,
      content_id: contentId,
      highlighted_text: text,
      surrounding_context: context
    }).select();

    if (error) {
      set.status = 500;
      return { error: error.message };
    }
    return { success: true, highlightId: data[0].id };
  })
  .listen(3001);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);