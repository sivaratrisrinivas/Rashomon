import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { ImageAnnotatorClient } from '@google-cloud/vision';
// crypto is no longer needed for hashing highlights, but we keep it for other potential uses
import { createHash } from 'crypto';

dotenv.config();


const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleApiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY!;

// Initialize Vision client once (performance optimization)
const visionClient = new ImageAnnotatorClient({ 
  apiKey: googleApiKey 
});

type StructuredContent = {
  metadata?: Record<string, any> | null;
  paragraphs?: string[] | null;
};

const sanitizeStructuredContent = (input: StructuredContent | null | undefined) => {
  const rawMetadata = input?.metadata ?? {};
  const title = typeof rawMetadata.title === 'string' && rawMetadata.title.trim().length > 0
    ? rawMetadata.title.trim()
    : 'Untitled';

  const rawParagraphs = Array.isArray(input?.paragraphs) ? input?.paragraphs : [];
  const cleanedParagraphs: string[] = [];
  const seen = new Set<string>();

  rawParagraphs.forEach(item => {
    if (typeof item !== 'string') return;
    const trimmed = item.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    cleanedParagraphs.push(trimmed);
  });

  return {
    metadata: { title },
    paragraphs: cleanedParagraphs,
  };
};

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
      
      // Normalize URL for consistent storage and lookup
      const normalizeUrl = (rawUrl: string): string => {
        try {
          const urlObj = new URL(rawUrl);
          // Remove trailing slash, convert to lowercase, remove hash, sort query params
          urlObj.pathname = urlObj.pathname.replace(/\/$/, '') || '/';
          urlObj.hash = '';
          // Sort query parameters for consistency
          const params = Array.from(urlObj.searchParams.entries()).sort();
          urlObj.search = '';
          params.forEach(([key, value]) => urlObj.searchParams.append(key, value));
          return urlObj.toString().toLowerCase();
        } catch {
          return rawUrl.toLowerCase().trim();
        }
      };
      
      const normalizedUrl = normalizeUrl(url);
      console.log('🔗 [URL] Original:', url);
      console.log('🔗 [URL] Normalized:', normalizedUrl);
      
      // Check if content from this URL already exists
      const { data: existingContent, error: searchError } = await supabase
        .from('content')
        .select('id, processed_text')
        .eq('source_type', 'url')
        .eq('source_info', normalizedUrl)
        .limit(1)
        .single();
      
      console.log('🔍 [URL] Existing content check:', existingContent ? `Found: ${existingContent.id}` : 'Not found');
      if (searchError && searchError.code !== 'PGRST116') {
        console.log('⚠️  [URL] Search error:', searchError);
      }
      
      // If content exists, return the existing contentId
      if (existingContent && !searchError) {
        try {
          const parsed = JSON.parse(existingContent.processed_text || '{}');
          const metadataKeys = Object.keys(parsed.metadata || {});
          const metadataSummary: Record<string, number | null> = {};
          metadataKeys.forEach(key => {
            const value = parsed.metadata[key];
            metadataSummary[key] = typeof value === 'string' ? value.length : null;
          });
          console.log('🧪 [URL] Existing metadata keys:', metadataKeys);
          console.log('🧪 [URL] Existing metadata lengths:', metadataSummary);
          if (typeof parsed.metadata?.category === 'string') {
            const preview = parsed.metadata.category.trim();
            console.log('🧪 [URL] Existing metadata.category preview:', preview.length > 120 ? `${preview.slice(0, 120)}…` : preview);
          }
          console.log('🧪 [URL] Existing paragraph count:', Array.isArray(parsed.paragraphs) ? parsed.paragraphs.length : 'n/a');

          const sanitized = sanitizeStructuredContent(parsed);
          const metadataChanged = JSON.stringify(parsed.metadata || {}) !== JSON.stringify(sanitized.metadata || {});
          const paragraphChanged = JSON.stringify(parsed.paragraphs || []) !== JSON.stringify(sanitized.paragraphs || []);

          if (metadataChanged || paragraphChanged) {
            console.log('🧹 [URL] Sanitizing existing processed_text before returning content');
            const updatedPayload = JSON.stringify({
              metadata: sanitized.metadata,
              paragraphs: sanitized.paragraphs,
            });
            const { error: updateError } = await supabase
              .from('content')
              .update({ processed_text: updatedPayload })
              .eq('id', existingContent.id);

            if (updateError) {
              console.log('⚠️  [URL] Failed to update sanitized metadata:', updateError);
            } else {
              console.log('✅ [URL] Stored sanitized metadata for existing content');
            }
          }
        } catch (parseError) {
          console.log('⚠️  [URL] Failed to inspect existing processed_text:', parseError);
        }
        console.log('✅ [URL] Returning existing contentId:', existingContent.id);
        return { success: true, contentId: existingContent.id, isExisting: true };
      }
      
      console.log('📥 [URL] Fetching new content from URL...');
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract title
      let title = $('h1').first().text().trim() || 
                  $('article h1').first().text().trim() ||
                  $('title').text().trim() ||
                  'Untitled';
      console.log('🧪 [URL] Raw title extracted:', title);

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
      console.log('🧪 [URL] Selected content container:', {
        tag: $content.prop('tagName'),
        className: $content.attr('class') || null,
      });
      
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
      
      console.log('🧪 [URL] Paragraphs extracted:', paragraphs.length);
      console.log('🧪 [URL] Paragraph previews:', paragraphs.slice(0, 3).map(p => {
        const trimmed = p.trim();
        return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
      }));
      
      // Build structured content limited to title + body
      const metadata = {
        title
      };
      console.log('🧪 [URL] Metadata prepared for storage:', metadata);
      
      const structuredContent = sanitizeStructuredContent({ metadata, paragraphs });

      // Create new content entry with normalized URL
      console.log('💾 [URL] Saving new content with normalized URL:', normalizedUrl);
      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'url',
        source_info: normalizedUrl,
        processed_text: JSON.stringify(structuredContent)
      }).select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No data returned');
      console.log('✅ [URL] Created new contentId:', data[0].id);
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

      // Create a hash of the normalized text for deduplication
      const normalizedText = processedText.toLowerCase().replace(/\s+/g, ' ').trim();
      const textHash = createHash('sha256').update(normalizedText).digest('hex');
      console.log('  - Content hash:', textHash.substring(0, 16) + '...');

      // Check if this exact content already exists (by any user)
      console.log('  - Checking for existing content with same hash...');
      const { data: existingContent, error: searchError } = await supabase
        .from('content')
        .select('id, user_id, processed_text')
        .eq('source_type', 'upload')
        .eq('source_info', textHash)
        .limit(1)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        console.log('  ⚠️  Search error:', searchError);
      }

      // If content exists, return the existing contentId
      if (existingContent && !searchError) {
        console.log('  ✅ Found existing content:', existingContent.id);
        console.log('  ✅ Originally uploaded by user:', existingContent.user_id);
        console.log('  🎯 DEDUPLICATION: Returning existing contentId instead of creating new');
        return { success: true, contentId: existingContent.id, isExisting: true };
      }

      // If not, create new content entry with hash as source_info
      console.log('  - No existing content found, creating new entry...');
      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'upload',
        source_info: textHash, // Store hash instead of filePath for deduplication
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
    try {
        const { contentId, text, context, userId } = body as { contentId: string, text: string, context: string, userId: string };

        console.log('🔍 [HIGHLIGHT DEBUG] Received highlight request:', { contentId, userId, textLength: text?.length });

        if (!contentId || !text || !userId) {
            set.status = 400;
            return { error: 'Missing required fields' };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Check if an identical highlight already exists
        const { data: existingHighlight, error: searchError } = await supabase
            .from('highlights')
            .select('id')
            .eq('content_id', contentId)
            .eq('highlighted_text', text)
            .limit(1)
            .single();

        if (searchError && searchError.code !== 'PGRST116') { // Ignore "row not found" error
            throw searchError;
        }

        // 2. If it exists, return its ID
        if (existingHighlight) {
            console.log('✅ [HIGHLIGHT] Found existing highlight:', existingHighlight.id);
            return { success: true, highlightId: existingHighlight.id };
        }
        
        console.log('📝 [HIGHLIGHT] Creating new highlight for contentId:', contentId);

        // 3. If not, create a new one (let Postgres generate the UUID)
        const { data, error: insertError } = await supabase
            .from('highlights')
            .insert({
                user_id: userId,
                content_id: contentId,
                highlighted_text: text,
                surrounding_context: context
            })
            .select('id')
            .single();

        if (insertError) {
            throw insertError;
        }
        
        if (!data) {
          throw new Error("Highlight creation failed, no ID returned.");
        }

        console.log('✅ [HIGHLIGHT] Created new highlight:', data.id);
        return { success: true, highlightId: data.id };

    } catch (err: any) {
        console.error('🔥 ERROR in /highlights:', err.message);
        set.status = 500;
        return { error: err.message || 'An unexpected server error occurred.' };
    }
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
  .get('/content/duplicates', async ({ set }) => {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Find all URL-based content grouped by normalized URL
      const { data: allContent } = await supabase
        .from('content')
        .select('id, source_info, user_id, created_at')
        .eq('source_type', 'url')
        .order('created_at', { ascending: true });
      
      if (!allContent) return { duplicates: [] };
      
      // Group by normalized URL
      const groups = new Map<string, Array<typeof allContent[0]>>();
      allContent.forEach(content => {
        const normalized = content.source_info.toLowerCase().replace(/\/$/, '');
        if (!groups.has(normalized)) {
          groups.set(normalized, []);
        }
        const group = groups.get(normalized);
        if (group) {
          group.push(content);
        }
      });
      
      // Find groups with duplicates
      const duplicates = Array.from(groups.entries())
        .filter(([_, items]) => items.length > 1)
        .filter(([_, items]) => items[0] !== undefined)
        .map(([url, items]) => ({
          normalizedUrl: url,
          count: items.length,
          contentIds: items.map(i => i.id),
          oldestId: items[0]?.id
        }));
      
      console.log(`🔍 [DUPLICATES] Found ${duplicates.length} duplicate URL groups`);
      return { duplicates };
    } catch (err: any) {
      console.error('❌ [DUPLICATES] Error:', err.message);
      set.status = 500;
      return { error: err.message };
    }
  })
  .listen(3001);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);