'use client';

import { useState, useCallback } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PhotoEditor } from './PhotoEditor';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { setUrlToKeyMapping } from './CustomImageExtension';

interface ImageUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (imageUrl: string) => void;
    spaceAlias?: string;
    menuShortId?: string;
    targetShortId?: string;
}

interface PresignedUploadUrlResponse {
    uploadUrl: string;
    publicUrl: string;
    fileKey: string;
}

export function ImageUploadDialog({
    open,
    onOpenChange,
    onInsert,
    spaceAlias,
    menuShortId,
    targetShortId
}: ImageUploadDialogProps) {
    const [selectedFile, setSelectedFile] = useState<File | undefined>();
    const [imageUrl, setImageUrl] = useState('');
    const [showEditor, setShowEditor] = useState(false);
    const [currentImageSource, setCurrentImageSource] = useState<'file' | 'url'>('file');
    const [isUploading, setIsUploading] = useState(false);

    // 파일을 WebP로 변환
    const convertToWebP = useCallback((file: File | Blob, quality: number = 0.85): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to convert to WebP'));
                        }
                    },
                    'image/webp',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setCurrentImageSource('file');
        }
    };

    const handleOpenEditor = () => {
        if (currentImageSource === 'file' && selectedFile) {
            setShowEditor(true);
        } else if (currentImageSource === 'url' && imageUrl) {
            setShowEditor(true);
        }
    };

    // WebP로 변환 후 R2에 업로드
    const uploadToR2 = async (file: File | Blob, originalFileName: string): Promise<{ publicUrl: string; fileKey: string }> => {
        if (!spaceAlias) {
            throw new Error('spaceAlias is required for file upload');
        }
        if (!targetShortId) {
            throw new Error('targetShortId is required for file upload');
        }

        // WebP로 변환
        const webpBlob = await convertToWebP(file);
        const fileName = originalFileName.replace(/\.[^/.]+$/, '.webp');

        const response = await api<PresignedUploadUrlResponse>(`/api/spaces/${spaceAlias}/menus/${menuShortId}/files/upload-url`, {
            method: 'POST',
            body: JSON.stringify({
                targetShortId,
                fileName,
                contentType: 'image/webp',
            }),
        });

        await fetch(response.uploadUrl, {
            method: 'PUT',
            body: webpBlob,
            headers: {
                'Content-Type': 'image/webp',
            },
        });

        // URL-Key 매핑 저장 (대표 이미지 설정용)
        setUrlToKeyMapping(response.publicUrl, response.fileKey);

        return { publicUrl: response.publicUrl, fileKey: response.fileKey };
    };

    const handleInsertDirect = async () => {
        if (currentImageSource === 'file' && selectedFile) {
            if (!spaceAlias) {
                // spaceAlias 없으면 base64로 변환 (WebP)
                try {
                    const webpBlob = await convertToWebP(selectedFile);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64 = e.target?.result as string;
                        onInsert(base64);
                        handleClose();
                    };
                    reader.readAsDataURL(webpBlob);
                } catch (error) {
                    console.error('WebP 변환 실패:', error);
                }
                return;
            }

            setIsUploading(true);
            try {
                const { publicUrl } = await uploadToR2(selectedFile, selectedFile.name);
                onInsert(publicUrl);
                handleClose();
            } catch (error) {
                console.error('이미지 업로드 실패:', error);
            } finally {
                setIsUploading(false);
            }
        } else if (currentImageSource === 'url' && imageUrl) {
            onInsert(imageUrl);
            handleClose();
        }
    };

    const handleSaveFromEditor = async (blob: Blob) => {
        if (!spaceAlias) {
            // PhotoEditor는 이미 WebP로 반환하므로 그대로 사용
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                onInsert(base64);
                handleClose();
            };
            reader.readAsDataURL(blob);
            return;
        }

        if (!targetShortId) {
            console.error('targetShortId is required for file upload');
            return;
        }

        setIsUploading(true);
        try {
            const fileName = `edited-${Date.now()}.webp`;
            // PhotoEditor에서 이미 WebP로 반환하므로 직접 업로드
            const response = await api<PresignedUploadUrlResponse>(`/api/spaces/${spaceAlias}/menus/${menuShortId}/files/upload-url`, {
                method: 'POST',
                body: JSON.stringify({
                    targetShortId,
                    fileName,
                    contentType: 'image/webp',
                }),
            });

            await fetch(response.uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: {
                    'Content-Type': 'image/webp',
                },
            });

            // URL-Key 매핑 저장 (대표 이미지 설정용)
            setUrlToKeyMapping(response.publicUrl, response.fileKey);

            onInsert(response.publicUrl);
            handleClose();
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(undefined);
        setImageUrl('');
        setShowEditor(false);
        setCurrentImageSource('file');
        setIsUploading(false);
        onOpenChange(false);
    };

    const handleCancelEditor = () => {
        setShowEditor(false);
    };

    const canOpenEditor =
        (currentImageSource === 'file' && selectedFile) ||
        (currentImageSource === 'url' && imageUrl);

    const canInsertDirect = canOpenEditor;

    if (showEditor) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="!max-w-[95vw] !h-[95vh] p-0 gap-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>이미지 편집</DialogTitle>
                    </DialogHeader>
                    <PhotoEditor
                        imageFile={currentImageSource === 'file' ? selectedFile : undefined}
                        imageUrl={currentImageSource === 'url' ? imageUrl : undefined}
                        onSave={handleSaveFromEditor}
                        onCancel={handleCancelEditor}
                    />
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>이미지 삽입</DialogTitle>
                    <DialogDescription>
                        파일을 업로드하거나 URL을 입력하세요
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload" onClick={() => setCurrentImageSource('file')}>
                            <Upload className="h-4 w-4 mr-2" />
                            파일 업로드
                        </TabsTrigger>
                        <TabsTrigger value="url" onClick={() => setCurrentImageSource('url')}>
                            <LinkIcon className="h-4 w-4 mr-2" />
                            URL 입력
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="image-file">이미지 파일</Label>
                            <Input
                                id="image-file"
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                disabled={isUploading}
                            />
                            {selectedFile && (
                                <p className="text-sm text-gray-600">
                                    선택됨: {selectedFile.name}
                                </p>
                            )}
                        </div>

                        {selectedFile && (
                            <div className="border rounded-lg p-2 bg-gray-50">
                                <img
                                    src={URL.createObjectURL(selectedFile)}
                                    alt="Preview"
                                    className="max-h-48 mx-auto"
                                />
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="url" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="image-url">이미지 URL</Label>
                            <Input
                                id="image-url"
                                placeholder="https://example.com/image.jpg"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                disabled={isUploading}
                            />
                        </div>

                        {imageUrl && (
                            <div className="border rounded-lg p-2 bg-gray-50">
                                <img
                                    src={imageUrl}
                                    alt="Preview"
                                    className="max-h-48 mx-auto"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="flex gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isUploading}
                    >
                        취소
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleInsertDirect}
                        disabled={!canInsertDirect || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                업로드 중...
                            </>
                        ) : (
                            '바로 삽입'
                        )}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleOpenEditor}
                        disabled={!canOpenEditor || isUploading}
                    >
                        편집 후 삽입
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
