import Blockquote from '@tiptap/extension-blockquote';
import { Editor } from '@tiptap/core';

export const CustomBlockquote = Blockquote.extend({
    // 중첩 방지: blockquote 안에 blockquote 불가
    content: 'paragraph+',

    addAttributes() {
        return {
            ...(this as any).parent?.(),
            style: {
                default: 'default',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-style') || 'default',
                renderHTML: (attributes: Record<string, unknown>) => {
                    return {
                        'data-style': attributes.style,
                    };
                },
            },
        };
    },

    // 키보드로 인용구 위로 이동 시 위쪽에 빈 줄 없으면 추가
    addKeyboardShortcuts() {
        return {
            ...(this as any).parent?.(),
            ArrowUp: ({ editor }: { editor: Editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // 인용구 안의 첫 번째 위치인지 확인
                const blockquote = $from.node(-1);
                if (blockquote?.type.name === 'blockquote') {
                    // 인용구 내 첫 번째 paragraph의 시작 위치인지 확인
                    const parentPos = $from.before(-1);
                    const isAtStart = $from.parentOffset === 0 && $from.index(-1) === 0;

                    if (isAtStart && parentPos === 0) {
                        // 맨 앞에 빈 paragraph 삽입
                        editor.chain()
                            .insertContentAt(0, { type: 'paragraph' })
                            .setTextSelection(1)
                            .run();
                        return true;
                    }
                }
                return false;
            },
        };
    },
});

export type BlockquoteStyle = 'default' | 'bordered' | 'quote' | 'bubble';
