"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";
import type {
    KnowledgeGraphLink,
    KnowledgeGraphNode,
    KnowledgeGraphPayload,
    KnowledgeNodeStatus,
} from "@/lib/knowledge-graph";

type SimNode = KnowledgeGraphNode &
    d3.SimulationNodeDatum & {
        lines: string[];
        width: number;
        height: number;
    };

type SimLink = d3.SimulationLinkDatum<SimNode>;

const STATUS_STYLE: Record<
    KnowledgeNodeStatus,
    { fill: string; stroke: string; text: string; label: string }
> = {
    completed: {
        fill: "#10B981",
        stroke: "#059669",
        text: "#ffffff",
        label: "完了",
    },
    in_progress: {
        fill: "#F59E0B",
        stroke: "#D97706",
        text: "#111827",
        label: "視聴中",
    },
    next: {
        fill: "#0F6CBD",
        stroke: "#0958B5",
        text: "#ffffff",
        label: "次に学ぶ",
    },
    later: {
        fill: "#FFFFFF",
        stroke: "#E5E7EB",
        text: "#111827",
        label: "その先",
    },
};

const TITLE_MAX_CHARS = 14;
const TITLE_MAX_LINES = 2;
const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const PAD_X = 12;
const PAD_Y = 8;

function wrapNodeTitle(title: string): string[] {
    if (title.length <= TITLE_MAX_CHARS) return [title];
    const lines: string[] = [];
    let remaining = title;
    while (remaining.length > 0 && lines.length < TITLE_MAX_LINES) {
        if (
            lines.length === TITLE_MAX_LINES - 1 &&
            remaining.length > TITLE_MAX_CHARS
        ) {
            lines.push(`${remaining.slice(0, TITLE_MAX_CHARS - 1)}…`);
            break;
        }
        lines.push(remaining.slice(0, TITLE_MAX_CHARS));
        remaining = remaining.slice(TITLE_MAX_CHARS);
    }
    return lines;
}

function pillSize(lines: string[]): { width: number; height: number } {
    const maxLen = Math.max(...lines.map((line) => line.length), 4);
    return {
        width: Math.min(200, Math.max(108, maxLen * FONT_SIZE + PAD_X * 2)),
        height: PAD_Y * 2 + lines.length * LINE_HEIGHT,
    };
}

function nodeDepths(
    nodes: KnowledgeGraphNode[],
    links: KnowledgeGraphLink[]
): Map<string, number> {
    const incoming = new Map<string, string[]>();
    for (const link of links) {
        const list = incoming.get(link.target) ?? [];
        list.push(link.source);
        incoming.set(link.target, list);
    }

    const depths = new Map<string, number>();
    const visiting = new Set<string>();

    const visit = (id: string): number => {
        const cached = depths.get(id);
        if (cached !== undefined) return cached;
        if (visiting.has(id)) return 0;
        visiting.add(id);
        const prereqs = (incoming.get(id) ?? []).filter((sourceId) =>
            nodes.some((node) => node.id === sourceId)
        );
        const depth =
            prereqs.length === 0
                ? 0
                : Math.max(...prereqs.map(visit)) + 1;
        visiting.delete(id);
        depths.set(id, depth);
        return depth;
    };

    for (const node of nodes) visit(node.id);
    return depths;
}

function asSimNode(
    value: string | number | SimNode | undefined
): SimNode | null {
    if (!value || typeof value === "string" || typeof value === "number") {
        return null;
    }
    return value;
}

function rectEdgeToward(
    node: SimNode,
    other: SimNode
): { x: number; y: number } {
    const cx = node.x ?? 0;
    const cy = node.y ?? 0;
    const dx = (other.x ?? 0) - cx;
    const dy = (other.y ?? 0) - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const hw = node.width / 2;
    const hh = node.height / 2;
    const scale = Math.min(
        Math.abs(dx) < 1e-6 ? Number.POSITIVE_INFINITY : hw / Math.abs(dx),
        Math.abs(dy) < 1e-6 ? Number.POSITIVE_INFINITY : hh / Math.abs(dy)
    );
    return { x: cx + dx * scale, y: cy + dy * scale };
}

