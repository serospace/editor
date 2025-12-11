'use client';
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
// Loader2 스피너 컴포넌트
const Loader2 = ({ className }: { className?: string }) => (
    <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);
import { api } from "@/shared/lib/api";

interface AIGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (title: string, content: string) => void;
}

interface GenerateContentResponse {
    title: string;
    content: string;
}

export function AIGenerateDialog({ open, onOpenChange, onInsert }: AIGenerateDialogProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await api<GenerateContentResponse>('/api/ai/generate-content', {
                method: 'POST',
                body: JSON.stringify({ prompt: prompt.trim() }),
            });

            onInsert(response.title, response.content);
            handleClose();
        } catch (err) {
            console.error('AI 콘텐츠 생성 실패:', err);
            setError('콘텐츠 생성에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleClose = () => {
        setPrompt("");
        setIsGenerating(false);
        setError(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="rounded-xl">
                <DialogHeader className="pl-0 pt-0">
                    <DialogTitle className="text-xl font-bold">AI 생성</DialogTitle>
                    <DialogDescription className="text-slate-600 text-base">
                        원하는 내용을 설명하면 AI가 글을 작성합니다
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">
                            프롬프트<span className="-ml-1" style={{color: 'var(--color-red-matte)'}}>*</span>
                        </Label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="예: 딥러닝의 주요 개념과 활용 사례에 대해 설명해주세요"
                            disabled={isGenerating}
                            className="min-h-[120px] resize-none"
                        />
                        <p className="text-xs text-slate-500">
                            구체적으로 작성할수록 더 좋은 결과를 얻을 수 있습니다
                        </p>
                    </div>
                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}
                    <Button
                        onClick={handleGenerate}
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-white w-full"
                        disabled={isGenerating || !prompt.trim()}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                생성 중...
                            </>
                        ) : (
                            '생성하기'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
