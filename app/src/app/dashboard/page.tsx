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
        <div className="min-h-screen relative">
            {/* Ambient gradient orbs */}
            <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-violet-300/10 to-transparent blur-3xl pointer-events-none gradient-shift" />
            <div className="fixed bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-300/10 to-transparent blur-3xl pointer-events-none gradient-shift" style={{ animationDelay: '5s' }} />

            {/* Header */}
            <header className="border-b border-border/50 sticky top-0 glass z-10">
                <div className="max-w-5xl mx-auto px-8 py-6 flex justify-between items-center">
                    <Link href="/" className="text-[13px] font-light tracking-wide hover:opacity-70 transition-all duration-300 iridescent">
                        Rashomon
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-8 py-12">
                {/* Collapsible Import Section */}
                {isImportExpanded && (
                    <div className="mb-20 pb-20 border-b border-border/30">
                        <div className="mb-12">
                            <h1 className="text-[24px] font-light mb-3 tracking-tight">Import Content</h1>
                            <p className="text-[12px] text-muted-foreground font-light">
                                From web or file
                            </p>
                        </div>

                        <div className="space-y-8">
                            <div className="inline-flex rounded-full border border-border/40 glass p-1.5 text-[12px]">
                                <Button
                                    type="button"
                                    variant={importMode === 'url' ? 'default' : 'ghost'}
                                    className={`h-9 px-5 font-light rounded-full transition-all duration-300 ${importMode === 'url' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
                                    className={`h-9 px-5 font-light rounded-full transition-all duration-300 ${importMode === 'file' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => {
                                        setImportMode('file');
                                        setUrl('');
                                    }}
                                >
                                    Upload
                                </Button>
                            </div>

                            {importMode === 'url' ? (
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="Paste article URL"
                                            disabled={isUrlProcessing}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                            className="h-12 text-[13px] border-border/40 glass md:flex-1 font-light placeholder:text-muted-foreground/50 focus:border-violet-500/30 transition-all duration-300"
                                        />
                                        <Button
                                            onClick={handleUrlSubmit}
                                            disabled={!url.trim() || isUrlProcessing}
                                            className="h-12 px-6 text-[12px] font-light tracking-wide glass hover:scale-105 transition-all duration-300 hover:shadow-md hover:shadow-violet-500/10 border-border/50"
                                            variant="outline"
                                        >
                                            {isUrlProcessing ? 'Processing' : 'Import'}
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground pl-1 font-light">
                                        Extract text from any web article
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="md:flex-1 border border-border/40 glass px-4 py-3 flex items-center rounded-lg transition-all duration-300 hover:border-violet-500/30">
                                            <Input
                                                type="file"
                                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                                disabled={isFileProcessing}
                                                accept="image/*,.pdf"
                                                className="h-7 text-[12px] border-0 p-0 file:text-[11px] font-light bg-transparent"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleFileUpload}
                                            disabled={!file || isFileProcessing}
                                            className="h-12 px-6 text-[12px] font-light tracking-wide glass hover:scale-105 transition-all duration-300 hover:shadow-md hover:shadow-violet-500/10 border-border/50"
                                            variant="outline"
                                        >
                                            {isFileProcessing ? 'Processing' : 'Upload'}
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground pl-1 font-light">
                                        Extract text using OCR
                                    </p>
                                    {file && (
                                        <p className="text-[11px] text-muted-foreground pl-1 truncate font-light">
                                            {file.name}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!isImportExpanded && (
                    <div className="flex flex-col items-center justify-center py-32">
                        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
                            <div className="relative">
                                <Info className="h-5 w-5 text-muted-foreground/60 float" />
                            </div>
                            <p className="text-[14px] text-muted-foreground font-light leading-relaxed">
                                Hit <span className="font-normal text-foreground/80">+ Import</span> to add something worth reading. Once imported, you head straight into the reading flow—no library shelf in the way.
                            </p>
                            <Button
                                onClick={() => setIsImportExpanded(true)}
                                variant="outline"
                                className="h-11 px-6 text-[12px] font-light tracking-wide glass hover:scale-105 transition-all duration-300 hover:shadow-md hover:shadow-violet-500/10 border-border/50"
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