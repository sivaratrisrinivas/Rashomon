import { createClient } from '@/lib/supabase/client';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';

/**
 * Calls the Rashomon API with the current Supabase access token. The API
 * derives the user from this token, so pages never send a userId.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await createClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(`${getBrowserRuntimeEnv().apiUrl}${path}`, { ...init, headers });
}