function curvedLinkPath(source: SimNode, target: SimNode): string {
    const start = rectEdgeToward(source, target);
    const end = rectEdgeToward(target, source);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const len = Math.hypot(dx, dy) || 1;
    const offset = Math.min(28, len * 0.18);
    const cx = midX - (dy / len) * offset;
    const cy = midY + (dx / len) * offset;
    return `M${start.x},${start.y}Q${cx},${cy} ${end.x},${end.y}`;
}

export default function KnowledgeGraph() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<KnowledgeGraphPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/knowledge-graph");
                if (!res.ok) throw new Error("Failed to fetch graph data");
                const json = (await res.json()) as KnowledgeGraphPayload;
                setData(json);
            } catch (err) {
                console.error(err);
                setError("知識マップを読み込めませんでした");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!data || !svgRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const svgEl = svgRef.current;
        const svg = d3.select(svgEl);
        const depths = nodeDepths(data.nodes, data.links);
        const maxDepth = Math.max(0, ...depths.values());

        const courseOrder = [
            ...new Map(
                data.nodes.map((node) => [
                    node.courseId,
                    node.courseSortOrder,
                ])
            ).entries(),
        ].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
        const courseIds = courseOrder.map(([id]) => id);

        const simNodes: SimNode[] = data.nodes.map((node) => {
            const lines = wrapNodeTitle(node.title);
            const size = pillSize(lines);
            return { ...node, lines, ...size };
        });
        const simLinks: SimLink[] = data.links.map((link) => ({
            source: link.source,
            target: link.target,
        }));

        const courseX = (courseId: string, width: number) => {
            if (courseIds.length <= 1) return width / 2;
            const index = Math.max(0, courseIds.indexOf(courseId));
            return (
                width *
                (0.22 + (index / Math.max(1, courseIds.length - 1)) * 0.56)
            );
        };
        const depthY = (id: string, height: number) => {
            const depth = depths.get(id) ?? 0;
            const span = Math.max(1, maxDepth);
            return 72 + (depth / span) * Math.max(120, height - 160);
        };

        svg.selectAll("*").remove();
        svg.append("defs")
            .append("marker")
            .attr("id", "knowledge-arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 8)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("fill", "#9CA3AF")
            .attr("d", "M0,-5L10,0L0,5");

        const viewport = svg.append("g");
        const link = viewport
            .append("g")
            .attr("fill", "none")
            .attr("stroke", "#9CA3AF")
            .attr("stroke-opacity", 0.75)
            .attr("stroke-width", 1.5)
            .selectAll<SVGPathElement, SimLink>("path")
            .data(simLinks)
            .join("path")
            .attr("marker-end", "url(#knowledge-arrow)");

        const node = viewport
            .append("g")
            .selectAll<SVGGElement, SimNode>("g")
            .data(simNodes)
            .join("g")
            .attr("tabindex", 0)
            .attr("role", "link")
            .attr("aria-label", (d) => `${d.title}（${d.courseTitle}）`)
            .style("cursor", "pointer");

        node.append("title").text(
            (d) => `${d.title}（${d.courseTitle}）`
        );

        node.append("rect")
            .attr("x", (d) => -d.width / 2)
            .attr("y", (d) => -d.height / 2)
            .attr("width", (d) => d.width)
            .attr("height", (d) => d.height)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("fill", (d) => STATUS_STYLE[d.status].fill)
            .attr("stroke", (d) => STATUS_STYLE[d.status].stroke)
            .attr("stroke-width", (d) => (d.status === "next" || d.status === "in_progress" ? 2 : 1.5));

        node.each(function (d) {
            const text = d3
                .select(this)
                .append("text")
                .attr("text-anchor", "middle")
                .attr("fill", STATUS_STYLE[d.status].text)
                .attr("stroke", "none")
                .style("font-size", `${FONT_SIZE}px`)
                .style("font-weight", d.status === "next" ? "600" : "500")
                .style("pointer-events", "none");
            const startY =
                -((d.lines.length - 1) * LINE_HEIGHT) / 2 + FONT_SIZE / 3;
            d.lines.forEach((line, i) => {
                text.append("tspan")
                    .attr("x", 0)
                    .attr("y", startY + i * LINE_HEIGHT)
                    .text(line);
            });
        });

        const simulation = d3
            .forceSimulation(simNodes)
            .force(
                "link",
                d3
                    .forceLink<SimNode, SimLink>(simLinks)
                    .id((d) => d.id)
                    .distance(168)
            )
            .force("charge", d3.forceManyBody().strength(-320))
            .force(
                "collide",
                d3
                    .forceCollide<SimNode>()
                    .radius((d) => Math.max(d.width, d.height) / 2 + 18)
            );

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.4, 2.5])
            .on("zoom", (event) => {
                viewport.attr("transform", event.transform.toString());
            });
        svg.call(zoom);
        svg.on("dblclick.zoom", null);

        const applyLayoutForces = (width: number, height: number) => {
            simulation
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force(
                    "x",
                    d3
                        .forceX<SimNode>((d) => courseX(d.courseId, width))
                        .strength(0.18)
                )
                .force(
                    "y",
                    d3
                        .forceY<SimNode>((d) => depthY(d.id, height))
                        .strength(0.1)
                );
        };

        const sizeSvg = () => {
            const width = Math.max(320, container.clientWidth);
            const height = Math.max(420, container.clientHeight);
            svg.attr("viewBox", `0 0 ${width} ${height}`);
            applyLayoutForces(width, height);
            return { width, height };
        };

        const { width, height } = sizeSvg();
        for (const simNode of simNodes) {
            simNode.x = courseX(simNode.courseId, width);
            simNode.y = depthY(simNode.id, height);
        }

        simulation.on("tick", () => {
            link.attr("d", (d) => {
                const source = asSimNode(d.source);
                const target = asSimNode(d.target);
                if (!source || !target) return "";
                return curvedLinkPath(source, target);
            });
            node.attr(
                "transform",
                (d) => `translate(${d.x ?? 0},${d.y ?? 0})`
            );
        });

        const drag = d3
            .drag<SVGGElement, SimNode>()
            .on("start", (event) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on("drag", (event) => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on("end", (event) => {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            });

        node.call(drag);
        node.on("mousedown", (event) => event.stopPropagation());
        node.on("click", (event, d) => {
            if (event.defaultPrevented) return;
            router.push(`/courses/${d.courseSlug}/watch/${d.videoSlug}`);
        });
        node.on("keydown", (event, d) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/courses/${d.courseSlug}/watch/${d.videoSlug}`);
            }
        });

        const observer = new ResizeObserver(() => {
            sizeSvg();
            simulation.alpha(0.15).restart();
        });
        observer.observe(container);

        return () => {
            observer.disconnect();
            simulation.stop();
            svg.on(".zoom", null);
            svg.selectAll("*").remove();
        };
    }, [data, router]);

    if (loading) {
        return (
            <div className="w-full h-full min-h-[420px] flex items-center justify-center text-sm text-muted-foreground border rounded-lg bg-[#FAFAFA]">
                知識マップを読み込み中...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="w-full h-full min-h-[420px] flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
                {error ?? "データが見つかりませんでした"}
            </div>
        );
    }

    if (data.nodes.length === 0) {
        return (
            <div className="w-full h-full min-h-[420px] flex items-center justify-center text-sm text-muted-foreground border rounded-lg">
                表示できる学習項目がまだありません
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full min-h-[420px] border rounded-lg shadow-sm bg-[#FAFAFA] overflow-hidden relative touch-none"
        >
            <div className="absolute top-4 left-4 bg-white/95 border border-[#E5E7EB] p-3 rounded-lg text-xs z-10 shadow-sm">
                <div className="font-medium text-[#111827] mb-2">進捗</div>
                {(
                    Object.entries(STATUS_STYLE) as [
                        KnowledgeNodeStatus,
                        (typeof STATUS_STYLE)[KnowledgeNodeStatus],
                    ][]
                ).map(([status, style]) => (
                    <div
                        key={status}
                        className="flex items-center gap-2 mb-1 last:mb-0 text-[#111827]"
                    >
                        <span
                            className="block h-3 w-5 rounded-full border"
                            style={{
                                background: style.fill,
                                borderColor: style.stroke,
                            }}
                        />
                        {style.label}
                    </div>
                ))}
            </div>
            <svg
                ref={svgRef}
                className="w-full h-full"
                role="img"
                aria-label="全コースの知識マップ"
            />
        </div>
    );
}
