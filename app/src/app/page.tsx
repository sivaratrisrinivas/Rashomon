import { createSupabaseServerClient } from '@/lib/supabase-server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div className="flex items-center justify-center min-h-screen relative">
      {/* Floating orbs - psychedelic touch */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gradient-to-br from-orange-300/20 to-amber-300/20 blur-3xl float" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gradient-to-br from-amber-200/15 to-orange-200/15 blur-3xl float" style={{ animationDelay: '1s' }} />

      <div className="text-center max-w-lg space-y-16 relative z-10 px-6">
        <div className="space-y-6">
          <h1 className="text-[32px] font-light tracking-[-0.02em] iridescent">
            Rashomon
          </h1>
          <p className="text-[14px] text-muted-foreground leading-relaxed font-light max-w-md mx-auto">
            A platform for meaningful discussions around shared reading experiences
          </p>
        </div>

        <Link href="/dashboard">
          <Button
            variant="outline"
            className="h-12 px-8 text-[13px] font-light tracking-wide glass hover:scale-105 transition-all duration-500 hover:shadow-lg hover:shadow-orange-700/10 border-border/50"
          >
            Continue
          </Button>
        </Link>
      </div>
    </div>
  );
}