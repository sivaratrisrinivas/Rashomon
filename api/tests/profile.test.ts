import { Elysia } from 'elysia';
import { describe, it, expect } from 'bun:test';

// Define types for the request body and response
interface ProfileUpdateBody {
  preferences: string[];
  userId: string;
}

interface ProfileUpdateResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Mock Supabase
const mockSupabase = {
  from: () => ({
    update: () => ({
      eq: async () => ({ data: [{ id: 'test-id' }], error: null }),
    }),
  }),
};

describe('Profile Update', () => {
  it('updates preferences successfully', async () => {
    const app = new Elysia()
      .put('/profile', async ({ body }): Promise<ProfileUpdateResponse> => {
        const { preferences, userId } = body as ProfileUpdateBody;
        const supabase = mockSupabase as any;
        const { data, error } = await supabase.from('profiles').update({ reading_preferences: preferences }).eq('id', userId);
        if (error) return { error: error.message, success: false };
        return { success: true, data };
      });

    const response = await app.handle(
      new Request('http://localhost/profile', {
        method: 'PUT',
        body: JSON.stringify({ preferences: ['fiction'], userId: 'test-id' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json() as ProfileUpdateResponse;
    expect(data.success).toBe(true);
  });
});