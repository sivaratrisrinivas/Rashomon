'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';
import { MessageCircle, FileText } from 'lucide-react';

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
    const [isImportExpanded, setIsImportExpanded] = useState(false);
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
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                <div className="max-w-5xl mx-auto px-8 py-5 flex justify-between items-center">
                    <Link href="/" className="text-[13px] font-medium tracking-tight hover:opacity-60 transition-opacity">
                        Rashomon
                    </Link>
                    <Button
                        onClick={() => setIsImportExpanded(!isImportExpanded)}
                        variant="ghost"
                        className="h-8 px-3 text-[11px] font-normal"
                    >
                        {isImportExpanded ? 'Close' : '+ Import'}
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-8 py-12">
                {/* Collapsible Import Section */}
                {isImportExpanded && (
                    <div className="mb-16 pb-16 border-b border-border/20">
                        <div className="mb-8">
                            <h1 className="text-[13px] font-medium mb-1">Import Content</h1>
                            <p className="text-[11px] text-muted-foreground">
                                From web or file
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            {/* URL Input - Streamlined */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="Paste article URL"
                                        disabled={isProcessing}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                        className="h-10 text-[13px] border-border/30"
                                    />
                                    <Button
                                        onClick={handleUrlSubmit}
                                        disabled={!url.trim() || isProcessing}
                                        className="h-10 px-4 text-[12px] font-normal shrink-0"
                                        variant="outline"
                                    >
                                        {isProcessing ? 'Processing' : 'Import'}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground pl-1">
                                    Extract text from any web article
                                </p>
                            </div>

                            {/* File Upload - Streamlined */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 border border-border/30 px-3 py-2 flex items-center">
                                        <Input
                                            type="file"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                            disabled={isProcessing}
                                            accept="image/*,.pdf"
                                            className="h-6 text-[12px] border-0 p-0 file:text-[11px]"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleFileUpload}
                                        disabled={!file || isProcessing}
                                        className="h-10 px-4 text-[12px] font-normal shrink-0"
                                        variant="outline"
                                    >
                                        {isProcessing ? 'Processing' : 'Upload'}
                                    </Button>
                                </div>
                                {file && (
                                    <p className="text-[10px] text-muted-foreground pl-1 truncate">
                                        {file.name}
                                    </p>
                                )}
                                {!file && (
                                    <p className="text-[10px] text-muted-foreground pl-1">
                                        Extract text using OCR
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Recent Content Section - Redesigned */}
                {recentContent.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-[12px] font-medium">Reading Library</h2>
                            <p className="text-[10px] text-muted-foreground">
                                {recentContent.length} {recentContent.length === 1 ? 'item' : 'items'}
                            </p>
                        </div>
                        <div className="space-y-0 divide-y divide-border/20">
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
                                    <div
                                        key={content.id}
                                        className="group py-4 hover:bg-muted/20 transition-colors px-3 -mx-3"
                                    >
                                        <div className="flex items-start justify-between gap-6">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-normal mb-1.5 truncate">
                                                    {title}
                                                </h3>
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                        {content.source_type}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/40">•</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(content.created_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    onClick={() => router.push(`/chat/${content.id}`)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Start discussion"
                                                >
                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    onClick={() => router.push(`/reading/${content.id}`)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="Read"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(content.id);
                                                        setCopiedId(content.id);
                                                        setTimeout(() => setCopiedId(null), 2000);
                                                    }}
                                                    className="h-8 px-2 text-[10px] font-normal opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    {copiedId === content.id ? 'Copied' : 'ID'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    !isImportExpanded && (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="text-center space-y-3 max-w-xs">
                                <p className="text-[13px] text-muted-foreground">
                                    No content yet
                                </p>
                                <Button
                                    onClick={() => setIsImportExpanded(true)}
                                    variant="outline"
                                    className="h-9 px-4 text-[12px] font-normal"
                                >
                                    Import your first article
                                </Button>
                            </div>
                        </div>
                    )
                )}
            </main>
        </div>
    );
};

export default DashboardPage;