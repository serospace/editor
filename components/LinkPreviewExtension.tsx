import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { ExternalLink, Image as ImageIcon, X, Edit2, Check, XCircle, Layout, LayoutGrid } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

type LayoutType = 'horizontal' | 'vertical' | 'compact' | 'full-image';

const LinkPreviewComponent = ({ node, deleteNode, updateAttributes }: NodeViewProps) => {
    const { url, title, description, image, layout = 'horizontal' } = node.attrs;
    const [imageError, setImageError] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(title);
    const [editDescription, setEditDescription] = useState(description || '');

    const handleSave = () => {
        updateAttributes({
            title: editTitle,
            description: editDescription,
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditTitle(title);
        setEditDescription(description || '');
        setIsEditing(false);
    };

    const handleLayoutChange = (newLayout: LayoutType) => {
        updateAttributes({ layout: newLayout });
    };

    const renderContent = () => {
        const imageElement = image && !imageError ? (
            <div className={`bg-gray-100 flex items-center justify-center overflow-hidden ${
                layout === 'horizontal' ? 'sm:w-1/3 w-full h-48 sm:h-auto' :
                layout === 'vertical' ? 'w-full h-64' :
                layout === 'compact' ? 'w-16 h-16 rounded' :
                'w-full h-96'
            }`}>
                <img
                    src={image}
                    alt={title || 'Link preview'}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            </div>
        ) : (!image || imageError) && layout !== 'compact' ? (
            <div className={`bg-gray-100 flex items-center justify-center ${
                layout === 'horizontal' ? 'sm:w-1/3 w-full h-48 sm:h-auto' :
                layout === 'vertical' ? 'w-full h-64' :
                'w-full h-96'
            }`}>
                <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
        ) : null;

        const textElement = (
            <div className={`p-4 ${
                layout === 'horizontal' ? 'flex-1' :
                layout === 'vertical' ? 'w-full' :
                layout === 'compact' ? 'flex-1 py-0' :
                'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white'
            }`}>
                {isEditing ? (
                    <>
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full font-semibold text-lg mb-2 border rounded px-2 py-1"
                            placeholder="제목"
                        />
                        <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1 mb-2"
                            rows={2}
                            placeholder="설명 (선택사항)"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave}>
                                <Check className="h-4 w-4 mr-1" />
                                저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancel}>
                                <XCircle className="h-4 w-4 mr-1" />
                                취소
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <h3 className={`font-semibold ${
                            layout === 'compact' ? 'text-sm line-clamp-1' :
                            layout === 'full-image' ? 'text-2xl' :
                            'text-lg line-clamp-2'
                        } mb-2`}>
                            {title || url}
                        </h3>
                        {description && layout !== 'compact' && (
                            <p className={`text-sm ${
                                layout === 'full-image' ? 'text-white/90' : 'text-gray-600'
                            } line-clamp-2 mb-3`}>
                                {description}
                            </p>
                        )}
                        {layout !== 'full-image' && (
                            <div className="flex items-center text-xs text-gray-500">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                <span className="truncate">{new URL(url).hostname}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        );

        if (layout === 'horizontal') {
            return (
                <div className="flex flex-col sm:flex-row">
                    {imageElement}
                    {textElement}
                </div>
            );
        } else if (layout === 'vertical') {
            return (
                <div className="flex flex-col">
                    {imageElement}
                    {textElement}
                </div>
            );
        } else if (layout === 'compact') {
            return (
                <div className="flex items-center gap-3 p-2">
                    {imageElement}
                    {textElement}
                    <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </div>
            );
        } else {
            // full-image
            return (
                <div className="relative">
                    {imageElement}
                    {textElement}
                </div>
            );
        }
    };

    return (
        <NodeViewWrapper className="link-preview-wrapper my-4">
            <Card className="overflow-hidden hover:shadow-lg transition-shadow group relative">
                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(!isEditing)}
                        title="편집"
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" title="레이아웃 변경">
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleLayoutChange('horizontal')}>
                                <Layout className="h-4 w-4 mr-2" />
                                가로형 {layout === 'horizontal' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLayoutChange('vertical')}>
                                <Layout className="h-4 w-4 mr-2 rotate-90" />
                                세로형 {layout === 'vertical' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLayoutChange('compact')}>
                                <Layout className="h-4 w-4 mr-2" />
                                컴팩트 {layout === 'compact' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLayoutChange('full-image')}>
                                <ImageIcon className="h-4 w-4 mr-2" />
                                풀 이미지 {layout === 'full-image' && '✓'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={deleteNode}
                        title="삭제"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {!isEditing ? (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block no-underline hover:no-underline"
                    >
                        {renderContent()}
                    </a>
                ) : (
                    <div>
                        {renderContent()}
                    </div>
                )}
            </Card>
        </NodeViewWrapper>
    );
};

export const LinkPreview = Node.create({
    name: 'linkPreview',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            url: {
                default: '',
            },
            title: {
                default: '',
            },
            description: {
                default: '',
            },
            image: {
                default: '',
            },
            layout: {
                default: 'horizontal',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-link-preview]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-link-preview': '',
                'data-layout': HTMLAttributes.layout || 'horizontal'
            }),
            [
                'a',
                {
                    href: HTMLAttributes.url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                },
                HTMLAttributes.title || HTMLAttributes.url,
            ],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(LinkPreviewComponent);
    },
});
