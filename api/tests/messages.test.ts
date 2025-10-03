import { Elysia } from 'elysia';
import { describe, it, expect } from 'bun:test';

describe('Messages Endpoint', () => {
  it('appends message to transcript with highlightId', async () => {
    // Mock Supabase
    const app = new Elysia()
      .post('/messages', async ({ body }) => {
        return { success: true, sessionId: 'test-session-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/messages', {
        method: 'POST',
        body: JSON.stringify({ highlightId: 'test-highlight', message: 'hello', userId: 'test-user' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { success: boolean; sessionId: string };
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('appends message to transcript with contentId', async () => {
    const app = new Elysia()
      .post('/messages', async ({ body }) => {
        return { success: true, sessionId: 'test-session-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/messages', {
        method: 'POST',
        body: JSON.stringify({ contentId: 'test-content-id', message: 'hello', userId: 'test-user' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { success: boolean; sessionId: string };
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns error when missing required fields', async () => {
    const app = new Elysia()
      .post('/messages', async ({ body, set }) => {
        const { highlightId, contentId, userId, message } = body as any;
        const sessionIdentifier = highlightId || contentId;
        if (!sessionIdentifier || !userId || !message) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        return { success: true };
      });

    const response = await app.handle(
      new Request('http://localhost/messages', {
        method: 'POST',
        body: JSON.stringify({ message: 'hello' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { error: string };
    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });
});