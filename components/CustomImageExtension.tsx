import TiptapImage from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { mergeAttributes } from '@tiptap/core';
import { Button } from '@/shared/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { nanoid } from 'nanoid';

// 전역 썸네일 상태 관리를 위한 이벤트 시스템
// thumbnailUrl: 화면 표시용 presigned URL (일시적)
// thumbnailKey: DB 저장용 R2 파일 키 (영구적)
type ThumbnailEventHandler = (url: string | null) => void;
type ThumbnailKeyEventHandler = (key: string | null) => void;

let thumbnailUrl: string | null = null;
let thumbnailKey: string | null = null;
const thumbnailListeners: Set<ThumbnailEventHandler> = new Set();
const thumbnailKeyListeners: Set<ThumbnailKeyEventHandler> = new Set();

// URL-fileKey 매핑 (이미지 업로드 시 생성됨)
const urlToKeyMap: Map<string, string> = new Map();

// 드래그 중인 이미지 ID (TipTap이 dataTransfer를 덮어쓰므로 전역 변수 사용)
let draggingImageId: string | null = null;

// 커스텀 드래그 레이어
let dragOverlay: HTMLDivElement | null = null;

// 드래그 오버레이 크기 저장
let dragOverlaySize = { width: 0, height: 0 };

const createDragOverlay = (imgSrc: string, width: number, height: number) => {
    removeDragOverlay();

    dragOverlaySize = { width, height };

    const overlay = document.createElement('div');
    overlay.id = 'custom-drag-overlay';
    overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 99999;
        opacity: 0.85;
    `;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.cssText = `
        width: ${width}px;
        height: ${height}px;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    `;

    overlay.appendChild(img);
    document.body.appendChild(overlay);
    dragOverlay = overlay;

    return overlay;
};

const updateDragOverlayPosition = (x: number, y: number) => {
    if (dragOverlay) {
        // 마우스 중심 기준으로 위치 계산
        const halfW = dragOverlaySize.width / 2;
        const halfH = dragOverlaySize.height / 2;

        // 화면 경계 체크 (여유 10px)
        const maxX = window.innerWidth - dragOverlaySize.width - 10;
        const maxY = window.innerHeight - dragOverlaySize.height - 10;

        let left = x - halfW;
        let top = y - halfH;

        // 경계 보정
        left = Math.max(10, Math.min(left, maxX));
        top = Math.max(10, Math.min(top, maxY));

        dragOverlay.style.left = `${left}px`;
        dragOverlay.style.top = `${top}px`;
    }
};

const removeDragOverlay = () => {
    if (dragOverlay && dragOverlay.parentNode) {
        dragOverlay.parentNode.removeChild(dragOverlay);
    }
    dragOverlay = null;
};

export const setUrlToKeyMapping = (url: string, key: string) => {
    urlToKeyMap.set(url, key);
};

export const getKeyFromUrl = (url: string): string | null => {
    return urlToKeyMap.get(url) || null;
};

export const setGlobalThumbnailUrl = (url: string | null) => {
    thumbnailUrl = url;
    thumbnailListeners.forEach(listener => listener(url));

    // URL이 설정되면 해당하는 key도 자동으로 설정
    if (url) {
        const key = urlToKeyMap.get(url);
        if (key) {
            setGlobalThumbnailKey(key);
        }
    } else {
        setGlobalThumbnailKey(null);
    }
};

export const getGlobalThumbnailUrl = () => thumbnailUrl;

export const setGlobalThumbnailKey = (key: string | null) => {
    thumbnailKey = key;
    thumbnailKeyListeners.forEach(listener => listener(key));
};

export const getGlobalThumbnailKey = () => thumbnailKey;

const subscribeThumbnail = (handler: ThumbnailEventHandler) => {
    thumbnailListeners.add(handler);
    return () => thumbnailListeners.delete(handler);
};

export const subscribeThumbnailKey = (handler: ThumbnailKeyEventHandler) => {
    thumbnailKeyListeners.add(handler);
    return () => thumbnailKeyListeners.delete(handler);
};

const CustomImageComponent = ({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) => {
    const { src, alt, width = 'auto', textAlign = 'left', id } = node.attrs;
    const [showControls, setShowControls] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(thumbnailUrl);
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeThumbnail(setCurrentThumbnail);
        return () => { unsubscribe(); };
    }, []);

    // 이미지마다 고유 id 보장 (드래그-드롭 식별용)
    useEffect(() => {
        if (!id) {
            updateAttributes({ id: nanoid(8) });
        }
    }, [id, updateAttributes]);

    const isThumbnail = currentThumbnail === src;

    const widths = [
        { value: 'auto', label: '원본' },
        { value: '100%', label: '가로 맞춤' },
    ];

    const isFullWidth = width === '100%';

    const handleSetThumbnail = () => {
        setGlobalThumbnailUrl(src);
    };

    // 마우스 드래그 시작
    const handleMouseDown = (e: React.MouseEvent) => {
        // 컨트롤 버튼 클릭은 무시
        if ((e.target as HTMLElement).closest('button')) return;

        e.preventDefault();

        if (!node.attrs.id) return;

        const imgEl = imgRef.current;
        if (!imgEl) return;

        const rect = imgEl.getBoundingClientRect();
        const scale = 0.3;

        // 드래그 시작 상태 설정
        draggingImageId = node.attrs.id;
        setIsDragging(true);
        setShowControls(false);

        // 커스텀 드래그 오버레이 생성 (70% 크기)
        createDragOverlay(src, rect.width * scale, rect.height * scale);
        updateDragOverlayPosition(e.clientX, e.clientY);

        let lastHoveredWrapper: Element | null = null;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            updateDragOverlayPosition(moveEvent.clientX, moveEvent.clientY);

            // 현재 마우스 아래의 이미지 wrapper 찾기
            const elementBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
            const wrapper = elementBelow?.closest('.custom-image-wrapper');

            // 이전 hover 제거
            if (lastHoveredWrapper && lastHoveredWrapper !== wrapper) {
                lastHoveredWrapper.classList.remove('drag-hover');
            }

            // 새 hover 추가 (자기 자신 제외)
            if (wrapper && wrapper.getAttribute('data-image-id') !== node.attrs.id) {
                wrapper.classList.add('drag-hover');
                lastHoveredWrapper = wrapper;
            } else {
                lastHoveredWrapper = null;
            }
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);

            // hover 클래스 제거
            if (lastHoveredWrapper) {
                lastHoveredWrapper.classList.remove('drag-hover');
            }

            // 드롭 대상 찾기
            removeDragOverlay();

            const dropTarget = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            const targetWrapper = dropTarget?.closest('.custom-image-wrapper');

            if (targetWrapper) {
                // 커스텀 드롭 이벤트 발생
                const customEvent = new CustomEvent('custom-image-drop', {
                    bubbles: true,
                    detail: { draggedId: node.attrs.id },
                });
                targetWrapper.dispatchEvent(customEvent);
            }

            setIsDragging(false);
            draggingImageId = null;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // 이미지의 aspect ratio를 가져오는 헬퍼 함수
    const getImageAspectRatio = (imgSrc: string): Promise<number> => {
        return new Promise((resolve) => {
            const img = new window.Image();
            img.onload = () => {
                const ratio = img.naturalWidth / img.naturalHeight;
                resolve(ratio);
            };
            img.onerror = () => {
                resolve(1); // 실패 시 1:1 비율로 기본값
            };
            img.src = imgSrc;
        });
    };

    // 커스텀 드롭 이벤트 핸들러
    useEffect(() => {
        const wrapper = document.querySelector(`[data-image-id="${id}"]`);
        if (!wrapper) return;

        const handleCustomDrop = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const draggedId = customEvent.detail?.draggedId;

            if (!draggedId || draggedId === node.attrs.id) return;

            await mergeImages(draggedId);
        };

        wrapper.addEventListener('custom-image-drop', handleCustomDrop);
        return () => {
            wrapper.removeEventListener('custom-image-drop', handleCustomDrop);
        };
    }, [id, node.attrs.id]);

    // 이미지 병합 로직
    const mergeImages = async (draggedId: string) => {

        const { state, dispatch } = editor.view;
        let draggedPos: number | null = null;
        let draggedNode: any = null;

        state.doc.descendants((n: any, pos: number) => {
            if (n.type.name === node.type.name && n.attrs.id === draggedId) {
                draggedPos = pos;
                draggedNode = n;
                return false;
            }
            return true;
        });

        console.log('[handleDrop] draggedPos:', draggedPos, 'draggedNode:', draggedNode?.type?.name);

        if (draggedPos === null || !draggedNode) {
            console.log('[handleDrop] 드래그 노드를 찾지 못함');
            return;
        }

        const targetPos = typeof getPos === 'function' ? getPos() : null;
        console.log('[handleDrop] targetPos:', targetPos);

        if (targetPos === null) {
            console.log('[handleDrop] 타겟 위치 없음');
            return;
        }

        const targetNode = state.doc.nodeAt(targetPos);
        if (!targetNode) {
            console.log('[handleDrop] 타겟 노드 없음');
            return;
        }

        console.log('[handleDrop] 병합 시작 - targetPos:', targetPos, 'draggedPos:', draggedPos);

        // 두 이미지의 aspect ratio를 가져와서 높이가 같아지도록 너비 비율 계산
        const targetSrc = targetNode.attrs.src;
        const draggedSrc = draggedNode.attrs.src;

        const [targetRatio, draggedRatio] = await Promise.all([
            getImageAspectRatio(targetSrc),
            getImageAspectRatio(draggedSrc),
        ]);

        console.log('[handleDrop] targetRatio:', targetRatio, 'draggedRatio:', draggedRatio);

        // 높이가 같을 때 각 이미지의 너비 비율 계산
        // 너비A : 너비B = aspectRatioA : aspectRatioB
        const totalRatio = targetRatio + draggedRatio;
        const targetWidthPercent = Math.round((targetRatio / totalRatio) * 98); // 2% 여유
        const draggedWidthPercent = 98 - targetWidthPercent;

        console.log('[handleDrop] targetWidth:', targetWidthPercent + '%', 'draggedWidth:', draggedWidthPercent + '%');

        const targetAttrs = { ...targetNode.attrs, width: `${targetWidthPercent}%` };
        const draggedAttrs = { ...draggedNode.attrs, width: `${draggedWidthPercent}%` };

        let tr = state.tr;

        // 두 노드 모두 폭 설정
        tr = tr.setNodeMarkup(targetPos, undefined, targetAttrs);
        tr = tr.setNodeMarkup(draggedPos, undefined, draggedAttrs);

        // 드래그한 노드를 잘라서 대상 뒤에 붙인다.
        const draggedNodeSize = draggedNode.nodeSize;
        tr = tr.delete(draggedPos, draggedPos + draggedNodeSize);

        // 삭제로 인한 위치 보정
        const targetPosAfterDelete = draggedPos < targetPos ? targetPos - draggedNodeSize : targetPos;
        const insertPos = targetPosAfterDelete + targetNode.nodeSize;

        console.log('[handleDrop] insertPos:', insertPos, 'targetPosAfterDelete:', targetPosAfterDelete, 'nodeSize:', targetNode.nodeSize);

        tr = tr.insert(
            insertPos,
            draggedNode.type.create(draggedAttrs, draggedNode.content, draggedNode.marks)
        );

        console.log('[handleDrop] 트랜잭션 dispatch');
        dispatch(tr);
    };

    // width가 퍼센트 값인지 확인 (예: '48%', '100%')
    const isPercentWidth = typeof width === 'string' && width.endsWith('%');
    const isMergedImage = isPercentWidth && width !== '100%'; // 합쳐진 이미지 (48% 등)

    return (
        <NodeViewWrapper
            as="span"
            className="custom-image-wrapper"
            data-image-id={id}
            style={{
                textAlign: isFullWidth ? undefined : (textAlign as 'left' | 'center' | 'right'),
                lineHeight: '1',
                display: 'inline-block',
                verticalAlign: 'top',
                width: isMergedImage ? width : undefined,
            }}
        >
            <div
                className={`relative group ${isFullWidth ? 'block' : 'inline-block'} ${selected ? 'outline outline-2 outline-blue-500 outline-offset-0' : ''} ${isDragOver ? 'ring-2 ring-primary/60' : ''}`}
                style={{
                    width: isFullWidth || isMergedImage ? '100%' : undefined,
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseEnter={() => !isDragging && setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
                onMouseDown={handleMouseDown}
            >
                {/* 대표 이미지 배지 - 드래그 중에는 숨김 */}
                {isThumbnail && !isDragging && (
                    <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 z-20 shadow-md">
                        <Star className="h-3 w-3 fill-current" />
                        대표
                    </div>
                )}

                <img
                    ref={imgRef}
                    src={src}
                    alt={alt || ''}
                    style={{
                        maxWidth: '100%',
                        width: isFullWidth || isMergedImage ? '100%' : 'auto',
                        height: 'auto',
                        display: isFullWidth ? 'block' : 'inline-block',
                    }}
                    draggable={false}
                />

                {/* Controls - 드래그 중에는 숨김 */}
                {showControls && !isDragging && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1 bg-white/90 rounded-lg p-1 shadow-lg z-10">
                        {widths.map((w) => (
                            <Button
                                key={w.value}
                                variant={width === w.value ? 'default' : 'ghost'}
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={() => updateAttributes({ width: w.value })}
                            >
                                {w.label}
                            </Button>
                        ))}
                        <div className="w-px h-6 bg-gray-300 self-center mx-1" />
                        <Button
                            variant={isThumbnail ? 'default' : 'ghost'}
                            size="sm"
                            className={`h-8 px-3 text-xs ${isThumbnail ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' : ''}`}
                            onClick={handleSetThumbnail}
                            title="대표 이미지로 설정"
                        >
                            <Star className={`h-3 w-3 mr-1 ${isThumbnail ? 'fill-current' : ''}`} />
                            대표
                        </Button>
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

export const CustomImage = TiptapImage.extend({
    inline: true,
    group: 'inline',
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            id: {
                default: () => nanoid(8),
                parseHTML: (element: HTMLElement) => element.getAttribute('data-id') || nanoid(8),
                renderHTML: (attributes: Record<string, string>) => ({
                    'data-id': attributes.id,
                }),
            },
            src: {
                default: null,
            },
            alt: {
                default: null,
            },
            title: {
                default: null,
            },
            width: {
                default: 'auto',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-width') || 'auto',
                renderHTML: (attributes: Record<string, string>) => {
                    return {
                        'data-width': attributes.width,
                    };
                },
            },
            textAlign: {
                default: 'left',
                parseHTML: (element: HTMLElement) => {
                    const parent = element.parentElement;
                    return parent?.style?.textAlign || 'left';
                },
                renderHTML: () => ({}),
            },
        };
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
        const { width, textAlign, id, ...rest } = HTMLAttributes;

        const isFullWidth = width === '100%';
        const containerStyle = isFullWidth
            ? 'margin: 1rem 0; display: block;'
            : `margin: 0; display: inline-block; text-align: ${textAlign || 'left'}; vertical-align: middle;`;
        const imgStyle = `max-width: 100%; ${isFullWidth ? 'width: 100%;' : ''} height: auto; display: ${isFullWidth ? 'block' : 'inline-block'};`;

        return [
            'span',
            { style: containerStyle, 'data-text-align': textAlign, 'data-id': id },
            ['img', mergeAttributes(rest, { style: imgStyle, 'data-width': width, 'data-id': id })],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CustomImageComponent);
    },
});
