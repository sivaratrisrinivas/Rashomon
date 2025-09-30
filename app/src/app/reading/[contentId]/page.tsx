import { createSupabaseServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ReadingPageProps {
    params: {
        contentId: string;
    };
}

export default async function ReadingPage({ params }: ReadingPageProps) {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        notFound();
    }

    const { data: content, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', params.contentId)
        .eq('user_id', session.user.id)
        .single();

    if (error || !content) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            {/* Header */}
            <header className="border-b bg-white shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold hover:opacity-80 transition">
                        Rashomon
                    </Link>
                    <nav className="flex gap-4">
                        <Link href="/dashboard">
                            <Button variant="ghost">Dashboard</Button>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Back Button */}
                <div className="mb-6">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="sm">
                            ← Back to Dashboard
                        </Button>
                    </Link>
                </div>

                {/* Content Card */}
                <article className="bg-white rounded-lg border shadow-sm">
                    {/* Article Header */}
                    <div className="border-b px-8 py-6 bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">
                                        {content.source_type === 'url' ? '🌐' : '📄'}
                                    </span>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        {content.source_type === 'url' ? 'Web Article' : 'Uploaded Document'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 break-all">
                                    {content.source_info}
                                </p>
                            </div>
                            <div className="text-right text-xs text-gray-400">
                                {new Date(content.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Article Content */}
                    <div className="px-8 py-8">
                        <div className="prose prose-lg max-w-none">
                            <div className="whitespace-pre-wrap leading-relaxed text-gray-800 text-base">
                                {content.processed_text}
                            </div>
                        </div>
                    </div>
                </article>

                {/* Future Feature Hint */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>Coming soon:</strong> Highlight text to discuss with others reading the same content in real-time.
                    </p>
                </div>
            </main>
        </div>
    );
}


