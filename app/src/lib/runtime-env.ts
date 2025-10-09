export type RuntimeEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
};

type RuntimeEnvKey = keyof RuntimeEnv;

const ENV_KEY_MAP: Record<RuntimeEnvKey, string[]> = {
  supabaseUrl: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
  supabaseAnonKey: ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  apiUrl: ['NEXT_PUBLIC_API_URL', 'API_URL'],
};

const coalesceEnv = (key: RuntimeEnvKey): string => {
  const options = ENV_KEY_MAP[key];
  
  // DEBUG: Log what we're looking for
  console.log(`[RUNTIME-ENV DEBUG] Looking for ${key}, checking:`, options);
  
  for (const envKey of options) {
    // Bracket notation prevents Next.js from inlining values at build time.
    const value = process.env[envKey as keyof NodeJS.ProcessEnv];
    console.log(`[RUNTIME-ENV DEBUG] ${envKey} =`, value ? `"${value.substring(0, 20)}..."` : 'undefined');
    if (value) {
      return value;
    }
  }
  
  console.error(`[RUNTIME-ENV ERROR] Missing required environment variable for ${key}`);
  console.error('[RUNTIME-ENV ERROR] Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('API')));
  throw new Error(`Missing required environment variable for ${key}`);
};

let cachedServerEnv: RuntimeEnv | null = null;

export const getServerRuntimeEnv = (): RuntimeEnv => {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = {
    supabaseUrl: coalesceEnv('supabaseUrl'),
    supabaseAnonKey: coalesceEnv('supabaseAnonKey'),
    apiUrl: coalesceEnv('apiUrl'),
  };

  return cachedServerEnv;
};

let cachedClientEnv: RuntimeEnv | null = null;

const isRuntimeEnvShape = (value: unknown): value is RuntimeEnv => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeEnv = value as Record<string, unknown>;
  return (
    typeof maybeEnv.supabaseUrl === 'string' &&
    typeof maybeEnv.supabaseAnonKey === 'string' &&
    typeof maybeEnv.apiUrl === 'string'
  );
};

export const getBrowserRuntimeEnv = (): RuntimeEnv => {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  if (typeof window === 'undefined') {
    throw new Error('getBrowserRuntimeEnv must be called in a browser environment');
  }

  const env = (window as typeof window & { __RASHOMON_ENV__?: unknown }).__RASHOMON_ENV__;
  
  console.log('[BROWSER-ENV DEBUG] window.__RASHOMON_ENV__:', env);
  console.log('[BROWSER-ENV DEBUG] isRuntimeEnvShape:', isRuntimeEnvShape(env));

  if (!isRuntimeEnvShape(env)) {
    console.error('[BROWSER-ENV ERROR] Runtime environment is not available in the browser');
    console.error('[BROWSER-ENV ERROR] Received:', env);
    throw new Error('Runtime environment is not available in the browser');
  }

  cachedClientEnv = env;
  return cachedClientEnv;
};

export const serializeRuntimeEnv = (env: RuntimeEnv): string => {
  return JSON.stringify(env).replace(/</g, '\\u003c');
};

