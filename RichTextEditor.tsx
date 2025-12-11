'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { FontSize } from './FontSizeExtension';
import { LinkPreview } from './LinkPreviewExtension';
import { VideoEmbed } from './VideoEmbedExtension';
import { CustomImage, setGlobalThumbnailUrl, getGlobalThumbnailUrl, setUrlToKeyMapping, getGlobalThumbnailKey, setGlobalThumbnailKey } from './CustomImageExtension';
import { CustomBlockquote, BlockquoteStyle } from './BlockquoteExtension';
import { CustomHorizontalRule, HorizontalRuleStyle } from './HorizontalRuleExtension';
import { Button } from '@/shared/components/ui/button';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Link as LinkIcon,
    Image as ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Highlighter,
    Sparkles,
    Palette,
    ExternalLink,
    Video,
    Minus,
    Settings,
    Type,
} from 'lucide-react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { AIGenerateDialog } from './AIGenerateDialog';
import { LinkPreviewDialog } from './LinkPreviewDialog';
import { VideoEmbedDialog } from './VideoEmbedDialog';
import { PhotoEditor } from './PhotoEditor';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { api } from '@/shared/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Label } from '@/shared/components/ui/label';
import { toast } from 'sonner';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    title?: string;
    onTitleChange?: (title: string) => void;
    titlePlaceholder?: string;
    showTitle?: boolean;
    spaceAlias?: string;
    menuShortId?: string;
    targetShortId?: string;
    isInitializingDraft?: boolean;
    onRequestDraftInit?: () => Promise<string | undefined>; // 초안 생성 요청 콜백, postId 반환
    thumbnailUrl?: string | null;
    onThumbnailChange?: (url: string | null) => void;
    thumbnailKey?: string | null;
    onThumbnailKeyChange?: (key: string | null) => void;
}

// 기본 폰트 크기 설정
const DEFAULT_FONT_SIZES = {
    h1: '32px',
    h2: '24px',
    h3: '20px',
    body: '16px',
};

// 기본 색상 설정
const DEFAULT_COLORS = {
    default: '#000000',    // 기본 글자색
    accent: '#3b82f6',     // 선택/강조 글자색
    highlight: '#fef08a',  // 배경색
};

// 프리셋 색상 팔레트
const COLOR_PRESETS = {
    text: ['#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'],
    highlight: ['#fef08a', '#fde047', '#bef264', '#86efac', '#7dd3fc', '#c4b5fd', '#f9a8d4', '#fed7aa', '#fecaca', '#e5e7eb'],
};

