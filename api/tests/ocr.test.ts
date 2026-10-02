import { describe, expect, it } from 'bun:test';
import { createGeminiOcr, detectMime, OCR_PROMPT, MAX_OCR_BYTES } from '../src/ocr';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n...');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('detectMime', () => {
  it('recognizes supported formats by magic bytes', () => {
    expect(detectMime(PNG)).toBe('image/png');
    expect(detectMime(JPEG)).toBe('image/jpeg');
    expect(detectMime(PDF)).toBe('application/pdf');
    expect(detectMime(WEBP)).toBe('image/webp');
    expect(detectMime(Buffer.from('GIF89a'))).toBe('image/gif');
  });
  it('rejects anything else, including text and a RIFF that is not WebP', () => {
    expect(detectMime(Buffer.from('hello world'))).toBeNull();
    expect(detectMime(Buffer.from('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
    expect(detectMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('createGeminiOcr', () => {
  it('sends the image inline with the right mime type, key in a header, and returns the text', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ocr = createGeminiOcr({
      apiKey: 'test-key',
      model: 'gemini-test',
      fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return ok('  Page one text\n\nPage two  '); }) as any,
    });
    expect(await ocr(JPEG)).toBe('Page one text\n\nPage two');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(calls[0]!.url).not.toContain('test-key');
    expect((calls[0]!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: JPEG.toString('base64') });
    expect(body.contents[0].parts[1].text).toBe(OCR_PROMPT);
    expect(body.generationConfig.temperature).toBe(0);
  });

  it('joins multiple text parts and returns empty string when nothing is readable', async () => {
    const multi = createGeminiOcr({ apiKey: 'k', fetch: (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'a ' }, { text: 'b' }] } }] }))) as any });
    expect(await multi(PNG)).toBe('a b');
    const empty = createGeminiOcr({ apiKey: 'k', fetch: (async () => new Response(JSON.stringify({ candidates: [] }))) as any });
    expect(await empty(PDF)).toBe('');
  });

  it('retries rate limits and server errors, then succeeds', async () => {
    const statuses = [429, 503];
    let n = 0;
    const ocr = createGeminiOcr({
      apiKey: 'k', backoffMs: 1,
      fetch: (async () => { n++; const s = statuses.shift(); return s ? new Response('busy', { status: s }) : ok('done'); }) as any,
    });
    expect(await ocr(PNG)).toBe('done');
    expect(n).toBe(3);
  });

  it('does not retry a 400 and gives up after the retry budget', async () => {
    let n = 0;
    const bad = createGeminiOcr({ apiKey: 'k', backoffMs: 1, fetch: (async () => { n++; return new Response('bad', { status: 400 }); }) as any });
    await expect(bad(PNG)).rejects.toThrow('OCR provider returned 400');
    expect(n).toBe(1);
    n = 0;
    const down = createGeminiOcr({ apiKey: 'k', backoffMs: 1, retries: 2, fetch: (async () => { n++; throw new Error('network'); }) as any });
    await expect(down(PNG)).rejects.toThrow('OCR request failed');
    expect(n).toBe(2);
  });

  it('refuses empty, oversized and unsupported files without calling the provider', async () => {
    let n = 0;
    const ocr = createGeminiOcr({ apiKey: 'k', fetch: (async () => { n++; return ok('x'); }) as any });
    await expect(ocr(Buffer.alloc(0))).rejects.toThrow('Empty file');
    await expect(ocr(Buffer.from('plain text file'))).rejects.toThrow('Unsupported file type');
    const huge = Buffer.alloc(MAX_OCR_BYTES + 1);
    PNG.copy(huge);
    await expect(ocr(huge)).rejects.toThrow('too large');
    expect(n).toBe(0);
  });
});
