// Add diagnostic logging for module resolution
console.log('🔍 [DIAGNOSTIC] Starting module resolution diagnostics...');

try {
  console.log('🔍 [DIAGNOSTIC] Attempting to import @sinclair/typebox...');
  const typebox = await import('@sinclair/typebox');
  console.log('✅ [DIAGNOSTIC] @sinclair/typebox imported successfully:', Object.keys(typebox));
} catch (error) {
  console.error('❌ [DIAGNOSTIC] Failed to import @sinclair/typebox:', error);
}

try {
  console.log('🔍 [DIAGNOSTIC] Attempting to import elysia...');
  const { Elysia } = await import('elysia');
  console.log('✅ [DIAGNOSTIC] Elysia imported successfully');
} catch (error) {
  console.error('❌ [DIAGNOSTIC] Failed to import Elysia:', error);
}

// Check if we're in a container environment
console.log('🔍 [DIAGNOSTIC] Environment info:', {
  NODE_ENV: process.env.NODE_ENV,
  PWD: process.env.PWD,
  cwd: process.cwd(),
  platform: process.platform,
  arch: process.arch
});

// Check if node_modules exists and what's in it
try {
  const fs = await import('fs');
  const path = await import('path');
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  console.log('🔍 [DIAGNOSTIC] node_modules exists:', fs.existsSync(nodeModulesPath));
  
  if (fs.existsSync(nodeModulesPath)) {
    const typeboxPath = path.join(nodeModulesPath, '@sinclair', 'typebox');
    console.log('🔍 [DIAGNOSTIC] @sinclair/typebox path exists:', fs.existsSync(typeboxPath));
    
    if (fs.existsSync(typeboxPath)) {
      const packageJsonPath = path.join(typeboxPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log('🔍 [DIAGNOSTIC] @sinclair/typebox version:', packageJson.version);
      }
    }
  }
} catch (error) {
  console.error('❌ [DIAGNOSTIC] Error checking node_modules:', error);
}

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { ImageAnnotatorClient } from '@google-cloud/vision';
// crypto is no longer needed for hashing highlights, but we keep it for other potential uses
import { createHash } from 'crypto';
import { loggingMiddleware } from './middleware/logging';
import { rateLimitMiddleware } from './middleware/rate-limit';

// dotenv only needed for local dev - production uses platform env vars
if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch {
    // dotenv not installed - using platform env vars
  }
}


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

// Additional module resolution check before creating Elysia
console.log('🔍 [DIAGNOSTIC] Pre-Elysia module check...');
try {
  // Try to require the exact module that's failing
  const typeboxModule = require('@sinclair/typebox');
  console.log('✅ [DIAGNOSTIC] @sinclair/typebox available via require:', !!typeboxModule);
  } catch (error: any) {
    console.error('❌ [DIAGNOSTIC] @sinclair/typebox not available via require:', error.message);
}

