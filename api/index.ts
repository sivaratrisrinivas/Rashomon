import { createClient } from '@supabase/supabase-js';
import { createApp } from './src/app';
import { safeFetchText } from './src/ssrf';
import { createGeminiOcr } from './src/ocr';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}`);
    process.exit(1);
  }
  return value;
};

const supabaseUrl = required('SUPABASE_URL');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const geminiKey = process.env.GEMINI_API_KEY;

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const geminiOcr = geminiKey ? createGeminiOcr({ apiKey: geminiKey, model: process.env.GEMINI_OCR_MODEL }) : null;

const allowedOrigins: (string | RegExp)[] = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = createApp({
  db,
  allowedOrigins,
  verifyToken: async (token) => {
    const { data, error } = await db.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  },
  fetchPage: (url) => safeFetchText(url),
  ocr: async (image) => {
    if (!geminiOcr) throw new Error('OCR is not configured (GEMINI_API_KEY missing)');
    return geminiOcr(image);
  },
});

app.listen({ port: Number(process.env.PORT || 3001), hostname: '0.0.0.0' });
console.log(`Rashomon API listening on ${app.server?.hostname}:${app.server?.port}; CORS origins: ${allowedOrigins.join(', ')}`);

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  app.stop().finally(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