export function RichTextEditor({
    content,
    onChange,
    placeholder = '내용을 입력하세요...',
    title = '',
    onTitleChange,
    titlePlaceholder = '제목을 입력하세요',
    showTitle = true,
    spaceAlias,
    menuShortId,
    targetShortId,
    isInitializingDraft = false,
    thumbnailUrl,
    onThumbnailChange,
    thumbnailKey,
    onThumbnailKeyChange,
}: RichTextEditorProps) {
    const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
    const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false);
    const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
    const [onImageEditSave, setOnImageEditSave] = useState<((newSrc: string) => void) | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [colors, setColors] = useState(DEFAULT_COLORS);
    const [activeColorType, setActiveColorType] = useState<'default' | 'accent' | 'highlight'>('default');
    const [fontSizes, setFontSizes] = useState(DEFAULT_FONT_SIZES);
    const [countMode, setCountMode] = useState<'char' | 'word'>('char');

    // 초기 thumbnailUrl 동기화 및 변경 감지
    useEffect(() => {
        // props에서 받은 thumbnailUrl로 전역 상태 초기화
        if (thumbnailUrl !== undefined) {
            setGlobalThumbnailUrl(thumbnailUrl);
        }
        // props에서 받은 thumbnailKey로 전역 상태 초기화
        if (thumbnailKey !== undefined) {
            setGlobalThumbnailKey(thumbnailKey);
        }
    }, [thumbnailUrl, thumbnailKey]);

    // 전역 thumbnailUrl/thumbnailKey 변경 시 부모에게 알림
    useEffect(() => {
        const interval = setInterval(() => {
            const currentGlobalThumbnail = getGlobalThumbnailUrl();
            const currentGlobalKey = getGlobalThumbnailKey();
            if (currentGlobalThumbnail !== thumbnailUrl && onThumbnailChange) {
                onThumbnailChange(currentGlobalThumbnail);
            }
            if (currentGlobalKey !== thumbnailKey && onThumbnailKeyChange) {
                onThumbnailKeyChange(currentGlobalKey);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [thumbnailUrl, onThumbnailChange, thumbnailKey, onThumbnailKeyChange]);

    // 이미지 편집 핸들러
    const handleEditImage = useCallback((src: string, onSave: (newSrc: string) => void) => {
        setEditingImageUrl(src);
        setOnImageEditSave(() => onSave);
        setIsPhotoEditorOpen(true);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                horizontalRule: false,
                blockquote: false,
            }),
            CustomBlockquote,
            Underline,
            TextStyle,
            Color,
            FontSize,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({
                types: ['heading', 'paragraph', 'image'],
            }),
            Link.configure({
                openOnClick: false,
            }),
            CustomImage,
            CustomHorizontalRule,
            LinkPreview,
            VideoEmbed,
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'sero-prose focus:outline-none min-h-[400px] max-w-none',
                style: 'font-size: 16px;',
            },
        },
    });

    // content prop이 변경되면 에디터 업데이트
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [editor, content]);

    const handleLinkInsert = useCallback((data: {
        type: 'link' | 'preview';
        url: string;
        text?: string;
        metadata?: { title: string; description?: string; image?: string };
        layout?: string
    }) => {
        if (!editor) return;

        if (data.type === 'link') {
            // Insert as text link
            const { selection } = editor.state;
            const hasSelection = selection.from !== selection.to;

            if (hasSelection) {
                // If text is selected, make it a link
                editor.chain().focus().setLink({ href: data.url }).run();
            } else {
                // Otherwise insert new text with link
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: 'text',
                        text: data.text || data.url,
                        marks: [{ type: 'link', attrs: { href: data.url } }],
                    })
                    .run();
            }
        } else if (data.type === 'preview' && data.metadata) {
            // Insert as preview card
            editor
                .chain()
                .focus()
                .insertContent({
                    type: 'linkPreview',
                    attrs: {
                        url: data.url,
                        title: data.metadata.title,
                        description: data.metadata.description || '',
                        image: data.metadata.image || '',
                        layout: data.layout || 'horizontal',
                    },
                })
                .run();
        }
    }, [editor]);

    // 파일을 WebP로 변환
    const convertToWebP = useCallback((file: File, quality: number = 0.85): Promise<Blob> => {
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

    // 이미지 파일 선택 핸들러
    const handleImageFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editor || !spaceAlias) return;

        // targetShortId가 없으면 이미지 업로드 불가
        if (!targetShortId) {
            console.error('targetShortId is required for image upload. Please wait for draft initialization.');
            toast.error('잠시 후 다시 시도해주세요. 초안을 준비하는 중입니다.');
            e.target.value = '';
            return;
        }

        try {
            // WebP로 변환
            const webpBlob = await convertToWebP(file);

            // R2에 업로드
            interface PresignedUploadUrlResponse {
                uploadUrl: string;
                publicUrl: string;
                fileKey: string;
            }

            const response = await api<PresignedUploadUrlResponse>(`/api/spaces/${spaceAlias}/menus/${menuShortId}/files/upload-url`, {
                method: 'POST',
                body: JSON.stringify({
                    targetShortId: targetShortId || null,
                    fileName: file.name.replace(/\.[^/.]+$/, '.webp'),
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

            // fileKey에서 파일명만 추출 (DB에는 파일명만 저장)
            const filename = response.fileKey ? (response.fileKey.split('/').pop() || response.fileKey) : null;

            // URL-Key 매핑 저장 (대표 이미지 설정 시 파일명 추적용)
            if (filename) {
                setUrlToKeyMapping(response.publicUrl, filename);
            }

            // 이미지 삽입 후 새 paragraph를 추가하여 커서 이동
            editor.chain().focus().insertContent([
                { type: 'image', attrs: { src: response.publicUrl } },
                { type: 'paragraph' },
            ]).run();

            // 대표 이미지가 없으면 첫 번째 이미지를 자동으로 대표로 설정
            if (!getGlobalThumbnailUrl()) {
                setGlobalThumbnailUrl(response.publicUrl);
                onThumbnailChange?.(response.publicUrl);
                if (filename) {
                    onThumbnailKeyChange?.(filename);
                }
            }
        } catch (error) {
            console.error('이미지 업로드 실패:', error);
        }

        // input 초기화 (같은 파일 재선택 가능하도록)
        e.target.value = '';
    }, [editor, spaceAlias, menuShortId, targetShortId, convertToWebP]);

    const handleVideoInsert = useCallback((data: { url: string; provider: 'youtube' | 'vimeo'; videoId: string }) => {
        if (!editor) return;

        editor
            .chain()
            .focus()
            .insertContent({
                type: 'videoEmbed',
                attrs: {
                    url: data.url,
                    provider: data.provider,
                    videoId: data.videoId,
                },
            })
            .run();
    }, [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="h-full flex flex-col border rounded-lg overflow-hidden bg-white">
            {/* Toolbar */}
            <div className="flex-shrink-0 border-b bg-gray-50/50 p-2 flex flex-wrap gap-1">
                {/* 1. H1/H2/H3 설정 */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (editor.isActive('heading', { level: 1 })) {
                            editor.chain().focus().toggleHeading({ level: 1 }).unsetFontSize().run();
                        } else {
                            editor.chain().focus().toggleHeading({ level: 1 }).setFontSize(fontSizes.h1).run();
                        }
                    }}
                    className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
                    title={`H1 (${fontSizes.h1})`}
                >
                    <Heading1 className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (editor.isActive('heading', { level: 2 })) {
                            editor.chain().focus().toggleHeading({ level: 2 }).unsetFontSize().run();
                        } else {
                            editor.chain().focus().toggleHeading({ level: 2 }).setFontSize(fontSizes.h2).run();
                        }
                    }}
                    className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
                    title={`H2 (${fontSizes.h2})`}
                >
                    <Heading2 className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (editor.isActive('heading', { level: 3 })) {
                            editor.chain().focus().toggleHeading({ level: 3 }).unsetFontSize().run();
                        } else {
                            editor.chain().focus().toggleHeading({ level: 3 }).setFontSize(fontSizes.h3).run();
                        }
                    }}
                    className={`h-8 w-8 p-0 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''}`}
                    title={`H3 (${fontSizes.h3})`}
                >
                    <Heading3 className="h-5 w-5" />
                </Button>

                <div className="w-px h-8 bg-gray-300 mx-1" />

                {/* 2. 진하기, 기울기, 밑줄, 중간줄, 강조 글자색, 배경색 */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
                >
                    <Bold className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
                >
                    <Italic className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`h-8 w-8 p-0 ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
                >
                    <UnderlineIcon className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`h-8 w-8 p-0 ${editor.isActive('strike') ? 'bg-gray-200' : ''}`}
                >
                    <Strikethrough className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        const currentColor = editor.getAttributes('textStyle').color;
                        if (currentColor === colors.accent) {
                            editor.chain().focus().setColor(colors.default).run();
                        } else {
                            editor.chain().focus().setColor(colors.accent).run();
                        }
                    }}
                    className={`h-8 w-8 p-0 relative ${editor.getAttributes('textStyle').color === colors.accent ? 'bg-gray-200' : ''}`}
                    title="강조 글자색 (토글)"
                >
                    <Type className="h-5 w-5" />
                    <div
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded"
                        style={{ backgroundColor: colors.accent }}
                    />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHighlight({ color: colors.highlight }).run()}
                    className={`h-8 w-8 p-0 relative ${editor.isActive('highlight') ? 'bg-gray-200' : ''}`}
                    title="배경색"
                >
                    <Highlighter className="h-5 w-5" />
                    <div
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded"
                        style={{ backgroundColor: colors.highlight }}
                    />
                </Button>
                <div className="w-px h-8 bg-gray-300 mx-1" />

                {/* 4. 정렬/목록/인용구/구분선 그룹 */}
                {/* 정렬 드롭다운 */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                        >
                            {editor.isActive({ textAlign: 'center' }) ? (
                                <AlignCenter className="h-5 w-5" />
                            ) : editor.isActive({ textAlign: 'right' }) ? (
                                <AlignRight className="h-5 w-5" />
                            ) : (
                                <AlignLeft className="h-5 w-5" />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1">
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                                className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
                            >
                                <AlignLeft className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                                className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
                            >
                                <AlignCenter className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                                className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
                            >
                                <AlignRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* 목록 드롭다운 */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 ${editor.isActive('bulletList') || editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
                        >
                            {editor.isActive('orderedList') ? (
                                <ListOrdered className="h-5 w-5" />
                            ) : (
                                <List className="h-5 w-5" />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1">
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
                            >
                                <List className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
                            >
                                <ListOrdered className="h-5 w-5" />
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* 인용구 드롭다운 */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
                        >
                            <Quote className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1">
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (editor.isActive('blockquote', { style: 'default' })) {
                                        editor.chain().focus().lift('blockquote').run();
                                    } else if (editor.isActive('blockquote')) {
                                        editor.chain().focus().updateAttributes('blockquote', { style: 'default' }).run();
                                    } else {
                                        editor.chain().focus().setBlockquote().updateAttributes('blockquote', { style: 'default' }).run();
                                    }
                                }}
                                className={`h-8 w-8 p-0 ${editor.isActive('blockquote', { style: 'default' }) ? 'bg-gray-200' : ''}`}
                                title="왼쪽 세로줄"
                            >
                                <div className="w-4 h-3 border-l-2 border-gray-400 bg-gray-100 rounded-r" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (editor.isActive('blockquote', { style: 'bordered' })) {
                                        editor.chain().focus().lift('blockquote').run();
                                    } else if (editor.isActive('blockquote')) {
                                        editor.chain().focus().updateAttributes('blockquote', { style: 'bordered' }).run();
                                    } else {
                                        editor.chain().focus().setBlockquote().updateAttributes('blockquote', { style: 'bordered' }).run();
                                    }
                                }}
                                className={`h-8 w-8 p-0 ${editor.isActive('blockquote', { style: 'bordered' }) ? 'bg-gray-200' : ''}`}
                                title="테두리"
                            >
                                <div className="w-4 h-3 border border-gray-300 rounded" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (editor.isActive('blockquote', { style: 'quote' })) {
                                        editor.chain().focus().lift('blockquote').run();
                                    } else if (editor.isActive('blockquote')) {
                                        editor.chain().focus().updateAttributes('blockquote', { style: 'quote' }).run();
                                    } else {
                                        editor.chain().focus().setBlockquote().updateAttributes('blockquote', { style: 'quote' }).run();
                                    }
                                }}
                                className={`h-8 w-8 p-0 ${editor.isActive('blockquote', { style: 'quote' }) ? 'bg-gray-200' : ''}`}
                                title="따옴표"
                            >
                                <span className="text-gray-400 font-serif text-sm">"</span>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (editor.isActive('blockquote', { style: 'bubble' })) {
                                        editor.chain().focus().lift('blockquote').run();
                                    } else if (editor.isActive('blockquote')) {
                                        editor.chain().focus().updateAttributes('blockquote', { style: 'bubble' }).run();
                                    } else {
                                        editor.chain().focus().setBlockquote().updateAttributes('blockquote', { style: 'bubble' }).run();
                                    }
                                }}
                                className={`h-8 w-8 p-0 ${editor.isActive('blockquote', { style: 'bubble' }) ? 'bg-gray-200' : ''}`}
                                title="말풍선"
                            >
                                <div className="w-4 h-3 bg-gray-200 rounded-full relative">
                                    <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[2px] border-t-transparent border-b-[2px] border-b-transparent border-r-[3px] border-r-gray-200" />
                                </div>
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* 구분선 드롭다운 */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="구분선 삽입"
                        >
                            <Minus className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1">
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().insertContent([
                                        { type: 'paragraph' },
                                        { type: 'horizontalRule', attrs: { style: 'solid' } },
                                        { type: 'paragraph' },
                                    ]).run();
                                }}
                                className="h-8 w-8 p-0"
                                title="실선"
                            >
                                <div className="w-5 h-[1px] bg-gray-400" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().insertContent([
                                        { type: 'paragraph' },
                                        { type: 'horizontalRule', attrs: { style: 'short' } },
                                        { type: 'paragraph' },
                                    ]).run();
                                }}
                                className="h-8 w-8 p-0"
                                title="짧은 선"
                            >
                                <div className="w-3 h-[1px] bg-gray-400" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().insertContent([
                                        { type: 'paragraph' },
                                        { type: 'horizontalRule', attrs: { style: 'dashed' } },
                                        { type: 'paragraph' },
                                    ]).run();
                                }}
                                className="h-8 w-8 p-0"
                                title="점선"
                            >
                                <div className="w-5 border-t border-dashed border-gray-400" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().insertContent([
                                        { type: 'paragraph' },
                                        { type: 'horizontalRule', attrs: { style: 'dotted' } },
                                        { type: 'paragraph' },
                                    ]).run();
                                }}
                                className="h-8 w-8 p-0"
                                title="점점점"
                            >
                                <div className="w-5 border-t-2 border-dotted border-gray-400" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().insertContent([
                                        { type: 'paragraph' },
                                        { type: 'horizontalRule', attrs: { style: 'gradient' } },
                                        { type: 'paragraph' },
                                    ]).run();
                                }}
                                className="h-8 w-8 p-0"
                                title="그라데이션"
                            >
                                <div className="w-5 h-[1px] bg-gradient-to-r from-transparent via-gray-400 to-transparent" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    editor.chain().focus().insertContent([
                                        { type: 'paragraph' },
                                        { type: 'horizontalRule', attrs: { style: 'stars' } },
                                        { type: 'paragraph' },
                                    ]).run();
                                }}
                                className="h-8 w-8 p-0 text-gray-400 text-[10px]"
                                title="별"
                            >
                                ✦✦✦
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="w-px h-8 bg-gray-300 mx-1" />

                {/* 5. 이미지, 동영상, 링크 그룹 */}
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileSelect}
                    className="hidden"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        if (isInitializingDraft) {
                            toast.error('잠시 후 다시 시도해주세요. 초안을 준비하는 중입니다.');
                            return;
                        }
                        imageInputRef.current?.click();
                    }}
                    className={`h-8 w-8 p-0 ${isInitializingDraft ? 'opacity-50' : ''}`}
                    title={isInitializingDraft ? '초안 준비 중...' : '이미지 삽입'}
                >
                    <ImageIcon className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsVideoDialogOpen(true)}
                    className="h-8 w-8 p-0"
                    title="비디오 삽입"
                >
                    <Video className="h-5 w-5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLinkDialogOpen(true)}
                    className="h-8 w-8 p-0"
                    title="링크/미리보기 삽입"
                >
                    <ExternalLink className="h-5 w-5" />
                </Button>

                <div className="w-px h-8 bg-gray-300 mx-1" />

                {/* 6. AI 생성 */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAIDialogOpen(true)}
                    className="h-8 px-2 text-sm font-medium"
                    title="AI 생성"
                >
                    AI
                </Button>

                <div className="flex-1" />

                {/* 7. 글자수/단어수 표시 */}
                <div className="text-xs text-gray-400 px-2 flex items-center h-8">
                    {(() => {
                        const text = editor?.getText() || '';
                        if (countMode === 'char') {
                            const charCount = text.replace(/\s/g, '').length;
                            return `${charCount}자`;
                        } else {
                            const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
                            return `${wordCount}단어`;
                        }
                    })()}
                </div>

                {/* 8. 설정 (폰트 크기 + 색상) */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="설정"
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <Label className="font-medium">폰트 크기</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">H1</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border hover:border-gray-400 transition flex items-center justify-center text-sm"
                                                >
                                                    {fontSizes.h1.replace('px', '')}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-1">
                                                <div className="flex flex-col">
                                                    {['24px', '28px', '32px', '36px', '40px', '48px'].map((size) => (
                                                        <button
                                                            key={size}
                                                            type="button"
                                                            className={`px-3 py-1 text-sm hover:bg-gray-100 rounded ${fontSizes.h1 === size ? 'bg-gray-200' : ''}`}
                                                            onClick={() => setFontSizes(prev => ({ ...prev, h1: size }))}
                                                        >
                                                            {size.replace('px', '')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">H2</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border hover:border-gray-400 transition flex items-center justify-center text-sm"
                                                >
                                                    {fontSizes.h2.replace('px', '')}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-1">
                                                <div className="flex flex-col">
                                                    {['18px', '20px', '24px', '28px', '32px'].map((size) => (
                                                        <button
                                                            key={size}
                                                            type="button"
                                                            className={`px-3 py-1 text-sm hover:bg-gray-100 rounded ${fontSizes.h2 === size ? 'bg-gray-200' : ''}`}
                                                            onClick={() => setFontSizes(prev => ({ ...prev, h2: size }))}
                                                        >
                                                            {size.replace('px', '')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">H3</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border hover:border-gray-400 transition flex items-center justify-center text-sm"
                                                >
                                                    {fontSizes.h3.replace('px', '')}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-1">
                                                <div className="flex flex-col">
                                                    {['16px', '18px', '20px', '24px'].map((size) => (
                                                        <button
                                                            key={size}
                                                            type="button"
                                                            className={`px-3 py-1 text-sm hover:bg-gray-100 rounded ${fontSizes.h3 === size ? 'bg-gray-200' : ''}`}
                                                            onClick={() => setFontSizes(prev => ({ ...prev, h3: size }))}
                                                        >
                                                            {size.replace('px', '')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">본문</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border hover:border-gray-400 transition flex items-center justify-center text-sm"
                                                >
                                                    {fontSizes.body.replace('px', '')}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-1">
                                                <div className="flex flex-col">
                                                    {['14px', '16px', '18px', '20px'].map((size) => (
                                                        <button
                                                            key={size}
                                                            type="button"
                                                            className={`px-3 py-1 text-sm hover:bg-gray-100 rounded ${fontSizes.body === size ? 'bg-gray-200' : ''}`}
                                                            onClick={() => setFontSizes(prev => ({ ...prev, body: size }))}
                                                        >
                                                            {size.replace('px', '')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t pt-4 space-y-3">
                                <Label className="font-medium">색상</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">기본</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border-2 hover:border-gray-400 transition flex items-center justify-center gap-1"
                                                    style={{ backgroundColor: colors.default }}
                                                >
                                                    <span className="text-xs font-bold" style={{ color: colors.default === '#000000' ? '#fff' : '#000' }}>A</span>
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2">
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {COLOR_PRESETS.text.map((color) => (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                className={`w-6 h-6 rounded border hover:scale-110 transition ${colors.default === color ? 'ring-2 ring-primary' : ''}`}
                                                                style={{ backgroundColor: color }}
                                                                onClick={() => setColors(prev => ({ ...prev, default: color }))}
                                                            />
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="color"
                                                        value={colors.default}
                                                        onChange={(e) => setColors(prev => ({ ...prev, default: e.target.value }))}
                                                        className="w-full h-6 rounded cursor-pointer"
                                                    />
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">강조</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border-2 hover:border-gray-400 transition flex items-center justify-center gap-1"
                                                    style={{ backgroundColor: colors.accent }}
                                                >
                                                    <span className="text-xs font-bold text-white">A</span>
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2">
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {COLOR_PRESETS.text.map((color) => (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                className={`w-6 h-6 rounded border hover:scale-110 transition ${colors.accent === color ? 'ring-2 ring-primary' : ''}`}
                                                                style={{ backgroundColor: color }}
                                                                onClick={() => setColors(prev => ({ ...prev, accent: color }))}
                                                            />
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="color"
                                                        value={colors.accent}
                                                        onChange={(e) => setColors(prev => ({ ...prev, accent: e.target.value }))}
                                                        className="w-full h-6 rounded cursor-pointer"
                                                    />
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-gray-500">배경</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="w-full h-8 rounded border-2 hover:border-gray-400 transition flex items-center justify-center"
                                                    style={{ backgroundColor: colors.highlight }}
                                                >
                                                    <Highlighter className="h-3 w-3 text-gray-600" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2">
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {COLOR_PRESETS.highlight.map((color) => (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                className={`w-6 h-6 rounded border hover:scale-110 transition ${colors.highlight === color ? 'ring-2 ring-primary' : ''}`}
                                                                style={{ backgroundColor: color }}
                                                                onClick={() => setColors(prev => ({ ...prev, highlight: color }))}
                                                            />
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="color"
                                                        value={colors.highlight}
                                                        onChange={(e) => setColors(prev => ({ ...prev, highlight: e.target.value }))}
                                                        className="w-full h-6 rounded cursor-pointer"
                                                    />
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => setColors(DEFAULT_COLORS)}
                                >
                                    색상 초기화
                                </Button>
                            </div>
                            <div className="border-t pt-4 space-y-3">
                                <Label className="font-medium">글자 수 표시</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={countMode === 'char' ? 'default' : 'outline'}
                                        size="sm"
                                        className="flex-1 text-xs"
                                        onClick={() => setCountMode('char')}
                                    >
                                        글자 수
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={countMode === 'word' ? 'default' : 'outline'}
                                        size="sm"
                                        className="flex-1 text-xs"
                                        onClick={() => setCountMode('word')}
                                    >
                                        단어 수
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Editor Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-[72px] py-12">
                {/* Title Input */}
                {showTitle && (
                    <div className="pb-8 border-b border-gray-100">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => onTitleChange?.(e.target.value)}
                            placeholder={titlePlaceholder}
                            className="w-full text-3xl font-bold outline-none border-none bg-transparent placeholder:text-gray-300"
                        />
                    </div>
                )}
                <div className="pt-8">
                    <EditorContent editor={editor} />
                </div>
            </div>

            {/* Link Preview Dialog */}
            <LinkPreviewDialog
                open={isLinkDialogOpen}
                onOpenChange={setIsLinkDialogOpen}
                onInsert={handleLinkInsert}
            />

            {/* Video Embed Dialog */}
            <VideoEmbedDialog
                open={isVideoDialogOpen}
                onOpenChange={setIsVideoDialogOpen}
                onInsert={handleVideoInsert}
            />

            {/* AI Generate Dialog */}
            <AIGenerateDialog
                open={isAIDialogOpen}
                onOpenChange={setIsAIDialogOpen}
                onInsert={(title, content) => {
                    if (onTitleChange && title) {
                        onTitleChange(title);
                    }
                    editor?.commands.insertContent(content);
                }}
            />

            {/* Photo Editor Dialog */}
            {isPhotoEditorOpen && editingImageUrl && (
                <Dialog open={isPhotoEditorOpen} onOpenChange={setIsPhotoEditorOpen}>
                    <DialogContent className="!max-w-[95vw] !h-[95vh] p-0 gap-0">
                        <DialogHeader className="sr-only">
                            <DialogTitle>사진 편집</DialogTitle>
                        </DialogHeader>
                        <PhotoEditor
                            imageUrl={editingImageUrl}
                            onSave={async (blob) => {
                                if (!spaceAlias) return;

                                try {
                                    // WebP로 R2에 업로드
                                    interface PresignedUploadUrlResponse {
                                        uploadUrl: string;
                                        publicUrl: string;
                                        fileKey: string;
                                    }

                                    const response = await api<PresignedUploadUrlResponse>(`/api/spaces/${spaceAlias}/menus/${menuShortId}/files/upload-url`, {
                                        method: 'POST',
                                        body: JSON.stringify({
                                            targetShortId: targetShortId || null,
                                            fileName: `edited-${Date.now()}.webp`,
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

                                    // 이미지 src 업데이트
                                    if (onImageEditSave) {
                                        onImageEditSave(response.publicUrl);
                                    }
                                } catch (error) {
                                    console.error('이미지 업로드 실패:', error);
                                }

                                setIsPhotoEditorOpen(false);
                                setEditingImageUrl(null);
                                setOnImageEditSave(null);
                            }}
                            onCancel={() => {
                                setIsPhotoEditorOpen(false);
                                setEditingImageUrl(null);
                                setOnImageEditSave(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
