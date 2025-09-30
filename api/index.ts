import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import vision from '@google-cloud/vision';

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
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      const title = $('title').text();
      const text = $('body').text().trim();

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('content').insert({
        user_id: userId,
        source_type: 'url',
        source_info: url,
        processed_text: text
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
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);

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
  .listen(3001);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);