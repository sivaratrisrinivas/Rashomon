import { bookmarkletHref, inviteUrl, parseDeepLinkUrl, safeNextPath } from '@/lib/share';

describe('safeNextPath', () => {
  test('keeps same-site paths with query strings', () => {
    expect(safeNextPath('/reading/abc?x=1')).toBe('/reading/abc?x=1');
  });
  test.each([null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'reading/abc'])(
    'falls back for %p',
    (value) => {
      expect(safeNextPath(value as string | null | undefined)).toBe('/dashboard');
    },
  );
});

describe('parseDeepLinkUrl', () => {
  test('accepts http and https', () => {
    expect(parseDeepLinkUrl('?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1')).toBe('https://example.com/a?b=1');
    expect(parseDeepLinkUrl('?url=http://example.com')).toBe('http://example.com/');
  });
  test.each(['', '?x=1', '?url=', '?url=javascript:alert(1)', '?url=file:///etc/passwd', '?url=not a url'])(
    'rejects %p',
    (search) => {
      expect(parseDeepLinkUrl(search)).toBeNull();
    },
  );
});

describe('inviteUrl', () => {
  test('builds a reading link and trims the trailing slash', () => {
    expect(inviteUrl('https://r.example/', 'c1')).toBe('https://r.example/reading/c1');
  });
});

describe('bookmarkletHref', () => {
  test('sends the current page to the dashboard import flow', () => {
    const href = bookmarkletHref('https://r.example');
    expect(href.startsWith('javascript:')).toBe(true);
    const location = { href: 'https://news.example/story?id=7' };
    // Run the bookmarklet body against a fake location object.
    new Function('location', href.slice('javascript:'.length))(location);
    expect(location.href).toBe('https://r.example/dashboard?url=' + encodeURIComponent('https://news.example/story?id=7'));
  });
});
