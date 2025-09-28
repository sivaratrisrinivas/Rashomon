import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Rashomon!</h1>
        <p className="text-gray-600">
          Hello, {session?.user?.email || 'User'}!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          You are successfully logged in and have completed onboarding.
        </p>
      </div>
    </div>
  );
}