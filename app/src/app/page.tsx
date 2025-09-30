import { createSupabaseServerClient } from '@/lib/supabase-server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="text-center max-w-2xl px-6">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Welcome to Rashomon!
        </h1>
        <p className="text-gray-600 text-lg mb-2">
          Hello, {session?.user?.email || 'User'}!
        </p>
        <p className="text-sm text-gray-500 mb-8">
          A platform for meaningful discussions around shared reading experiences.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="text-base">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}