import { Elysia } from 'elysia';

export const loggingMiddleware = new Elysia()
  .onRequest(({ request, set }) => {
    const start = Date.now();
    const correlationId = crypto.randomUUID();
    
    // Add correlation ID to response headers
    set.headers['X-Correlation-ID'] = correlationId;
    
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url} - ${correlationId}`);
    
    // Store start time for duration calculation
    (request as any).startTime = start;
    (request as any).correlationId = correlationId;
  })
  .onError(({ request, error, set }) => {
    const startTime = (request as any).startTime;
    const correlationId = (request as any).correlationId;
    const duration = Date.now() - startTime;
    
    console.error(`[${new Date().toISOString()}] ERROR ${request.method} ${request.url} - ${correlationId} - ${duration}ms`);
    console.error(`[${new Date().toISOString()}] ERROR:`, error);
  });
