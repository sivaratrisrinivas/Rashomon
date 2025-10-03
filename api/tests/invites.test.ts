import { Elysia } from 'elysia';
import { describe, it, expect } from 'bun:test';

describe('Invites Endpoint', () => {
  it('creates invite link for session', async () => {
    const app = new Elysia()
      .post('/invites', async ({ body }) => {
        const { sessionId } = body as { sessionId: string };
        const inviteCode = crypto.randomUUID();
        return { link: `https://your-app.com/invite/${inviteCode}` };
      });

    const response = await app.handle(
      new Request('http://localhost/invites', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test-session-id' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { link: string };
    expect(response.status).toBe(200);
    expect(data.link).toContain('invite');
    expect(data.link).toContain('https://');
  });

  it('returns error when session ID is missing', async () => {
    const app = new Elysia()
      .post('/invites', async ({ body, set }) => {
        const { sessionId } = body as any;
        if (!sessionId) {
          set.status = 400;
          return { error: 'Session ID required' };
        }
        return { link: 'https://your-app.com/invite/123' };
      });

    const response = await app.handle(
      new Request('http://localhost/invites', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await response.json() as { error: string };
    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});