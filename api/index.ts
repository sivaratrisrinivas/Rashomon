import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { ImageAnnotatorClient } from '@google-cloud/vision';

dotenv.config();


const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleApiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY!;

// Initialize Vision client once (performance optimization)
const visionClient = new ImageAnnotatorClient({ 
  apiKey: googleApiKey 
});

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
    console.log('\n📤 UPLOAD ENDPOINT CALLED');
    console.log('  - filePath:', filePath);
    console.log('  - userId:', userId);
    
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Download image directly from storage (faster than signed URL)
      console.log('  - Downloading image from storage...');
      const { data: imageData, error: downloadError } = await supabase.storage
        .from('uploads')
        .download(filePath);
      
      if (downloadError || !imageData) {
        console.error('❌ Failed to download image:', downloadError);
        throw new Error('Failed to download image from storage');
      }
      
      // Convert blob to buffer for Vision API
      const imageBuffer = Buffer.from(await imageData.arrayBuffer());
      console.log('  - Image size:', (imageBuffer.length / 1024).toFixed(2), 'KB');

      // Call Vision API with enhanced features and retry logic
      console.log('  - Calling Google Vision API...');
      let result: any = null;
      let retries = 2;
      
      while (retries >= 0) {
        try {
          [result] = await visionClient.documentTextDetection({
            image: { content: imageBuffer },
            imageContext: {
              languageHints: ['en'], // Add language hints for better accuracy
            }
          });
          break; // Success, exit retry loop
        } catch (visionError: any) {
          if (retries === 0) throw visionError;
          console.log(`  ⚠️  Vision API attempt failed, retrying... (${retries} left)`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        }
      }
      
      if (!result) {
        throw new Error('Failed to get response from Vision API');
      }
      
      // Extract text with fallback strategies
      let processedText = '';
      
      // Strategy 1: Use full document text (best for documents)
      if (result.fullTextAnnotation?.text) {
        processedText = result.fullTextAnnotation.text;
        console.log('  ✓ Using fullTextAnnotation');
      }
      // Strategy 2: Use text annotations (fallback)
      else if (result.textAnnotations?.[0]?.description) {
        processedText = result.textAnnotations[0].description;
        console.log('  ✓ Using textAnnotations');
      }
      
      console.log('  - OCR extracted text length:', processedText.length);
      console.log('  - OCR preview:', processedText.substring(0, 100));

      if (!processedText || processedText.trim().length === 0) {
        console.error('❌ No text extracted from image');
        throw new Error('No text could be extracted from the image. The image may not contain readable text or the quality may be too low.');
      }

      // Better structure the OCR content
      const lines = processedText.split('\n').map(line => line.trim()).filter(line => line);
      
      // Extract title (first substantial line or first few lines combined)
      let title = 'Uploaded Image';
      if (lines.length > 0 && lines[0]) {
        // If first line is short (< 50 chars), combine with next lines
        if (lines[0].length < 50 && lines.length > 1) {
          title = lines.slice(0, 2).filter(Boolean).join(' ');
        } else {
          title = lines[0];
        }
        // Limit title length
        if (title.length > 100) {
          title = title.substring(0, 97) + '...';
        }
      }
      
      // Group lines into paragraphs (merge short consecutive lines)
      const paragraphs: string[] = [];
      let currentParagraph = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        // Skip if this line is part of the title
        if (i < 2 && title.includes(line)) continue;
        
        if (currentParagraph) {
          // If current line is short and doesn't end with punctuation, merge with previous
          if (line.length < 80 && !/[.!?]$/.test(currentParagraph)) {
            currentParagraph += ' ' + line;
          } else {
            // Save current paragraph and start new one
            paragraphs.push(currentParagraph);
            currentParagraph = line;
          }
        } else {
          currentParagraph = line;
        }
      }
      
      // Add last paragraph
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
      }
      
      // Estimate reading time
      const wordCount = processedText.split(/\s+/).length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 200));

      const structuredContent = {
        metadata: {
          title: title,
          category: 'OCR',
          readingTime: `${readingTime} min read`
        },
        paragraphs: paragraphs.length > 0 ? paragraphs : [processedText]
      };

      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'upload',
        source_info: filePath,
        processed_text: JSON.stringify(structuredContent)
      }).select();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }
      if (!data || data.length === 0) {
        console.error('❌ No data returned from insert');
        throw new Error('No data returned');
      }
      
      console.log('✅ Upload successful, contentId:', data[0].id);
      return { success: true, contentId: data[0].id };
    } catch (err) {
      console.error('❌ Upload error:', (err as Error).message);
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
  .post('/messages', async ({ body, set }) => {
    const { highlightId, userId, message, timestamp, contentId } = body as { 
      highlightId?: string,
      contentId?: string,
      userId: string, 
      message: string, 
      timestamp: string 
    };

    if ((!highlightId && !contentId) || !userId || !message) {
      set.status = 400;
      return { error: 'Missing required fields (need highlightId or contentId, userId, and message)' };
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const isHighlightChat = !!highlightId;
      const isContentChat = !!contentId;
      
      console.log('\n📨 /messages endpoint:', isHighlightChat ? 'HIGHLIGHT-LEVEL' : 'CONTENT-LEVEL', 'chat');

      const messageEntry = {
        userId,
        message,
        timestamp: timestamp || new Date().toISOString()
      };

      // Check for existing session based on chat type
      let existingSession;
      if (isHighlightChat) {
        const { data } = await supabase
          .from('chat_sessions')
          .select('id, transcript')
          .eq('highlight_id', highlightId)
          .single();
        existingSession = data;
      } else {
        const { data } = await supabase
          .from('chat_sessions')
          .select('id, transcript')
          .eq('content_id', contentId)
          .single();
        existingSession = data;
      }

      if (existingSession) {
        // Append to existing transcript
        console.log('  ✏️  Updating session:', existingSession.id);
        const updatedTranscript = [...(existingSession.transcript || []), messageEntry];
        const { error } = await supabase
          .from('chat_sessions')
          .update({ transcript: updatedTranscript })
          .eq('id', existingSession.id);

        if (error) throw error;
        return { success: true, sessionId: existingSession.id };
      } else {
        // Create new session with appropriate ID field
        console.log('  🆕 Creating new session...');
        const insertData: any = {
          participants: [userId],
          transcript: [messageEntry]
        };
        
        if (isHighlightChat) {
          insertData.highlight_id = highlightId;
        } else {
          insertData.content_id = contentId;
        }
        
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert(insertData)
          .select();

        if (error) {
          console.error('  ❌ Error:', error.message);
          throw error;
        }
        
        console.log('  ✅ Session created:', data[0].id);
        return { success: true, sessionId: data[0].id };
      }
    } catch (err) {
      console.error('Messages endpoint error:', err);
      set.status = 500;
      return { error: (err as Error).message };
    }
  })
  .post('/invites', async ({ body, set }) => {
    const { sessionId } = body as { sessionId: string };
    
    console.log('\n📨 INVITES ENDPOINT CALLED');
    console.log('  - sessionId:', sessionId);
    
    if (!sessionId) {
      set.status = 400;
      return { error: 'Session ID required' };
    }

    const inviteCode = crypto.randomUUID();
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('  - Generated invite code:', inviteCode);
    
    const { error } = await supabase.from('invites').insert({ 
      code: inviteCode, 
      session_id: sessionId 
    });

    if (error) {
      console.error('❌ Error creating invite:', error.message);
      set.status = 500;
      return { error: error.message };
    }
    
    console.log('✅ Invite created successfully');
    return { link: `https://your-app.com/invite/${inviteCode}` };
  })
  .listen(3001);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);