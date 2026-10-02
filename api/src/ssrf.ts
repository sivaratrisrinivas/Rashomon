import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Server-side fetch for user-supplied URLs. Blocks requests that resolve to
 * loopback, private, link-local (cloud metadata), CGNAT, multicast or other
 * reserved ranges, re-checks every redirect hop, and caps time and size.
 */

export class UnsafeUrlError extends Error {}

const V4_BLOCKS: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

const v4ToInt = (ip: string) => ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;

export function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = v4ToInt(ip);
    return V4_BLOCKS.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (v4ToInt(base) & mask);
    });
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]!);
    return (
      lower === '::' || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') ||
      lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') ||
      lower.startsWith('ff') || lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8')
    );
  }
  return true;
}

export type Resolver = (host: string) => Promise<string[]>;

export const dnsResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

export async function assertPublicUrl(raw: string, resolve: Resolver = dnsResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http and https URLs are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed');
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) throw new UnsafeUrlError('Port not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => [] as string[]);
  if (addresses.length === 0) throw new UnsafeUrlError('Could not resolve host');
  if (addresses.some(isBlockedIp)) throw new UnsafeUrlError('URL points to a private or reserved address');
  return url;
}

export type SafeFetchOptions = {
  resolve?: Resolver;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

export async function safeFetchText(raw: string, opts: SafeFetchOptions = {}): Promise<string> {
  const { resolve = dnsResolver, fetchImpl = fetch, maxBytes = 5 * 1024 * 1024, timeoutMs = 10_000, maxRedirects = 3 } = opts;
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current, resolve);
    const res = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'RashomonBot/1.0 (+https://github.com/sivaratrisrinivas/Rashomon)', Accept: 'text/html,application/xhtml+xml' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Page returned HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) throw new Error('URL is not an HTML page');
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Page is too large');
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new UnsafeUrlError('Too many redirects');
}
