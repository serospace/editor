import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { ChainedCommands, Editor } from '@tiptap/core';

export const CustomHorizontalRule = HorizontalRule.extend({
    addAttributes() {
        return {
            style: {
                default: 'solid',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-style') || 'solid',
                renderHTML: (attributes: Record<string, unknown>) => {
                    return {
                        'data-style': attributes.style,
                    };
                },
            },
        };
    },

    addCommands() {
        return {
            ...(this as any).parent?.(),
            setStyledHorizontalRule:
                (style: HorizontalRuleStyle) =>
                    ({ chain }: { chain: () => ChainedCommands }) => {
                        return chain()
                            .insertContent({
                                type: this.name,
                                attrs: { style },
                            })
                            .run();
                    },
        };
    },

    // 키보드로 구분선 위로 이동 시 위쪽에 빈 줄 없으면 추가
    addKeyboardShortcuts() {
        return {
            ArrowUp: ({ editor }: { editor: Editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // 현재 위치가 구분선 바로 뒤이고, 구분선이 첫 노드인 경우
                if ($from.nodeBefore?.type.name === 'horizontalRule') {
                    const hrPos = $from.pos - $from.nodeBefore.nodeSize;
                    if (hrPos === 0) {
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

export type HorizontalRuleStyle = 'solid' | 'short' | 'dashed' | 'dotted' | 'gradient' | 'stars';
