'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';

interface ContentItem {
    id: string;
    source_type: string;
    source_info: string;
    created_at: string;
    processed_text: string;
}

const DashboardPage = () => {
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const router = useRouter();

    // Fetch recent content
    useEffect(() => {
        const fetchRecentContent = async () => {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('content')
                .select('id, source_type, source_info, created_at, processed_text')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (!error && data) {
                setRecentContent(data);
            }
        };

        fetchRecentContent();
    }, [isProcessing]);

    const handleUrlSubmit = async () => {
        if (!url.trim()) return;

        setIsProcessing(true);
        try {
            const { data: { session } } = await getSupabaseClient().auth.getSession();
            if (!session) return;

            const response = await fetch('http://localhost:3001/content/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, userId: session.user.id }),
            });

            const { contentId, isExisting } = await response.json();
            if (contentId) {
                if (isExisting) {
                    console.log('✅ Using existing content - perfect for matching with other readers!');
                }
                router.push(`/reading/${contentId}`);
            }
        } catch (error) {
            console.error('Error processing URL:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = async () => {
        if (!file) return;

        setIsProcessing(true);
        try {
            const { data: { session } } = await getSupabaseClient().auth.getSession();
            if (!session) return;

            const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await getSupabaseClient().storage.from('uploads').upload(filePath, file);

            if (uploadError) {
                console.error(uploadError);
                return;
            }

            const response = await fetch('http://localhost:3001/content/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, userId: session.user.id }),
            });

            const { contentId } = await response.json();
            if (contentId) router.push(`/reading/${contentId}`);
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setIsProcessing(false);
        }
    };

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
            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Add Content</h1>
                    <p className="text-gray-600">
                        Import content from the web or upload your own files to start reading and discussing.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* URL Input Section */}
                    <div className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                                <span className="text-2xl">🌐</span>
                                Add from URL
                            </h2>
                            <p className="text-sm text-gray-500">
                                Paste a link to any web article or page to extract and save its content.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/article"
                                disabled={isProcessing}
                                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                className="text-base"
                            />
                            <Button
                                onClick={handleUrlSubmit}
                                disabled={!url.trim() || isProcessing}
                                className="w-full"
                                size="lg"
                            >
                                {isProcessing ? 'Processing...' : 'Import from URL'}
                            </Button>
                        </div>
                    </div>

                    {/* File Upload Section */}
                    <div className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                                <span className="text-2xl">📄</span>
                                Upload File
                            </h2>
                            <p className="text-sm text-gray-500">
                                Upload an image or document. We'll extract the text using OCR.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed rounded-lg p-4 hover:border-gray-400 transition">
                                <Input
                                    type="file"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    disabled={isProcessing}
                                    accept="image/*,.pdf"
                                    className="cursor-pointer"
                                />
                                {file && (
                                    <p className="text-sm text-gray-600 mt-2">
                                        Selected: {file.name}
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={handleFileUpload}
                                disabled={!file || isProcessing}
                                className="w-full"
                                size="lg"
                            >
                                {isProcessing ? 'Processing...' : 'Upload & Extract Text'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Recent Content Section */}
                {recentContent.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold mb-4">Recent Content</h2>
                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            <div className="divide-y">
                                {recentContent.map((content) => {
                                    const metadata = (() => {
                                        try {
                                            return JSON.parse(content.processed_text);
                                        } catch {
                                            return { metadata: { title: 'Untitled' } };
                                        }
                                    })();

                                    const title = metadata.metadata?.title || content.source_info || 'Untitled';

                                    return (
                                        <div key={content.id} className="p-4 hover:bg-gray-50 transition">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 truncate">{title}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-500">
                                                            {content.source_type === 'url' ? '🌐' : '📄'} {content.source_type}
                                                        </span>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(content.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono">
                                                            ID: {content.id.substring(0, 8)}...
                                                        </code>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(content.id);
                                                                setCopiedId(content.id);
                                                                setTimeout(() => setCopiedId(null), 2000);
                                                            }}
                                                            className="h-6 text-xs"
                                                        >
                                                            {copiedId === content.id ? '✓ Copied!' : 'Copy ID'}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => router.push(`/reading/${content.id}`)}
                                                    variant="default"
                                                >
                                                    Read
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Testing Helper */}
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                                <strong>🧪 Testing Chat:</strong> To test the chat feature, copy a content ID above and share it with another user.
                                Both users must navigate to the same content ID (e.g., <code className="bg-yellow-100 px-1 rounded">/reading/SAME_ID</code>)
                                and click "Discuss this" on any highlighted text.
                            </p>
                        </div>
                    </div>
                )}

                {/* Helper Text */}
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>Tip:</strong> After importing content, you'll be taken to the reading view where you can highlight text and connect with others reading the same content.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;