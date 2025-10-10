import { Elysia } from 'elysia';

// Simple in-memory rate limiting (for production, consider Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per window per IP

export const rateLimitMiddleware = new Elysia()
  .derive(({ request }) => {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const now = Date.now();
    const key = `rate_limit:${ip}`;
    
    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or create new entry
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      });
      return { rateLimit: { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 } };
    }
    
    if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
      return { rateLimit: { allowed: false, remaining: 0 } };
    }
    
    // Increment counter
    current.count++;
    rateLimitStore.set(key, current);
    
    return { rateLimit: { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - current.count } };
  })
  .onBeforeHandle(({ rateLimit, set }) => {
    if (!rateLimit.allowed) {
      set.status = 429;
      set.headers['Retry-After'] = '900'; // 15 minutes
      return {
        error: 'Rate limit exceeded',
        retryAfter: 900
      };
    }
    
    // Add rate limit headers
    set.headers['X-RateLimit-Limit'] = RATE_LIMIT_MAX_REQUESTS.toString();
    set.headers['X-RateLimit-Remaining'] = rateLimit.remaining.toString();
    set.headers['X-RateLimit-Reset'] = new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString();
  });
