import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { X, Play } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface VideoEmbedAttrs {
    url: string;
    provider: 'youtube' | 'vimeo';
    videoId: string;
    width?: string;
    height?: string;
}

const VideoEmbedComponent = ({ node, deleteNode, updateAttributes }: any) => {
    const { url, provider, videoId, width = '100%', height = '400px' } = node.attrs as VideoEmbedAttrs;
    const [isPlaying, setIsPlaying] = useState(false);

    const getEmbedUrl = () => {
        if (provider === 'youtube') {
            return `https://www.youtube.com/embed/${videoId}`;
        } else if (provider === 'vimeo') {
            return `https://player.vimeo.com/video/${videoId}`;
        }
        return '';
    };

    const getThumbnailUrl = () => {
        if (provider === 'youtube') {
            return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
        return '';
    };

    return (
        <NodeViewWrapper className="video-embed-wrapper my-4">
            <Card className="overflow-hidden group relative">
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90"
                    onClick={deleteNode}
                >
                    <X className="h-4 w-4" />
                </Button>

                <div style={{ width, maxWidth: '100%', margin: '0 auto' }}>
                    {!isPlaying && provider === 'youtube' ? (
                        <div
                            className="relative cursor-pointer"
                            onClick={() => setIsPlaying(true)}
                            style={{ paddingBottom: '56.25%', position: 'relative' }}
                        >
                            <img
                                src={getThumbnailUrl()}
                                alt="Video thumbnail"
                                className="absolute top-0 left-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition">
                                <div className="bg-red-600 rounded-full p-4 hover:scale-110 transition">
                                    <Play className="h-8 w-8 text-white fill-white" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                            <iframe
                                src={getEmbedUrl()}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                }}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    )}
                </div>

                <div className="p-3 text-sm text-gray-600">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                    >
                        {url}
                    </a>
                </div>
            </Card>
        </NodeViewWrapper>
    );
};

export const VideoEmbed = Node.create({
    name: 'videoEmbed',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            url: {
                default: '',
            },
            provider: {
                default: 'youtube',
            },
            videoId: {
                default: '',
            },
            width: {
                default: '100%',
            },
            height: {
                default: '400px',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-video-embed]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { url, provider, videoId } = HTMLAttributes;
        const embedUrl = provider === 'youtube'
            ? `https://www.youtube.com/embed/${videoId}`
            : `https://player.vimeo.com/video/${videoId}`;

        return [
            'div',
            mergeAttributes(HTMLAttributes, { 'data-video-embed': '', class: 'video-embed' }),
            [
                'iframe',
                {
                    src: embedUrl,
                    width: '100%',
                    height: '400',
                    frameborder: '0',
                    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                    allowfullscreen: 'true',
                },
            ],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(VideoEmbedComponent);
    },
});

/**
 * Extract video ID from URL
 */
export function extractVideoInfo(url: string): { provider: 'youtube' | 'vimeo' | null; videoId: string | null } {
    // YouTube patterns
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of youtubePatterns) {
        const match = url.match(pattern);
        if (match) {
            return { provider: 'youtube', videoId: match[1] };
        }
    }

    // Vimeo patterns
    const vimeoPattern = /vimeo\.com\/(?:video\/)?(\d+)/;
    const vimeoMatch = url.match(vimeoPattern);
    if (vimeoMatch) {
        return { provider: 'vimeo', videoId: vimeoMatch[1] };
    }

    return { provider: null, videoId: null };
}
