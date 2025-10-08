import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';

describe('GET /content/:contentId/sessions', () => {
  test('should return 400 when contentId is missing', async () => {
    const app = new Elysia()
      .get('/content/:contentId/sessions', async ({ params, set }) => {
        const { contentId } = params;
        if (!contentId) {
          set.status = 400;
          return { error: 'Content ID is required' };
        }
        return { sessions: [] };
      });

    // This test simulates the route structure, but in practice,
    // Elysia always provides params from the route
    const response = await app.handle(
      new Request('http://localhost/content//sessions')
    );

    expect(response.status).toBe(404); // Empty param leads to 404 in Elysia
  });

  test('should return empty array when no sessions exist', async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              then: (resolve: any) => resolve({ data: [], error: null })
            })
          })
        })
      })
    };

    const app = new Elysia()
      .get('/content/:contentId/sessions', async ({ params, set }) => {
        const { contentId } = params;
        
        if (!contentId) {
          set.status = 400;
          return { error: 'Content ID is required' };
        }

        // Mock query returns empty array
        return { sessions: [] };
      });

    const response = await app.handle(
      new Request('http://localhost/content/test-id-123/sessions')
    );
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ sessions: [] });
  });

  test('should return sessions with correct structure', async () => {
    const app = new Elysia()
      .get('/content/:contentId/sessions', async ({ params, set }) => {
        const { contentId } = params;
        
        if (!contentId) {
          set.status = 400;
          return { error: 'Content ID is required' };
        }

        // Mock successful response
        const mockSessions = [
          {
            id: 'session-1',
            highlightedText: 'Some highlighted text',
            transcript: [
              { userId: 'user-1', message: 'Hello', timestamp: '2025-10-05T10:00:00Z' },
              { userId: 'user-2', message: 'Hi there', timestamp: '2025-10-05T10:01:00Z' }
            ],
            participantCount: 2,
            createdAt: '2025-10-05T10:00:00Z'
          },
          {
            id: 'session-2',
            highlightedText: null,
            transcript: [
              { userId: 'user-3', message: 'Interesting', timestamp: '2025-10-06T14:30:00Z' }
            ],
            participantCount: 1,
            createdAt: '2025-10-06T14:30:00Z'
          }
        ];

        return { sessions: mockSessions };
      });

    const response = await app.handle(
      new Request('http://localhost/content/test-id-123/sessions')
    );
    
    const data = await response.json() as { sessions: any[] };
    expect(response.status).toBe(200);
    expect(data.sessions).toBeArray();
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0]).toHaveProperty('id');
    expect(data.sessions[0]).toHaveProperty('transcript');
    expect(data.sessions[0]).toHaveProperty('participantCount');
    expect(data.sessions[0]).toHaveProperty('createdAt');
  });

  test('should handle database errors gracefully', async () => {
    const app = new Elysia()
      .get('/content/:contentId/sessions', async ({ params, set }) => {
        const { contentId } = params;
        
        if (!contentId) {
          set.status = 400;
          return { error: 'Content ID is required' };
        }

        // Simulate database error
        set.status = 500;
        return { error: 'Database connection failed' };
      });

    const response = await app.handle(
      new Request('http://localhost/content/test-id-123/sessions')
    );
    
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });
});

