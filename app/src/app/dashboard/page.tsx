'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';
import { Info } from 'lucide-react';

const DashboardPage = () => {
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUrlProcessing, setIsUrlProcessing] = useState(false);
    const [isFileProcessing, setIsFileProcessing] = useState(false);
    const [isImportExpanded, setIsImportExpanded] = useState(false);
    const [importMode, setImportMode] = useState<'url' | 'file'>('url');
    const router = useRouter();

    const handleUrlSubmit = async () => {
        if (!url.trim()) return;

        setIsUrlProcessing(true);
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
            setIsUrlProcessing(false);
        }
    };

    const handleFileUpload = async () => {
        if (!file) return;

        setIsFileProcessing(true);
        try {
            const { data: { session } } = await getSupabaseClient().auth.getSession();
            if (!session) {
                console.error('No session found');
                return;
            }

            console.log('Uploading file to storage...');
            const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await getSupabaseClient().storage.from('uploads').upload(filePath, file);

            if (uploadError) {
                console.error('Storage upload error:', uploadError);
                alert('Failed to upload file: ' + uploadError.message);
                return;
            }

            console.log('File uploaded, processing OCR...');
            const response = await fetch('http://localhost:3001/content/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, userId: session.user.id }),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error('API error:', result.error);
                alert('Failed to process image: ' + (result.error || 'Unknown error'));
                return;
            }

            if (result.contentId) {
                console.log('Success! Navigating to content:', result.contentId);
                router.push(`/reading/${result.contentId}`);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file: ' + (error as Error).message);
        } finally {
            setIsFileProcessing(false);
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

                        <div className="space-y-6">
                            <div className="inline-flex rounded-full border border-border/30 bg-background/80 p-1 text-[12px]">
                                <Button
                                    type="button"
                                    variant={importMode === 'url' ? 'default' : 'ghost'}
                                    className={`h-8 px-4 font-normal ${importMode === 'url' ? '' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                        setImportMode('url');
                                        setFile(null);
                                    }}
                                >
                                    URL
                                </Button>
                                <Button
                                    type="button"
                                    variant={importMode === 'file' ? 'default' : 'ghost'}
                                    className={`h-8 px-4 font-normal ${importMode === 'file' ? '' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                        setImportMode('file');
                                        setUrl('');
                                    }}
                                >
                                    Upload
                                </Button>
                            </div>

                            {importMode === 'url' ? (
                                <div className="space-y-3">
                                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="Paste article URL"
                                            disabled={isUrlProcessing}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                            className="h-10 text-[13px] border-border/30 md:flex-1"
                                        />
                                        <Button
                                            onClick={handleUrlSubmit}
                                            disabled={!url.trim() || isUrlProcessing}
                                            className="h-10 px-4 text-[12px] font-normal"
                                            variant="outline"
                                        >
                                            {isUrlProcessing ? 'Processing' : 'Import'}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pl-1">
                                        Extract text from any web article
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                                        <div className="md:flex-1 border border-border/30 px-3 py-2 flex items-center">
                                            <Input
                                                type="file"
                                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                                disabled={isFileProcessing}
                                                accept="image/*,.pdf"
                                                className="h-6 text-[12px] border-0 p-0 file:text-[11px]"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleFileUpload}
                                            disabled={!file || isFileProcessing}
                                            className="h-10 px-4 text-[12px] font-normal"
                                            variant="outline"
                                        >
                                            {isFileProcessing ? 'Processing' : 'Upload'}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pl-1">
                                        Extract text using OCR
                                    </p>
                                    {file && (
                                        <p className="text-[10px] text-muted-foreground pl-1 truncate">
                                            {file.name}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!isImportExpanded && (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                            <Info className="h-4 w-4 text-muted-foreground" />
                            <p className="text-[13px] text-muted-foreground">
                                Hit <strong>+ Import</strong> to add something worth reading. Once imported, you head straight into the reading flow—no library shelf in the way.
                            </p>
                            <Button
                                onClick={() => setIsImportExpanded(true)}
                                variant="outline"
                                className="h-9 px-4 text-[12px] font-normal"
                            >
                                Import now
                            </Button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;