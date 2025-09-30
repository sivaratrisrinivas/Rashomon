import { createSupabaseServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';

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
        <div className="max-w-4xl mx-auto p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Reading View</h1>
                <p className="text-sm text-gray-500">
                    Source: {content.source_type === 'url' ? 'URL' : 'Upload'} - {content.source_info}
                </p>
                <p className="text-xs text-gray-400">
                    Added on {new Date(content.created_at).toLocaleDateString()}
                </p>
            </div>

            <div className="prose prose-lg max-w-none">
                <div className="whitespace-pre-wrap leading-relaxed">
                    {content.processed_text}
                </div>
            </div>
        </div>
    );
}


