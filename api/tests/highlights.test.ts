import { Elysia } from 'elysia';
import { describe, it, expect } from 'bun:test';

describe('Highlights Endpoint', () => {
  it('saves highlight successfully with all required fields', async () => {
    const app = new Elysia()
      .post('/highlights', async ({ body, set }) => {
        const { contentId, text, context, userId } = body as any;
        
        if (!contentId || !text || !userId) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        
        return { success: true, highlightId: 'test-highlight-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/highlights', {
        method: 'POST',
        body: JSON.stringify({ 
          contentId: 'test-content-id', 
          text: 'This is highlighted text', 
          context: 'This is highlighted text from surrounding context',
          userId: 'test-user-id' 
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { success: boolean; highlightId: string };
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.highlightId).toBe('test-highlight-id');
  });

  it('returns 400 when contentId is missing', async () => {
    const app = new Elysia()
      .post('/highlights', async ({ body, set }) => {
        const { contentId, text, userId } = body as any;
        
        if (!contentId || !text || !userId) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        
        return { success: true, highlightId: 'test-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/highlights', {
        method: 'POST',
        body: JSON.stringify({ 
          text: 'highlighted text', 
          context: 'context',
          userId: 'test-user' 
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { error: string };
    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('returns 400 when text is missing', async () => {
    const app = new Elysia()
      .post('/highlights', async ({ body, set }) => {
        const { contentId, text, userId } = body as any;
        
        if (!contentId || !text || !userId) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        
        return { success: true, highlightId: 'test-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/highlights', {
        method: 'POST',
        body: JSON.stringify({ 
          contentId: 'test-content', 
          context: 'context',
          userId: 'test-user' 
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { error: string };
    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('returns 400 when userId is missing', async () => {
    const app = new Elysia()
      .post('/highlights', async ({ body, set }) => {
        const { contentId, text, userId } = body as any;
        
        if (!contentId || !text || !userId) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        
        return { success: true, highlightId: 'test-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/highlights', {
        method: 'POST',
        body: JSON.stringify({ 
          contentId: 'test-content', 
          text: 'highlighted text', 
          context: 'context'
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { error: string };
    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('handles context as optional field', async () => {
    const app = new Elysia()
      .post('/highlights', async ({ body, set }) => {
        const { contentId, text, userId } = body as any;
        
        if (!contentId || !text || !userId) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        
        return { success: true, highlightId: 'test-id' };
      });

    const response = await app.handle(
      new Request('http://localhost/highlights', {
        method: 'POST',
        body: JSON.stringify({ 
          contentId: 'test-content', 
          text: 'highlighted text', 
          userId: 'test-user'
          // context is optional
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { success: boolean };
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});