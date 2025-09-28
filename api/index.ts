import { Elysia } from 'elysia';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

const app = new Elysia()
  .get('/', () => ({ status: 'ok' }))
  .put('/profile', async ({ body, set }) => {
    const { preferences, userId } = body as { preferences: string[], userId: string };
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('profiles')
      .update({ reading_preferences: preferences })
      .eq('id', userId);

    if (error) {
      set.status = 500;
      return { error: error.message };
    }
    return { success: true, data };
  })
  .listen(3001);

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);