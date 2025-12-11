'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
    Crop,
    Square,
    Circle,
    Pen,
    Eraser,
    Download,
    X,
    Undo,
    Redo,
    Image as ImageIcon,
} from 'lucide-react';
import { Label } from '@/shared/components/ui/label';

type Tool = 'none' | 'crop' | 'mosaic' | 'rectangle' | 'circle' | 'pen' | 'eraser';

interface Point {
    x: number;
    y: number;
}

interface DrawAction {
    type: 'mosaic' | 'rectangle' | 'circle' | 'pen';
    points: Point[];
    color: string;
    lineWidth?: number;
}

interface PhotoEditorProps {
    imageFile?: File;
    imageUrl?: string;
    onSave?: (blob: Blob) => void;
    onCancel?: () => void;
}

export function PhotoEditor({ imageFile, imageUrl, onSave, onCancel }: PhotoEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [tool, setTool] = useState<Tool>('none');
    const [color, setColor] = useState('#ff0000');
    const [lineWidth, setLineWidth] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);

    // History for undo/redo
    const [history, setHistory] = useState<DrawAction[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);

    // Crop state
    const [cropArea, setCropArea] = useState<{start: Point; end: Point} | null>(null);

    // WebP quality (0.0 - 1.0)
    const [webpQuality, setWebpQuality] = useState(0.9);

    // Load image from file or URL
    useEffect(() => {
        if (imageFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => setImage(img);
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(imageFile);
        } else if (imageUrl) {
            const img = new Image();
            img.onload = () => setImage(img);
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;
        }
    }, [imageFile, imageUrl]);

    // Draw image and all actions on canvas
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw original image
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // Apply all history actions
        const actionsToApply = history.slice(0, historyStep + 1);
        actionsToApply.forEach((action) => {
            applyAction(ctx, action);
        });
    }, [image, history, historyStep]);

    // Apply a single action to canvas
    const applyAction = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
        ctx.strokeStyle = action.color;
        ctx.fillStyle = action.color;
        ctx.lineWidth = action.lineWidth || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (action.type) {
            case 'mosaic':
                applyMosaic(ctx, action.points);
                break;
            case 'rectangle':
                if (action.points.length >= 2) {
                    const [start, end] = action.points;
                    const width = end.x - start.x;
                    const height = end.y - start.y;
                    ctx.strokeRect(start.x, start.y, width, height);
                }
                break;
            case 'circle':
                if (action.points.length >= 2) {
                    const [start, end] = action.points;
                    const radius = Math.sqrt(
                        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
                    );
                    ctx.beginPath();
                    ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                }
                break;
            case 'pen':
                if (action.points.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(action.points[0].x, action.points[0].y);
                    action.points.forEach((point) => {
                        ctx.lineTo(point.x, point.y);
                    });
                    ctx.stroke();
                }
                break;
        }
    };

    // Apply mosaic effect to a region
    const applyMosaic = (ctx: CanvasRenderingContext2D, points: Point[]) => {
        if (points.length < 2) return;

        const [start, end] = points;
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        const mosaicSize = 10; // Size of mosaic blocks

        for (let mY = y; mY < y + height; mY += mosaicSize) {
            for (let mX = x; mX < x + width; mX += mosaicSize) {
                const imageData = ctx.getImageData(mX, mY, mosaicSize, mosaicSize);
                const pixels = imageData.data;

                // Calculate average color
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    r += pixels[i];
                    g += pixels[i + 1];
                    b += pixels[i + 2];
                    count++;
                }

                if (count > 0) {
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    ctx.fillRect(mX, mY, mosaicSize, mosaicSize);
                }
            }
        }
    };

    // Setup canvas when image is loaded
    useEffect(() => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const maxWidth = 800;
        const maxHeight = 600;

        let width = image.width;
        let height = image.height;

        // Scale down if too large
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        redrawCanvas();
    }, [image, redrawCanvas]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // Get mouse position relative to canvas
    const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (tool === 'none') return;

        const point = getMousePos(e);
        setIsDrawing(true);
        setStartPoint(point);

        if (tool === 'pen') {
            setCurrentPath([point]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !startPoint) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const point = getMousePos(e);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Redraw canvas to clear preview
        redrawCanvas();

        // Draw preview
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'crop') {
            // Draw crop rectangle
            const width = point.x - startPoint.x;
            const height = point.y - startPoint.y;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(startPoint.x, startPoint.y, width, height);
            ctx.setLineDash([]);
        } else if (tool === 'mosaic') {
            // Draw selection rectangle for mosaic
            const width = point.x - startPoint.x;
            const height = point.y - startPoint.y;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(startPoint.x, startPoint.y, width, height);
            ctx.setLineDash([]);
        } else if (tool === 'rectangle') {
            const width = point.x - startPoint.x;
            const height = point.y - startPoint.y;
            ctx.strokeRect(startPoint.x, startPoint.y, width, height);
        } else if (tool === 'circle') {
            const radius = Math.sqrt(
                Math.pow(point.x - startPoint.x, 2) + Math.pow(point.y - startPoint.y, 2)
            );
            ctx.beginPath();
            ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (tool === 'pen') {
            const newPath = [...currentPath, point];
            setCurrentPath(newPath);

            ctx.beginPath();
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            newPath.forEach((p) => {
                ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !startPoint) return;

        const point = getMousePos(e);
        setIsDrawing(false);

        if (tool === 'crop') {
            applyCrop(startPoint, point);
        } else if (tool === 'mosaic') {
            addToHistory({
                type: 'mosaic',
                points: [startPoint, point],
                color: color,
            });
        } else if (tool === 'rectangle') {
            addToHistory({
                type: 'rectangle',
                points: [startPoint, point],
                color: color,
                lineWidth: lineWidth,
            });
        } else if (tool === 'circle') {
            addToHistory({
                type: 'circle',
                points: [startPoint, point],
                color: color,
                lineWidth: lineWidth,
            });
        } else if (tool === 'pen' && currentPath.length > 1) {
            addToHistory({
                type: 'pen',
                points: currentPath,
                color: color,
                lineWidth: lineWidth,
            });
        }

        setStartPoint(null);
        setCurrentPath([]);
    };

    // Add action to history
    const addToHistory = (action: DrawAction) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(action);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    };

    // Undo/Redo
    const handleUndo = () => {
        if (historyStep > -1) {
            setHistoryStep(historyStep - 1);
        }
    };

    const handleRedo = () => {
        if (historyStep < history.length - 1) {
            setHistoryStep(historyStep + 1);
        }
    };

    // Apply crop
    const applyCrop = (start: Point, end: Point) => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        // Get cropped image data
        const imageData = ctx.getImageData(x, y, width, height);

        // Resize canvas
        canvas.width = width;
        canvas.height = height;

        // Draw cropped image
        ctx.putImageData(imageData, 0, 0);

        // Create new image from cropped canvas
        const croppedImage = new Image();
        croppedImage.onload = () => {
            setImage(croppedImage);
            setHistory([]);
            setHistoryStep(-1);
        };
        croppedImage.src = canvas.toDataURL();
    };

    // Load image from file input
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => setImage(img);
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    // Save edited image as WebP
    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (blob && onSave) {
                onSave(blob);
            }
        }, 'image/webp', webpQuality);
    };

    // Download edited image as WebP
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = 'edited-image.webp';
        link.href = canvas.toDataURL('image/webp', webpQuality);
        link.click();
    };

    return (
        <div className="p-4 w-full h-full flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">사진 편집기</h2>
                    {onCancel && (
                        <Button variant="ghost" size="sm" onClick={onCancel}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 p-4 bg-gray-50 rounded-lg border">
                    {/* File Upload */}
                    {!imageFile && !imageUrl && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <ImageIcon className="h-4 w-4 mr-2" />
                                이미지 선택
                            </Button>
                            <div className="w-px h-8 bg-gray-300" />
                        </>
                    )}

                    {/* Undo/Redo */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUndo}
                        disabled={historyStep < 0}
                    >
                        <Undo className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRedo}
                        disabled={historyStep >= history.length - 1}
                    >
                        <Redo className="h-4 w-4" />
                    </Button>

                    <div className="w-px h-8 bg-gray-300" />

                    {/* Tools */}
                    <Button
                        variant={tool === 'crop' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTool('crop')}
                    >
                        <Crop className="h-4 w-4 mr-1" />
                        크롭
                    </Button>
                    <Button
                        variant={tool === 'mosaic' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTool('mosaic')}
                    >
                        <Eraser className="h-4 w-4 mr-1" />
                        모자이크
                    </Button>
                    <Button
                        variant={tool === 'rectangle' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTool('rectangle')}
                    >
                        <Square className="h-4 w-4 mr-1" />
                        사각형
                    </Button>
                    <Button
                        variant={tool === 'circle' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTool('circle')}
                    >
                        <Circle className="h-4 w-4 mr-1" />
                        원형
                    </Button>
                    <Button
                        variant={tool === 'pen' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTool('pen')}
                    >
                        <Pen className="h-4 w-4 mr-1" />
                        펜
                    </Button>

                    <div className="w-px h-8 bg-gray-300" />

                    {/* Color Picker */}
                    <div className="flex items-center gap-2">
                        <Label htmlFor="color-picker" className="text-sm">색상:</Label>
                        <input
                            id="color-picker"
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-8 w-12 rounded border cursor-pointer"
                        />
                    </div>

                    {/* Line Width */}
                    <div className="flex items-center gap-2">
                        <Label htmlFor="line-width" className="text-sm">굵기:</Label>
                        <input
                            id="line-width"
                            type="range"
                            min="1"
                            max="20"
                            value={lineWidth}
                            onChange={(e) => setLineWidth(Number(e.target.value))}
                            className="w-24"
                        />
                        <span className="text-sm w-6">{lineWidth}</span>
                    </div>

                    <div className="w-px h-8 bg-gray-300 mx-1" />

                    {/* WebP Quality */}
                    <div className="flex items-center gap-2">
                        <Label htmlFor="webp-quality" className="text-sm">품질:</Label>
                        <input
                            id="webp-quality"
                            type="range"
                            min="0.5"
                            max="1.0"
                            step="0.05"
                            value={webpQuality}
                            onChange={(e) => setWebpQuality(Number(e.target.value))}
                            className="w-24"
                        />
                        <span className="text-sm w-8">{Math.round(webpQuality * 100)}%</span>
                    </div>

                    <div className="flex-1" />

                    {/* Save/Download */}
                    <Button variant="outline" size="sm" onClick={handleDownload} disabled={!image}>
                        <Download className="h-4 w-4 mr-2" />
                        다운로드
                    </Button>
                    {onSave && (
                        <Button size="sm" onClick={handleSave} disabled={!image}>
                            저장
                        </Button>
                    )}
                </div>

                {/* Canvas */}
                <div className="border rounded-lg bg-gray-100 p-4 flex items-center justify-center flex-1 min-h-0">
                    {image ? (
                        <canvas
                            ref={canvasRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            className="max-w-full max-h-full border bg-white cursor-crosshair"
                        />
                    ) : (
                        <div className="text-gray-400 text-center">
                            <ImageIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
                            <p>이미지를 선택해주세요</p>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                {image && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                        <p className="font-semibold mb-1">사용 방법:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>크롭:</strong> 영역을 드래그하여 이미지를 자를 수 있습니다</li>
                            <li><strong>모자이크:</strong> 영역을 드래그하여 모자이크 처리합니다</li>
                            <li><strong>사각형/원형:</strong> 드래그하여 도형을 그립니다</li>
                            <li><strong>펜:</strong> 자유롭게 선을 그립니다</li>
                            <li><strong>품질:</strong> 저장 시 WebP 압축 품질을 조절합니다 (50~100%)</li>
                        </ul>
                        <p className="mt-2 text-xs text-gray-500">
                            💡 최종 이미지는 WebP 포맷으로 저장되어 용량이 크게 줄어듭니다
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
