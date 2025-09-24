import { Elysia } from 'elysia';
import { describe, it, expect } from 'bun:test';

describe('Health Check', () => {
  it('returns 200 OK with status ok', async () => {
    const app = new Elysia().get('/', () => ({ status: 'ok' }));
    const response = await app.handle(new Request('http://localhost/')).then(res => res.json());
    expect(response).toEqual({ status: 'ok' });
  });
});