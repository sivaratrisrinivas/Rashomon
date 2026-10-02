import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractArticle, normalizeUrl, sanitizeStructuredContent } from './extract';
import { UnsafeUrlError } from './ssrf';
import { RateLimiter } from './rate-limit';

export type AuthUser = { id: string };

export type Deps = {
  /** Service-role client. Never trust client-supplied user IDs with it. */
  db: SupabaseClient;
  /** Verifies a Supabase access token and returns the user, or null. */
  verifyToken: (token: string) => Promise<AuthUser | null>;
  /** Fetches an article page with SSRF protection. */
  fetchPage: (url: string) => Promise<string>;
  /** Runs OCR on an image. */
  ocr: (image: Buffer) => Promise<string>;
  allowedOrigins: (string | RegExp)[];
  rateLimit?: { limit: number; windowMs: number };
  log?: Pick<Console, 'info' | 'warn' | 'error'>;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'PGRST116';
const MAX_MESSAGE = 2000;
const MAX_HIGHLIGHT = 5000;

const requireString = (v: unknown, name: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`);
  if (v.length > max) throw new HttpError(400, `${name} is too long (max ${max} characters)`);
  return v;
};
const requireUuid = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new HttpError(400, `${name} must be a valid id`);
  return v;
};
const optionalIndex = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10_000_000 ? v : undefined;

export function createApp(deps: Deps) {
  const { db, log = console } = deps;
  const limiter = new RateLimiter(deps.rateLimit?.limit ?? 120, deps.rateLimit?.windowMs ?? 60_000);

  const authenticate = async (request: Request): Promise<AuthUser> => {
    const header = request.headers.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Sign in required');
    const user = await deps.verifyToken(token);
    if (!user) throw new HttpError(401, 'Session expired, please sign in again');
    return user;
  };

  const appendMessage = async (sessionId: string, entry: Record<string, unknown>, userId: string) => {
    // Atomic append in Postgres (see supabase/migrations). Falls back to
    // read-modify-write only if the function has not been deployed yet.
    const { error } = await db.rpc('append_chat_message', { p_session_id: sessionId, p_entry: entry, p_user_id: userId });
    if (!error) return;
    if (error.code !== 'PGRST202' && error.code !== '42883') throw error;
    log.warn('append_chat_message missing; using non-atomic fallback. Apply supabase/migrations.');
    const { data, error: readErr } = await db.from('chat_sessions').select('transcript, participants').eq('id', sessionId).single();
    if (readErr) throw readErr;
    const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
    const { error: updErr } = await db
      .from('chat_sessions')
      .update({
        transcript: [...(data?.transcript || []), entry],
        participants: participants.includes(userId) ? participants : [...participants, userId],
      })
      .eq('id', sessionId);
    if (updErr) throw updErr;
  };

  return new Elysia()
    .use(
      cors({
        origin: deps.allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
      }),
    )
    .onError(({ error, set, code }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return { error: error.message };
      }
      if (error instanceof UnsafeUrlError) {
        set.status = 400;
        return { error: error.message };
      }
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { error: 'Not found' };
      }
      if (code === 'PARSE' || code === 'VALIDATION') {
        set.status = 400;
        return { error: 'Invalid request body' };
      }
      log.error('Unhandled API error:', error);
      set.status = 500;
      return { error: 'Something went wrong. Please try again.' };
    })
    .get('/', () => ({ status: 'ok' }))
    .get('/health', async ({ set }) => {
      const { error } = await db.from('profiles').select('id').limit(1);
      if (error) {
        set.status = 503;
        return { status: 'unhealthy', database: 'disconnected' };
      }
      return { status: 'healthy', database: 'connected', timestamp: new Date().toISOString() };
    })
    // Everything below requires a valid Supabase session.
    .derive(async ({ request, server }) => {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS' || url.pathname === '/' || url.pathname === '/health') return { user: null as AuthUser | null };
      const user = await authenticate(request);
      const ip = server?.requestIP(request)?.address ?? 'unknown';
      if (!limiter.allow(`u:${user.id}`) || !limiter.allow(`ip:${ip}`, 4)) throw new HttpError(429, 'Too many requests, slow down a little');
      return { user };
    })
    .put('/profile', async ({ body, user }) => updateProfile(body, user!))
    .put('/api/profile', async ({ body, user }) => updateProfile(body, user!))
    .post('/content/url', async ({ body, user }) => {
      const raw = requireString((body as any)?.url, 'url', 2048);
      let normalized: string;
      try {
        normalized = normalizeUrl(raw);
      } catch {
        throw new HttpError(400, 'Invalid URL');
      }
      const { data: existing, error: searchError } = await db
        .from('content')
        .select('id')
        .eq('source_type', 'url')
        .eq('source_info', normalized)
        .limit(1)
        .single();
      if (searchError && searchError.code !== NOT_FOUND) throw searchError;
      if (existing) return { success: true, contentId: existing.id, isExisting: true };

      const html = await deps.fetchPage(raw);
      const structured = extractArticle(html);
      if (structured.paragraphs.length === 0) throw new HttpError(422, 'Could not find readable text on that page');
      const { data, error } = await db
        .from('content')
        .insert({ user_id: user!.id, source_type: 'url', source_info: normalized, processed_text: JSON.stringify(structured) })
        .select('id')
        .single();
      if (error) throw error;
      return { success: true, contentId: data.id, isExisting: false };
    })
    .post('/content/upload', async ({ body, user }) => {
      const filePath = requireString((body as any)?.filePath, 'filePath', 512);
      // Uploads live under <userId>/ in the bucket. Only OCR your own files.
      if (!filePath.startsWith(`${user!.id}/`) || filePath.includes('..')) throw new HttpError(403, 'You can only process your own uploads');
      const { data: file, error: downloadError } = await db.storage.from('uploads').download(filePath);
      if (downloadError || !file) throw new HttpError(404, 'Uploaded file not found');
      const image = Buffer.from(await file.arrayBuffer());
      if (image.length > 10 * 1024 * 1024) throw new HttpError(413, 'Image is too large (max 10 MB)');
      const text = (await deps.ocr(image)).trim();
      if (!text) throw new HttpError(422, 'No readable text found in that image');

      const hash = createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ')).digest('hex');
      const { data: existing, error: searchError } = await db
        .from('content')
        .select('id')
        .eq('source_type', 'upload')
        .eq('source_info', hash)
        .limit(1)
        .single();
      if (searchError && searchError.code !== NOT_FOUND) throw searchError;
      if (existing) return { success: true, contentId: existing.id, isExisting: true };
      const { data, error } = await db
        .from('content')
        .insert({ user_id: user!.id, source_type: 'upload', source_info: hash, processed_text: text })
        .select('id')
        .single();
      if (error) throw error;
      return { success: true, contentId: data.id, isExisting: false };
    })
    .post('/highlights', async ({ body, user }) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const contentId = requireUuid(b.contentId, 'contentId');
      const text = requireString(b.text, 'text', MAX_HIGHLIGHT);
      const context = typeof b.context === 'string' ? b.context.slice(0, 1000) : null;
      const start = optionalIndex(b.startIndex);
      const end = optionalIndex(b.endIndex);

      const { data: existing, error: searchError } = await db
        .from('highlights')
        .select('id')
        .eq('content_id', contentId)
        .eq('highlighted_text', text)
        .limit(1)
        .single();
      if (searchError && searchError.code !== NOT_FOUND) throw searchError;
      if (existing) return { success: true, highlightId: existing.id };

      const row: Record<string, unknown> = { user_id: user!.id, content_id: contentId, highlighted_text: text, surrounding_context: context };
      if (start !== undefined && end !== undefined && end >= start) Object.assign(row, { start_index: start, end_index: end });
      const { data, error } = await db.from('highlights').insert(row).select('id').single();
      if (error) throw error;
      return { success: true, highlightId: data.id };
    })
    .post('/messages', async ({ body, user }) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const highlightId = b.highlightId ? requireUuid(b.highlightId, 'highlightId') : undefined;
      const contentId = !highlightId && b.contentId ? requireUuid(b.contentId, 'contentId') : undefined;
      if (!highlightId && !contentId) throw new HttpError(400, 'highlightId or contentId is required');
      const message = requireString(b.message, 'message', MAX_MESSAGE);
      // The author is always the signed-in user, never a body field.
      const entry = { userId: user!.id, message, timestamp: new Date().toISOString() };

      let sessionQuery = db.from('chat_sessions').select('id');
      sessionQuery = highlightId ? sessionQuery.eq('highlight_id', highlightId) : sessionQuery.eq('content_id', contentId!).is('highlight_id', null);
      const { data: existing, error: findErr } = await sessionQuery.limit(1).single();
      if (findErr && findErr.code !== NOT_FOUND) throw findErr;
      if (existing) {
        await appendMessage(existing.id, entry, user!.id);
        return { success: true, sessionId: existing.id };
      }

      let transcript: unknown[] = [entry];
      if (highlightId) {
        // A new passage-level chat inherits any article-level conversation.
        const { data: hl } = await db.from('highlights').select('content_id').eq('id', highlightId).single();
        if (!hl) throw new HttpError(404, 'Highlight not found');
        const { data: parent } = await db
          .from('chat_sessions')
          .select('transcript')
          .eq('content_id', hl.content_id)
          .is('highlight_id', null)
          .limit(1)
          .single();
        if (parent?.transcript?.length) transcript = [...parent.transcript, entry];
      }
      const { data, error } = await db
        .from('chat_sessions')
        .insert({ participants: [user!.id], transcript, ...(highlightId ? { highlight_id: highlightId } : { content_id: contentId }) })
        .select('id')
        .single();
      if (error) {
        // Another participant created the session at the same moment: append instead.
        if (error.code === '23505') {
          let q = db.from('chat_sessions').select('id');
          q = highlightId ? q.eq('highlight_id', highlightId) : q.eq('content_id', contentId!).is('highlight_id', null);
          const { data: winner } = await q.limit(1).single();
          if (winner) {
            await appendMessage(winner.id, entry, user!.id);
            return { success: true, sessionId: winner.id };
          }
        }
        throw error;
      }
      return { success: true, sessionId: data.id };
    })
    .get('/content/:contentId', async ({ params }) => {
      const contentId = requireUuid(params.contentId, 'contentId');
      const { data, error } = await db
        .from('content')
        .select('id, processed_text, source_type, source_info, created_at')
        .eq('id', contentId)
        .single();
      if (error?.code === NOT_FOUND || (!error && !data)) throw new HttpError(404, 'Content not found');
      if (error) throw error;
      return { content: data };
    })
    .get('/content/:contentId/sessions', async ({ params }) => {
      const contentId = requireUuid(params.contentId, 'contentId');
      const { data: highlights, error: hlErr } = await db
        .from('highlights')
        .select('id, highlighted_text, start_index, end_index')
        .eq('content_id', contentId);
      if (hlErr) throw hlErr;
      const byId = new Map((highlights || []).map((h: any) => [h.id, h]));

      const { data: contentSessions, error: csErr } = await db
        .from('chat_sessions')
        .select('id, highlight_id, participants, transcript, created_at')
        .eq('content_id', contentId);
      if (csErr) throw csErr;
      let highlightSessions: any[] = [];
      if (byId.size > 0) {
        const { data, error } = await db
          .from('chat_sessions')
          .select('id, highlight_id, participants, transcript, created_at')
          .in('highlight_id', [...byId.keys()]);
        if (error) throw error;
        highlightSessions = data || [];
      }
      const seen = new Set<string>();
      const sessions = [...(contentSessions || []), ...highlightSessions]
        .filter((s: any) => !seen.has(s.id) && seen.add(s.id))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((s: any) => {
          const h: any = s.highlight_id ? byId.get(s.highlight_id) : null;
          return {
            id: s.id,
            highlightedText: h?.highlighted_text ?? null,
            startIndex: h?.start_index ?? null,
            endIndex: h?.end_index ?? null,
            transcript: s.transcript || [],
            participantCount: Array.isArray(s.participants) ? s.participants.length : 0,
            createdAt: s.created_at,
          };
        });
      return { sessions };
    });

  async function updateProfile(body: unknown, user: AuthUser) {
    const prefs = (body as any)?.reading_preferences;
    if (!Array.isArray(prefs) || prefs.length === 0 || prefs.length > 20 || !prefs.every((p) => typeof p === 'string' && p.length <= 50)) {
      throw new HttpError(400, 'reading_preferences must be a list of up to 20 short strings');
    }
    const { data, error } = await db.from('profiles').update({ reading_preferences: prefs }).eq('id', user.id).select().single();
    if (error?.code === NOT_FOUND) throw new HttpError(404, 'Profile not found');
    if (error) throw error;
    return { success: true, profile: data };
  }
}

export { sanitizeStructuredContent };
