import KnowledgeGraph from "@/components/KnowledgeGraph";
import ViewModeNav from "@/components/ViewModeNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "知識マップ",
    description:
        "全コースの動画をネットワーク図で見渡し、視聴済みと次に学ぶ項目を確認します。",
};

export default function KnowledgeMapPage() {
    return (
        <div className="pt-32 h-screen flex flex-col">
            <div className="px-4 md:px-8 pb-4 shrink-0 max-w-7xl w-full mx-auto">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">知識マップ</h1>
                        <p className="text-muted-foreground">
                            視聴済みと次に学ぶ項目を、コースを横断したネットワークで確認できます。ノードを押すと動画へ移動します。ドラッグで移動、スクロールで拡大できます。
                        </p>
                    </div>
                    <ViewModeNav />
                </div>
            </div>
            <div className="flex-1 min-h-0 px-4 md:px-8 pb-4">
                <KnowledgeGraph />
            </div>
        </div>
    );
}
