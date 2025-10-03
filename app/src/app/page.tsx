import { createSupabaseServerClient } from '@/lib/supabase-server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md space-y-12">
        <div className="space-y-4">
          <h1 className="text-[15px] font-medium tracking-tight">
            Rashomon
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            A platform for meaningful discussions around shared reading experiences
          </p>
        </div>

        <Link href="/dashboard">
          <Button
            variant="outline"
            className="h-10 px-6 text-[13px] font-normal"
          >
            Continue
          </Button>
        </Link>
      </div>
    </div>
  );
}