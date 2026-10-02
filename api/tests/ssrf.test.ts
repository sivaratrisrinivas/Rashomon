import { describe, expect, it } from 'bun:test';
import { assertPublicUrl, isBlockedIp, safeFetchText, UnsafeUrlError } from '../src/ssrf';
import { extractArticle, normalizeUrl } from '../src/extract';

const publicDns = async () => ['93.184.216.34'];

describe('isBlockedIp', () => {
  it.each([
    ['127.0.0.1', true], ['10.1.2.3', true], ['172.20.0.1', true], ['192.168.1.1', true], ['169.254.169.254', true],
    ['100.64.0.1', true], ['0.0.0.0', true], ['::1', true], ['fd00::1', true], ['fe80::1', true], ['::ffff:127.0.0.1', true],
    ['93.184.216.34', false], ['8.8.8.8', false], ['2606:4700::1111', false], ['not-an-ip', true],
  ])('%s -> %p', (ip, blocked) => {
    expect(isBlockedIp(ip)).toBe(blocked);
  });
});

describe('assertPublicUrl', () => {
  it('rejects schemes, credentials, odd ports and private targets', async () => {
    for (const bad of ['file:///etc/passwd', 'ftp://x.com', 'http://user:pw@x.com', 'http://x.com:6379', 'http://127.0.0.1/', 'http://[::1]/']) {
      await expect(assertPublicUrl(bad, publicDns)).rejects.toBeInstanceOf(UnsafeUrlError);
    }
    await expect(assertPublicUrl('http://internal.corp', async () => ['10.0.0.5'])).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertPublicUrl('http://nowhere.invalid', async () => [])).rejects.toBeInstanceOf(UnsafeUrlError);
    expect((await assertPublicUrl('https://example.com/a', publicDns)).hostname).toBe('example.com');
  });
});

describe('safeFetchText', () => {
  it('re-checks redirects and refuses a hop to the metadata service', async () => {
    const fetchImpl = (async (url: URL) =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })) as any;
    await expect(safeFetchText('https://example.com/', { resolve: publicDns, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('caps the response size and checks content type', async () => {
    const big = (async () => new Response('x'.repeat(2000), { headers: { 'content-type': 'text/html' } })) as any;
    await expect(safeFetchText('https://example.com/', { resolve: publicDns, fetchImpl: big, maxBytes: 1000 })).rejects.toThrow('too large');
    const pdf = (async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })) as any;
    await expect(safeFetchText('https://example.com/', { resolve: publicDns, fetchImpl: pdf })).rejects.toThrow('not an HTML page');
    const ok = (async () => new Response('<p>hi</p>', { headers: { 'content-type': 'text/html' } })) as any;
    expect(await safeFetchText('https://example.com/', { resolve: publicDns, fetchImpl: ok })).toBe('<p>hi</p>');
  });
});

describe('extraction helpers', () => {
  it('normalizes URLs for de-duplication', () => {
    expect(normalizeUrl('https://Example.com/Post/?b=2&a=1#frag')).toBe('https://example.com/post?a=1&b=2');
  });

  it('keeps article paragraphs and drops chrome', () => {
    const out = extractArticle(`<body><header><p>Site header text here</p></header><main><h1>Title</h1>
      <h2>A section heading</h2><p>Body paragraph with real words in it.</p><blockquote>A quoted line of text</blockquote>
      <p>Share this article with friends</p></main><footer><p>Copyright footer text</p></footer></body>`);
    expect(out.metadata.title).toBe('Title');
    expect(out.paragraphs).toEqual(['## A section heading', 'Body paragraph with real words in it.', '> A quoted line of text']);
  });
});
