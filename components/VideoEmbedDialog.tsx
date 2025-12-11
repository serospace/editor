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
import { extractVideoInfo } from './VideoEmbedExtension';
import { Video, Loader2 } from 'lucide-react';

interface VideoEmbedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (data: { url: string; provider: 'youtube' | 'vimeo'; videoId: string }) => void;
}

export function VideoEmbedDialog({ open, onOpenChange, onInsert }: VideoEmbedDialogProps) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');

    const handleUrlChange = (value: string) => {
        setUrl(value);
        setError('');

        const videoInfo = extractVideoInfo(value);
        if (videoInfo.provider && videoInfo.videoId) {
            if (videoInfo.provider === 'youtube') {
                setPreviewUrl(`https://img.youtube.com/vi/${videoInfo.videoId}/maxresdefault.jpg`);
            } else {
                setPreviewUrl('');
            }
        } else {
            setPreviewUrl('');
        }
    };

    const handleInsert = () => {
        if (!url.trim()) {
            setError('URL을 입력해주세요');
            return;
        }

        const videoInfo = extractVideoInfo(url);

        if (!videoInfo.provider || !videoInfo.videoId) {
            setError('지원하지 않는 비디오 URL입니다. YouTube 또는 Vimeo 링크를 입력하세요.');
            return;
        }

        onInsert({
            url: url.trim(),
            provider: videoInfo.provider,
            videoId: videoInfo.videoId,
        });

        // Reset state
        setUrl('');
        setError('');
        setPreviewUrl('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>비디오 삽입</DialogTitle>
                    <DialogDescription>
                        YouTube 또는 Vimeo 비디오 URL을 입력하세요
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* URL Input */}
                    <div className="space-y-2">
                        <Label htmlFor="video-url">비디오 URL</Label>
                        <Input
                            id="video-url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleInsert();
                                }
                            }}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>

                    {/* Preview */}
                    {previewUrl && (
                        <div className="space-y-2">
                            <Label>미리보기</Label>
                            <div className="border rounded-lg overflow-hidden">
                                <img
                                    src={previewUrl}
                                    alt="Video preview"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>
                    )}

                    {/* Examples */}
                    <div className="text-xs text-gray-500 space-y-1">
                        <p className="font-semibold">지원 형식:</p>
                        <p>• YouTube: https://www.youtube.com/watch?v=...</p>
                        <p>• YouTube Shorts: https://www.youtube.com/shorts/...</p>
                        <p>• Vimeo: https://vimeo.com/...</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button type="button" onClick={handleInsert}>
                        삽입
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
