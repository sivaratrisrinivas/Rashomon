import * as cheerio from 'cheerio';

export type StructuredContent = {
  metadata: { title: string };
  paragraphs: string[];
};

export const normalizeUrl = (rawUrl: string): string => {
  const urlObj = new URL(rawUrl);
  urlObj.pathname = urlObj.pathname.replace(/\/$/, '') || '/';
  urlObj.hash = '';
  const params = Array.from(urlObj.searchParams.entries()).sort();
  urlObj.search = '';
  params.forEach(([key, value]) => urlObj.searchParams.append(key, value));
  return urlObj.toString().toLowerCase();
};

export const sanitizeStructuredContent = (input: Partial<StructuredContent> | null | undefined): StructuredContent => {
  const rawTitle = (input?.metadata as any)?.title;
  const title = typeof rawTitle === 'string' && rawTitle.trim().length > 0 ? rawTitle.trim() : 'Untitled';
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(input?.paragraphs) ? input!.paragraphs! : []) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }
  return { metadata: { title }, paragraphs: cleaned };
};

const NOISE =
  'script, style, nav, header, footer, aside, .navigation, .menu, .sidebar, .ad, .advertisement, .social-share, .comments, .related-posts, form, button, input, .newsletter, [class*="newsletter"], [class*="subscribe"], [class*="read-next"], [class*="sharing"], [class*="meta"], .entry-meta, .post-meta, .breadcrumb';

/** Pulls a title and readable paragraphs out of an article page. */
export function extractArticle(html: string): StructuredContent {
  const $ = cheerio.load(html);
  const title =
    $('h1').first().text().trim() || $('article h1').first().text().trim() || $('title').text().trim() || 'Untitled';

  $(NOISE).remove();

  let $content = $('article .entry-content').first();
  if ($content.length === 0) $content = $('.entry-content').first();
  if ($content.length === 0) $content = $('article').first();
  if ($content.length === 0) $content = $('main').first();
  if ($content.length === 0) $content = $('.post-content, .article-content').first();
  if ($content.length === 0) $content = $('body');
  $content.find('h1').remove();

  const paragraphs: string[] = [];
  const seen = new Set<string>();
  const isDuplicate = (text: string) => {
    for (const existing of seen) {
      if (existing === text) return true;
      if (text.includes(existing) && text.length > existing.length * 2) return true;
      if (existing.includes(text)) return true;
    }
    return false;
  };

  $content.find('p, blockquote, h2, h3, h4').each((_, elem) => {
    const $elem = $(elem);
    const text = $elem.text().trim();
    if (!text || text.length < 10 || text.length > 1500) return;
    const parentClasses = $elem
      .parentsUntil($content)
      .map((_, p) => $(p).attr('class') || '')
      .get()
      .join(' ');
    if (/(nav|footer|header|menu|sidebar|meta|breadcrumb|sharing|read-next|related)/i.test(parentClasses)) return;
    if (/reading time:|read next|share this|posted on|by |tags:|categories:/i.test(text)) return;
    if (text === title || text.includes(title)) return;
    if (isDuplicate(text)) return;
    const tag = ($elem.prop('tagName') as string | undefined)?.toLowerCase();
    if (tag === 'blockquote') paragraphs.push(`> ${text}`);
    else if (tag === 'h2' || tag === 'h3' || tag === 'h4') paragraphs.push(`## ${text}`);
    else if (tag === 'p') paragraphs.push(text);
    else return;
    seen.add(text);
  });

  return sanitizeStructuredContent({ metadata: { title }, paragraphs });
}
