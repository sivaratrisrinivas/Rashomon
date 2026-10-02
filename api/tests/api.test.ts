import { beforeEach, describe, expect, it } from 'bun:test';
import { createApp } from '../src/app';
import { FakeSupabase } from './fake-supabase';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const TOKENS: Record<string, string> = { 'alice-token': ALICE, 'bob-token': BOB };

const ARTICLE = `<html><head><title>T</title></head><body><article><h1>The Long Read</h1>
<p>First paragraph with enough words to count as real content.</p>
<p>Second paragraph that adds another distinct and readable idea.</p>
<nav><p>Navigation links that should be ignored entirely.</p></nav></article></body></html>`;

let db: FakeSupabase;
let fetched: string[];
let app: ReturnType<typeof createApp>;

const call = async (method: string, path: string, opts: { token?: string; body?: unknown; origin?: string } = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.origin) headers.Origin = opts.origin;
  const res = await app.handle(
    new Request(`http://localhost${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
  );
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers };
};

beforeEach(() => {
  db = new FakeSupabase();
  db.unique.chat_sessions = ['highlight_id'];
  db.tables.profiles = [{ id: ALICE, reading_preferences: [] }, { id: BOB, reading_preferences: [] }];
  fetched = [];
  app = createApp({
    db: db as any,
    verifyToken: async (t) => (TOKENS[t] ? { id: TOKENS[t]! } : null),
    fetchPage: async (url) => { fetched.push(url); return ARTICLE; },
    ocr: async () => 'Some OCR text from a photographed page',
    allowedOrigins: ['https://rashomon.example'],
    rateLimit: { limit: 1000, windowMs: 60_000 },
    log: { info() {}, warn() {}, error() {} },
  });
});

describe('authentication', () => {
  it('rejects requests without a valid Supabase token', async () => {
    expect((await call('PUT', '/profile', { body: { reading_preferences: ['fiction'] } })).status).toBe(401);
    expect((await call('PUT', '/profile', { token: 'forged', body: { reading_preferences: ['fiction'] } })).status).toBe(401);
    expect((await call('GET', '/health')).status).toBe(200);
  });

  it('ignores a userId in the body and uses the token owner (no impersonation)', async () => {
    const r = await call('PUT', '/profile', { token: 'bob-token', body: { userId: ALICE, reading_preferences: ['history'] } });
    expect(r.status).toBe(200);
    expect(db.tables.profiles!.find((p) => p.id === BOB)!.reading_preferences).toEqual(['history']);
    expect(db.tables.profiles!.find((p) => p.id === ALICE)!.reading_preferences).toEqual([]);
  });

  it('serves PUT /profile, the path the onboarding page actually calls', async () => {
    expect((await call('PUT', '/profile', { token: 'alice-token', body: { reading_preferences: ['science'] } })).status).toBe(200);
    expect((await call('PUT', '/profile', { token: 'alice-token', body: { reading_preferences: 'science' } })).status).toBe(400);
  });
});

describe('content', () => {
  it('extracts an article once and de-duplicates by normalized URL', async () => {
    const a = await call('POST', '/content/url', { token: 'alice-token', body: { url: 'https://Example.com/post/?b=2&a=1#x' } });
    expect(a.status).toBe(200);
    expect(a.json.isExisting).toBe(false);
    const stored = JSON.parse(db.tables.content![0]!.processed_text);
    expect(stored.metadata.title).toBe('The Long Read');
    expect(stored.paragraphs).toHaveLength(2);
    expect(db.tables.content![0]!.user_id).toBe(ALICE);

    const b = await call('POST', '/content/url', { token: 'bob-token', body: { url: 'https://example.com/post?a=1&b=2' } });
    expect(b.json).toMatchObject({ contentId: a.json.contentId, isExisting: true });
    expect(fetched).toHaveLength(1);
  });

  it('rejects invalid URLs with 400', async () => {
    expect((await call('POST', '/content/url', { token: 'alice-token', body: { url: 'not a url' } })).status).toBe(400);
    expect((await call('POST', '/content/url', { token: 'alice-token', body: {} })).status).toBe(400);
  });

  it('only OCRs files inside the caller\'s own upload folder', async () => {
    db.files[`${ALICE}/page.png`] = new Uint8Array([1, 2, 3]);
    expect((await call('POST', '/content/upload', { token: 'bob-token', body: { filePath: `${ALICE}/page.png` } })).status).toBe(403);
    expect((await call('POST', '/content/upload', { token: 'alice-token', body: { filePath: `${ALICE}/../x.png` } })).status).toBe(403);
    const ok = await call('POST', '/content/upload', { token: 'alice-token', body: { filePath: `${ALICE}/page.png` } });
    expect(ok.status).toBe(200);
    expect(db.tables.content![0]!.processed_text).toContain('OCR text');
  });

  it('returns 404 for unknown content and 400 for malformed ids', async () => {
    expect((await call('GET', '/content/33333333-3333-4333-8333-333333333333', { token: 'alice-token' })).status).toBe(404);
    expect((await call('GET', '/content/not-a-uuid', { token: 'alice-token' })).status).toBe(400);
  });

  it('hides internal database errors behind a generic 500', async () => {
    db.failNext.content = { code: 'XX000', message: 'connection string postgres://secret@db' };
    const r = await call('GET', '/content/33333333-3333-4333-8333-333333333333', { token: 'alice-token' });
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.json)).not.toContain('secret');
  });
});

describe('highlights and chat', () => {
  const seedContent = async () =>
    (await call('POST', '/content/url', { token: 'alice-token', body: { url: 'https://example.com/a' } })).json.contentId as string;

  it('records messages under the signed-in author and replays them per passage', async () => {
    const contentId = await seedContent();
    const h = await call('POST', '/highlights', {
      token: 'alice-token',
      body: { contentId, text: 'First paragraph', startIndex: 0, endIndex: 15, userId: BOB },
    });
    expect(h.status).toBe(200);
    expect(db.tables.highlights![0]!.user_id).toBe(ALICE);

    const again = await call('POST', '/highlights', { token: 'bob-token', body: { contentId, text: 'First paragraph' } });
    expect(again.json.highlightId).toBe(h.json.highlightId);

    const m1 = await call('POST', '/messages', { token: 'alice-token', body: { highlightId: h.json.highlightId, message: 'Interesting!' } });
    const m2 = await call('POST', '/messages', { token: 'bob-token', body: { highlightId: h.json.highlightId, message: 'Agreed', userId: ALICE } });
    expect(m1.json.sessionId).toBe(m2.json.sessionId);

    const s = await call('GET', `/content/${contentId}/sessions`, { token: 'bob-token' });
    expect(s.json.sessions).toHaveLength(1);
    const session = s.json.sessions[0];
    expect(session.highlightedText).toBe('First paragraph');
    expect(session.participantCount).toBe(2);
    expect(session.transcript.map((t: any) => [t.userId, t.message])).toEqual([[ALICE, 'Interesting!'], [BOB, 'Agreed']]);
    expect(db.rpcCalls).toHaveLength(1);
  });

  it('falls back to read-modify-write if the atomic append function is not deployed', async () => {
    db.rpcMissing = true;
    const contentId = await seedContent();
    const h = (await call('POST', '/highlights', { token: 'alice-token', body: { contentId, text: 'Second paragraph' } })).json.highlightId;
    await call('POST', '/messages', { token: 'alice-token', body: { highlightId: h, message: 'one' } });
    await call('POST', '/messages', { token: 'bob-token', body: { highlightId: h, message: 'two' } });
    expect(db.tables.chat_sessions![0]!.transcript).toHaveLength(2);
  });

  it('handles two readers opening the same passage chat at the same moment', async () => {
    const contentId = await seedContent();
    const h = (await call('POST', '/highlights', { token: 'alice-token', body: { contentId, text: 'Second paragraph' } })).json.highlightId;
    const [a, b] = await Promise.all([
      call('POST', '/messages', { token: 'alice-token', body: { highlightId: h, message: 'hi' } }),
      call('POST', '/messages', { token: 'bob-token', body: { highlightId: h, message: 'hello' } }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(db.tables.chat_sessions).toHaveLength(1);
    expect(db.tables.chat_sessions![0]!.transcript).toHaveLength(2);
  });

  it('validates message input', async () => {
    const contentId = await seedContent();
    expect((await call('POST', '/messages', { token: 'alice-token', body: { contentId, message: '' } })).status).toBe(400);
    expect((await call('POST', '/messages', { token: 'alice-token', body: { contentId, message: 'x'.repeat(2001) } })).status).toBe(400);
    expect((await call('POST', '/messages', { token: 'alice-token', body: { message: 'hi' } })).status).toBe(400);
    expect((await call('POST', '/highlights', { token: 'alice-token', body: { contentId: 'nope', text: 'x' } })).status).toBe(400);
  });
});

describe('cors and rate limiting', () => {
  it('only reflects allowed origins', async () => {
    const good = await call('GET', '/', { origin: 'https://rashomon.example' });
    expect(good.headers.get('access-control-allow-origin')).toBe('https://rashomon.example');
    const evil = await call('GET', '/', { origin: 'https://evil.up.railway.app' });
    expect(evil.headers.get('access-control-allow-origin')).not.toBe('https://evil.up.railway.app');
  });

  it('limits requests per signed-in user', async () => {
    app = createApp({
      db: db as any,
      verifyToken: async (t) => (TOKENS[t] ? { id: TOKENS[t]! } : null),
      fetchPage: async () => ARTICLE,
      ocr: async () => '',
      allowedOrigins: [],
      rateLimit: { limit: 3, windowMs: 60_000 },
      log: { info() {}, warn() {}, error() {} },
    });
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await call('GET', '/content/not-a-uuid', { token: 'alice-token' })).status);
    expect(statuses).toEqual([400, 400, 400, 429, 429]);
  });
});