const app = new Elysia()
  .use(cors({
    origin: [
      'http://localhost:3000',
      'https://localhost:3000',
      /^https:\/\/.*\.railway\.app$/,
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.onrender\.com$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  }))
  .use(loggingMiddleware)
  .use(rateLimitMiddleware)
  .onError(({ error, set }) => {
    set.headers['content-type'] = 'application/json';
    return { error: error instanceof Error ? error.message : String(error) };
  })
  .get('/', () => ({ status: 'ok' }))
  .get('/health', async () => {
    console.log('🔍 [BACKEND HEALTH] ===== BACKEND HEALTH ENDPOINT HIT =====');
    console.log('🔍 [BACKEND HEALTH] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey
    });
    
    try {
      // Test database connectivity
      console.log('🔍 [BACKEND HEALTH] Testing Supabase connection...');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      
      if (error) {
        return { 
          status: 'unhealthy', 
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
      
      return { 
        status: 'healthy', 
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return { 
        status: 'unhealthy', 
        database: 'error',
        error: (err as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  })
  .put('/api/profile', async ({ body, set }: { body: any, set: any }) => {
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
  .post('/content/url', async ({ body, set }: { body: any, set: any }) => {
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
  .post('/content/upload', async ({ body, set }: { body: any, set: any }) => {
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

      // For OCR content, store as plain text without structured formatting
      // This preserves the original OCR output without headings/paragraphs
      const plainTextContent = processedText;

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
        processed_text: plainTextContent
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
  .post('/highlights', async ({ body, set }: { body: any, set: any }) => {
    try {
        const { contentId, text, context, userId, startIndex, endIndex } = body as { 
            contentId: string, 
            text: string, 
            context: string, 
            userId: string,
            startIndex?: number,
            endIndex?: number
        };

        console.log('🔍 [HIGHLIGHT DEBUG] Received highlight request:', { 
            contentId, 
            userId, 
            textLength: text?.length,
            startIndex,
            endIndex
        });

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
        const insertData: any = {
            user_id: userId,
            content_id: contentId,
            highlighted_text: text,
            surrounding_context: context
        };

        // Add position data if provided
        if (typeof startIndex === 'number' && typeof endIndex === 'number') {
            insertData.start_index = startIndex;
            insertData.end_index = endIndex;
            console.log('📍 [HIGHLIGHT] Including position data:', { startIndex, endIndex });
        }

        const { data, error: insertError } = await supabase
            .from('highlights')
            .insert(insertData)
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
  .post('/messages', async ({ body, set }: { body: any, set: any }) => {
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
        console.log('🔍 [MESSAGES DEBUG] Searching for session with highlight_id:', highlightId);
        const { data } = await supabase
          .from('chat_sessions')
          .select('id, transcript, highlight_id, content_id')
          .eq('highlight_id', highlightId)
          .single();
        existingSession = data;
        console.log('🔍 [MESSAGES DEBUG] Found existing highlight session:', existingSession?.id || 'NONE');
        
        // If no highlight-level session exists, check if there's a content-level session we can inherit from
        if (!existingSession) {
          console.log('🔍 [MESSAGES DEBUG] No highlight session found. Checking for content session history...');
          // We need to get contentId from the highlight
          const { data: highlightData } = await supabase
            .from('highlights')
            .select('content_id')
            .eq('id', highlightId)
            .single();
          
          if (highlightData?.content_id) {
            console.log('🔍 [MESSAGES DEBUG] Found contentId from highlight:', highlightData.content_id);
            const { data: contentSession } = await supabase
              .from('chat_sessions')
              .select('id, transcript, highlight_id, content_id')
              .eq('content_id', highlightData.content_id)
              .is('highlight_id', null)
              .single();
            
            if (contentSession) {
              console.log('✅ [MESSAGES DEBUG] Found content-level session with history:', contentSession.id);
              console.log('📝 [MESSAGES DEBUG] Will create NEW highlight session and inherit transcript');
              // Don't set existingSession - we'll create a new one and copy transcript
              // Store it temporarily for transcript inheritance
              existingSession = { shouldInheritFrom: contentSession };
            }
          }
        }
      } else {
        console.log('🔍 [MESSAGES DEBUG] Searching for session with content_id:', contentId);
        const { data } = await supabase
          .from('chat_sessions')
          .select('id, transcript, highlight_id, content_id')
          .eq('content_id', contentId)
          .single();
        existingSession = data;
        console.log('🔍 [MESSAGES DEBUG] Found existing content session:', existingSession?.id || 'NONE');
        console.log('🔍 [MESSAGES DEBUG] Session has highlight_id?', existingSession?.highlight_id || 'NO');
      }

      // Check if this is an inheritance scenario
      const shouldInherit = (existingSession as any)?.shouldInheritFrom;
      
      if (existingSession && !shouldInherit) {
        // Normal update: Append to existing transcript
        console.log('  ✏️  Updating session:', existingSession.id);
        const updatedTranscript = [...(existingSession.transcript || []), messageEntry];
        
        const { error } = await supabase
          .from('chat_sessions')
          .update({ transcript: updatedTranscript })
          .eq('id', existingSession.id);

        if (error) {
          console.error('  ❌ [UPDATE ERROR] Update failed:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            session_id: existingSession.id
          });
          throw error;
        }
        console.log('  ✅ [UPDATE] Session updated successfully');
        return { success: true, sessionId: existingSession.id };
      } else {
        // Create new session with appropriate ID field
        console.log('  🆕 Creating new session...');
        
        // Check if we should inherit transcript from content-level session
        let initialTranscript = [messageEntry];
        if (shouldInherit) {
          const contentSession = shouldInherit;
          console.log('  📋 [INHERIT] Copying transcript from content session:', contentSession.id);
          console.log('  📋 [INHERIT] Content session has', contentSession.transcript?.length || 0, 'messages');
          initialTranscript = [...(contentSession.transcript || []), messageEntry];
          console.log('  📋 [INHERIT] New session will have', initialTranscript.length, 'messages');
        }
        
        const insertData: any = {
          participants: [userId],
          transcript: initialTranscript
        };
        
        if (isHighlightChat) {
          insertData.highlight_id = highlightId;
          console.log('  📝 [CREATE] New highlight-level session with highlight_id:', highlightId);
        } else {
          insertData.content_id = contentId;
          console.log('  📝 [CREATE] New content-level session with content_id:', contentId);
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
  .get('/content/:contentId', async ({ params, set }: { params: any, set: any }) => {
    const { contentId } = params;
    
    if (!contentId) {
      set.status = 400;
      return { error: 'Content ID is required' };
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await supabase
        .from('content')
        .select('id, processed_text, source_type, source_info, user_id, created_at')
        .eq('id', contentId)
        .single();

      if (error) throw error;
      if (!data) {
        set.status = 404;
        return { error: 'Content not found' };
      }

      return { content: data };
    } catch (err: any) {
      console.error('❌ [CONTENT] Error:', err.message);
      set.status = err.message === 'NOT_FOUND' ? 404 : 500;
      return { error: err.message };
    }
  })
  .get('/content/duplicates', async ({ set }: { set: any }) => {
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
  .get('/content/:contentId/sessions', async ({ params, set }: { params: any, set: any }) => {
    const { contentId } = params;
    
    if (!contentId) {
      set.status = 400;
      return { error: 'Content ID is required' };
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      console.log(`🎭 [SESSIONS] Fetching sessions for contentId: ${contentId}`);

      // 1) Content-level sessions (content_id = contentId)
      const { data: contentSessions, error: contentSessionsError } = await supabase
        .from('chat_sessions')
        .select('id, content_id, highlight_id, participants, transcript, created_at')
        .eq('content_id', contentId);

      if (contentSessionsError) {
        console.error('❌ [SESSIONS] Content session query error:', contentSessionsError);
        throw contentSessionsError;
      }

      // 2) Highlight-level sessions referencing highlights that belong to this content
      const { data: highlightRows, error: highlightLookupError } = await supabase
        .from('highlights')
        .select('id')
        .eq('content_id', contentId);

      if (highlightLookupError) {
        console.error('❌ [SESSIONS] Highlight lookup error:', highlightLookupError);
        throw highlightLookupError;
      }

      let highlightSessions: any[] = [];
      if (highlightRows && highlightRows.length > 0) {
        const highlightIds = highlightRows.map((row) => row.id);
        console.log('🔍 [SESSIONS] Highlight IDs for content:', highlightIds);

        const { data: highlightSessionData, error: highlightSessionError } = await supabase
          .from('chat_sessions')
          .select('id, content_id, highlight_id, participants, transcript, created_at')
          .in('highlight_id', highlightIds);

        if (highlightSessionError) {
          console.error('❌ [SESSIONS] Highlight session query error:', highlightSessionError);
          throw highlightSessionError;
        }

        highlightSessions = highlightSessionData || [];
      }

      const combinedSessions = [...(contentSessions || []), ...highlightSessions];

      if (combinedSessions.length === 0) {
        console.log('📭 [SESSIONS] No sessions found for this content');
        return { sessions: [] };
      }

      // Remove duplicates (possible if highlight session also has content_id set in historical data)
      const seen = new Set();
      const sessions = combinedSessions.filter((session) => {
        if (seen.has(session.id)) {
          return false;
        }
        seen.add(session.id);
        return true;
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // For each session, try to get associated highlight text and position data if highlight_id exists
      const enrichedSessions = await Promise.all(
        sessions.map(async (session) => {
          console.log('🔍 [SESSIONS DEBUG] Processing session:', session.id);
          console.log('🔍 [SESSIONS DEBUG] Session has highlight_id?', session.highlight_id || 'NO');
          
          let highlightedText = null;
          let startIndex = null;
          let endIndex = null;
          
          if (session.highlight_id) {
            console.log('🔍 [SESSIONS DEBUG] Fetching highlight data for highlight_id:', session.highlight_id);
            const { data: highlight, error: highlightError } = await supabase
              .from('highlights')
              .select('highlighted_text, start_index, end_index')
              .eq('id', session.highlight_id)
              .single();
            
            if (highlightError) {
              console.log('❌ [SESSIONS DEBUG] Error fetching highlight:', highlightError.message);
            }
            
            if (highlight) {
              console.log('✅ [SESSIONS DEBUG] Found highlight data:', { text: highlight.highlighted_text?.substring(0, 50) + '...', startIndex: highlight.start_index, endIndex: highlight.end_index });
              highlightedText = highlight.highlighted_text;
              startIndex = highlight.start_index;
              endIndex = highlight.end_index;
            } else {
              console.log('❌ [SESSIONS DEBUG] No highlight found for highlight_id:', session.highlight_id);
            }
          } else {
            console.log('⚠️ [SESSIONS DEBUG] Session has no highlight_id - will return null highlight data');
          }

          return {
            id: session.id,
            highlightedText,
            startIndex,
            endIndex,
            transcript: session.transcript || [],
            participantCount: Array.isArray(session.participants) ? session.participants.length : 0,
            createdAt: session.created_at
          };
        })
      );

      console.log(`✅ [SESSIONS] Found ${enrichedSessions.length} sessions`);
      return { sessions: enrichedSessions };

    } catch (err: any) {
      console.error('❌ [SESSIONS] Error:', err.message);
      set.status = 500;
      return { error: err.message };
    }
  })
  .listen({
    port: process.env.PORT || 3001,
    hostname: '0.0.0.0'
  });

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});