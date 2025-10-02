import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';

dotenv.config();


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
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Check if content from this URL already exists
      const { data: existingContent, error: searchError } = await supabase
        .from('content')
        .select('id, processed_text')
        .eq('source_type', 'url')
        .eq('source_info', url)
        .limit(1)
        .single();
      
      // If content exists, return the existing contentId
      if (existingContent && !searchError) {
        return { success: true, contentId: existingContent.id, isExisting: true };
      }
      
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
      
      // Remove unwanted elements first (including navigation, metadata, and promotional content)
      $('script, style, nav, header, footer, aside, .navigation, .menu, .sidebar, .ad, .advertisement, .social-share, .comments, .related-posts, form, button, input, .newsletter, [class*="newsletter"], [class*="subscribe"], [class*="read-next"], [class*="sharing"], [class*="meta"], .entry-meta, .post-meta, .breadcrumb').remove();
      
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
      const seenTexts = new Set<string>(); // Track unique content to prevent duplicates
      
      // Helper function to check if text is a substring or similar to existing content
      const isSimilarOrDuplicate = (newText: string): boolean => {
        for (const existing of seenTexts) {
          // Exact match
          if (existing === newText) return true;
          // New text contains existing (new is longer version)
          if (newText.includes(existing) && newText.length > existing.length * 2) return true;
          // Existing contains new text (duplicate)
          if (existing.includes(newText)) return true;
        }
        return false;
      };
      
      // Try direct children first, then all descendants
      let elements = $content.find('p, blockquote, h2, h3, h4');
      
      elements.each((_, elem) => {
        const $elem = $(elem);
        const text = $elem.text().trim();
        
        // Skip if empty or too short
        if (!text || text.length < 10) return;
        
        // Skip very long paragraphs (likely malformed concatenations) - max ~1000 chars per paragraph
        if (text.length > 1500) return;
        
        // Skip navigation, footer, header content
        const parentClasses = $elem.parentsUntil($content).map((_, p) => $(p).attr('class') || '').get().join(' ');
        if (parentClasses.match(/(nav|footer|header|menu|sidebar|meta|breadcrumb|sharing|read-next|related)/i)) return;
        
        // Skip if text contains metadata patterns
        if (text.match(/reading time:|read next|share this|posted on|by |tags:|categories:/i)) return;
        
        // Skip if text matches or contains the title
        if (text === title || text.includes(title)) return;
        
        // Skip if similar or duplicate to existing content
        if (isSimilarOrDuplicate(text)) return;
        
        const tagName = $elem.prop('tagName')?.toLowerCase();
        if (tagName === 'blockquote') {
          paragraphs.push(`> ${text}`);
          seenTexts.add(text);
        } else if (['h2', 'h3', 'h4'].includes(tagName || '')) {
          paragraphs.push(`## ${text}`);
          seenTexts.add(text);
        } else if (tagName === 'p') {
          paragraphs.push(text);
          seenTexts.add(text);
        }
      });
      
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

      // Create new content entry
      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'url',
        source_info: url,
        processed_text: JSON.stringify(structuredContent)
      }).select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No data returned');
      return { success: true, contentId: data[0].id, isExisting: false };
    } catch (err) {
      set.status = 500;
      return { error: (err as Error).message };
    }
  })
  .post('/content/upload', async ({ body, set }) => {
    const { filePath, userId } = body as { filePath: string, userId: string };
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);

      const vision = await import('@google-cloud/vision');
      const client = new vision.ImageAnnotatorClient({ key: googleApiKey });
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