'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { fetchLinkMetadata, isValidUrl, LinkMetadata } from '@/shared/lib/linkPreviewApi';
import { Loader2, ExternalLink, Link as LinkIcon, Image as ImageIcon, Layout, LayoutGrid } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';

type LayoutType = 'horizontal' | 'vertical' | 'compact' | 'full-image';

interface LinkPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (data: { type: 'link' | 'preview'; url: string; text?: string; metadata?: LinkMetadata; layout?: LayoutType }) => void;
}

export function LinkPreviewDialog({ open, onOpenChange, onInsert }: LinkPreviewDialogProps) {
    const [url, setUrl] = useState('');
    const [linkType, setLinkType] = useState<'link' | 'preview'>('preview');
    const [linkText, setLinkText] = useState('');
    const [layout, setLayout] = useState<LayoutType>('horizontal');
    const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFetchMetadata = async () => {
        if (!url.trim()) {
            setError('URL을 입력해주세요');
            return;
        }

        if (!isValidUrl(url)) {
            setError('올바른 URL 형식이 아닙니다');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const data = await fetchLinkMetadata(url);
            setMetadata(data);
            if (!linkText) {
                setLinkText(data.title);
            }
        } catch (err) {
            setError('메타데이터를 가져오는데 실패했습니다');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInsert = () => {
        if (!url.trim()) {
            setError('URL을 입력해주세요');
            return;
        }

        if (!isValidUrl(url)) {
            setError('올바른 URL 형식이 아닙니다');
            return;
        }

        onInsert({
            type: linkType,
            url: url.trim(),
            text: linkText.trim() || url.trim(),
            metadata: metadata || undefined,
            layout: linkType === 'preview' ? layout : undefined,
        });

        // Reset state
        setUrl('');
        setLinkText('');
        setLinkType('preview');
        setLayout('horizontal');
        setMetadata(null);
        setError('');
        onOpenChange(false);
    };

    const handleUrlChange = (value: string) => {
        setUrl(value);
        setError('');
        setMetadata(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>링크 삽입</DialogTitle>
                    <DialogDescription>
                        URL을 입력하고 표시 방식을 선택하세요
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* URL Input */}
                    <div className="space-y-2">
                        <Label htmlFor="url">URL</Label>
                        <div className="flex gap-2">
                            <Input
                                id="url"
                                placeholder="https://example.com"
                                value={url}
                                onChange={(e) => handleUrlChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isLoading) {
                                        handleFetchMetadata();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleFetchMetadata}
                                disabled={isLoading || !url.trim()}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ExternalLink className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>

                    {/* Link Type Selection */}
                    <div className="space-y-3">
                        <Label>표시 방식</Label>
                        <RadioGroup value={linkType} onValueChange={(value) => setLinkType(value as 'link' | 'preview')}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="link" id="link" />
                                <Label htmlFor="link" className="font-normal cursor-pointer flex items-center">
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    텍스트 링크
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="preview" id="preview" />
                                <Label htmlFor="preview" className="font-normal cursor-pointer flex items-center">
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    미리보기 카드
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Link Text (for text link only) */}
                    {linkType === 'link' && (
                        <div className="space-y-2">
                            <Label htmlFor="linkText">링크 텍스트 (선택)</Label>
                            <Input
                                id="linkText"
                                placeholder="링크 텍스트를 입력하세요"
                                value={linkText}
                                onChange={(e) => setLinkText(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Layout Selection (for preview card only) */}
                    {linkType === 'preview' && (
                        <div className="space-y-3">
                            <Label>카드 레이아웃</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    variant={layout === 'horizontal' ? 'default' : 'outline'}
                                    className="h-20 flex flex-col items-center justify-center"
                                    onClick={() => setLayout('horizontal')}
                                >
                                    <Layout className="h-5 w-5 mb-1" />
                                    <span className="text-xs">가로형</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={layout === 'vertical' ? 'default' : 'outline'}
                                    className="h-20 flex flex-col items-center justify-center"
                                    onClick={() => setLayout('vertical')}
                                >
                                    <Layout className="h-5 w-5 mb-1 rotate-90" />
                                    <span className="text-xs">세로형</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={layout === 'compact' ? 'default' : 'outline'}
                                    className="h-20 flex flex-col items-center justify-center"
                                    onClick={() => setLayout('compact')}
                                >
                                    <LayoutGrid className="h-5 w-5 mb-1" />
                                    <span className="text-xs">컴팩트</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={layout === 'full-image' ? 'default' : 'outline'}
                                    className="h-20 flex flex-col items-center justify-center"
                                    onClick={() => setLayout('full-image')}
                                >
                                    <ImageIcon className="h-5 w-5 mb-1" />
                                    <span className="text-xs">풀 이미지</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Metadata Preview */}
                    {metadata && linkType === 'preview' && (
                        <div className="space-y-2">
                            <Label>미리보기</Label>
                            <Card className="overflow-hidden">
                                {layout === 'horizontal' && (
                                    <div className="flex flex-col sm:flex-row">
                                        {metadata.image && (
                                            <div className="sm:w-1/3 w-full h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
                                                <img
                                                    src={metadata.image}
                                                    alt={metadata.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 p-3">
                                            <h4 className="font-semibold text-sm line-clamp-1 mb-1">
                                                {metadata.title}
                                            </h4>
                                            {metadata.description && (
                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                    {metadata.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {layout === 'vertical' && (
                                    <div className="flex flex-col">
                                        {metadata.image && (
                                            <div className="w-full h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                                                <img
                                                    src={metadata.image}
                                                    alt={metadata.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="p-3">
                                            <h4 className="font-semibold text-sm line-clamp-1 mb-1">
                                                {metadata.title}
                                            </h4>
                                            {metadata.description && (
                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                    {metadata.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {layout === 'compact' && (
                                    <div className="flex items-center gap-3 p-2">
                                        {metadata.image && (
                                            <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                                <img
                                                    src={metadata.image}
                                                    alt={metadata.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-xs line-clamp-1">
                                                {metadata.title}
                                            </h4>
                                        </div>
                                        <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    </div>
                                )}
                                {layout === 'full-image' && (
                                    <div className="relative">
                                        {metadata.image && (
                                            <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                                                <img
                                                    src={metadata.image}
                                                    alt={metadata.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-3">
                                            <h4 className="font-semibold text-sm line-clamp-1 mb-1">
                                                {metadata.title}
                                            </h4>
                                            {metadata.description && (
                                                <p className="text-xs text-white/90 line-clamp-1">
                                                    {metadata.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button type="button" onClick={handleInsert} disabled={!url.trim() || (linkType === 'preview' && !metadata && !isLoading)}>
                        삽입
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
