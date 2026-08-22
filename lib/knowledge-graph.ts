export const KNOWLEDGE_LOCK_POLICY = "always_open" as const;

export type KnowledgeNodeStatus =
    | "completed"
    | "in_progress"
    | "next"
    | "later";

export type KnowledgeGraphNodeInput = {
    id: string;
    videoId: string;
};

export type KnowledgeGraphLinkInput = {
    source: string;
    target: string;
};

export type PlaybackProgress = {
    videoId: string;
    isCompleted: boolean;
    progressSeconds: number;
};

export type KnowledgeGraphNode = {
    id: string;
    videoId: string;
    videoSlug: string;
    title: string;
    thumbnail: string | null;
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    courseSortOrder: number;
    status: KnowledgeNodeStatus;
};

export type KnowledgeGraphLink = {
    source: string;
    target: string;
};

export type KnowledgeGraphPayload = {
    lockPolicy: typeof KNOWLEDGE_LOCK_POLICY;
    nodes: KnowledgeGraphNode[];
    links: KnowledgeGraphLink[];
};

type HistoryLookup = {
    isCompleted: boolean;
    progressSeconds: number;
};

function historyByVideoId(
    history: PlaybackProgress[]
): Map<string, HistoryLookup> {
    const byVideo = new Map<string, HistoryLookup>();
    for (const row of history) {
        const existing = byVideo.get(row.videoId);
        if (!existing) {
            byVideo.set(row.videoId, {
                isCompleted: row.isCompleted,
                progressSeconds: row.progressSeconds,
            });
            continue;
        }
        byVideo.set(row.videoId, {
            isCompleted: existing.isCompleted || row.isCompleted,
            progressSeconds: Math.max(
                existing.progressSeconds,
                row.progressSeconds
            ),
        });
    }
    return byVideo;
}

function incomingByTarget(
    links: KnowledgeGraphLinkInput[]
): Map<string, string[]> {
    const incoming = new Map<string, string[]>();
    for (const link of links) {
        if (link.source === link.target) continue;
        const list = incoming.get(link.target);
        if (list) {
            if (!list.includes(link.source)) list.push(link.source);
        } else {
            incoming.set(link.target, [link.source]);
        }
    }
    return incoming;
}

function isVideoCompleted(
    videoId: string,
    history: Map<string, HistoryLookup>
): boolean {
    return history.get(videoId)?.isCompleted === true;
}

/**
 * 視聴履歴と先行関係からノード状態を決める。
 * - completed: 視聴完了
 * - in_progress: 未完了かつ progress_seconds > 0
 * - next: 未視聴で、存在する先行ノードがすべて completed（先行なしのルートを含む）
 * - later: それ以外の未視聴
 */
export function assignKnowledgeNodeStatuses(
    nodes: KnowledgeGraphNodeInput[],
    links: KnowledgeGraphLinkInput[],
    history: PlaybackProgress[]
): Map<string, KnowledgeNodeStatus> {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const historyMap = historyByVideoId(history);
    const incoming = incomingByTarget(links);
    const statuses = new Map<string, KnowledgeNodeStatus>();

    for (const node of nodes) {
        const record = historyMap.get(node.videoId);
        if (record?.isCompleted) {
            statuses.set(node.id, "completed");
            continue;
        }
        if ((record?.progressSeconds ?? 0) > 0) {
            statuses.set(node.id, "in_progress");
            continue;
        }

        const prereqIds = (incoming.get(node.id) ?? []).filter((id) =>
            nodeById.has(id)
        );
        const allPrereqsCompleted = prereqIds.every((id) => {
            const prereq = nodeById.get(id);
            return prereq ? isVideoCompleted(prereq.videoId, historyMap) : false;
        });

        statuses.set(node.id, allPrereqsCompleted ? "next" : "later");
    }

    return statuses;
}
