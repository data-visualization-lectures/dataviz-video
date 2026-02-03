"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useRouter } from "next/navigation";

type Node = {
    id: string; // Node ID
    videoId: string;
    title: string;
    thumbnail: string;
    status: "locked" | "available" | "completed";
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
};

type Link = {
    source: string | Node;
    target: string | Node;
};

type GraphData = {
    nodes: Node[];
    links: Link[];
};

export default function LearningPathGraph({ courseId }: { courseId: string }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Colors based on status
    const COLORS = {
        completed: "#10b981", // Emerald 500
        available: "#3b82f6", // Blue 500
        locked: "#9ca3af",    // Gray 400
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/course-graph/${courseId}`);
                if (!res.ok) throw new Error("Failed to fetch graph data");
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [courseId]);

    useEffect(() => {
        if (!data || !svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = 600;

        // Clear previous SVG content
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);

        // Add definition for arrowheads
        svg.append("defs").selectAll("marker")
            .data(["end"]) // distinct markers if needed
            .join("marker")
            .attr("id", "arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 25) // Position relative to node radius
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("fill", "#999")
            .attr("d", "M0,-5L10,0L0,5");

        const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
            .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(40));

        const link = svg.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(data.links)
            .join("line")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrow)");

        const node = svg.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("g")
            .data(data.nodes)
            .join("g")
            .call(drag(simulation) as any);

        // Node Circles
        node.append("circle")
            .attr("r", 20)
            .attr("fill", (d) => COLORS[d.status])
            .attr("cursor", (d) => d.status !== "locked" ? "pointer" : "not-allowed")
            .on("click", (event, d) => {
                if (d.status !== "locked") {
                    router.push(`/watch/${d.videoId}`);
                }
            });

        // Node Labels (Title)
        node.append("text")
            .text((d) => d.title.length > 15 ? d.title.substring(0, 15) + "..." : d.title)
            .attr("x", 25)
            .attr("y", 5)
            .attr("stroke", "none")
            .attr("fill", "#333") // or logic for dark mode
            .style("font-size", "12px")
            .style("pointer-events", "none"); // Let clicks pass through to the circle/group

        // Status Icon/Label (Optional, maybe just color is enough)

        // Tooltip logic could go here

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node
                .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
            function dragstarted(event: any) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event: any) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event: any) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

        return () => {
            simulation.stop();
        };
    }, [data, router]);

    if (loading) return <div>Loading graph...</div>;
    if (!data) return <div>No data found</div>;

    return (
        <div ref={containerRef} className="w-full border rounded-lg shadow-inner bg-gray-50 dark:bg-zinc-900 overflow-hidden relative">
            <div className="absolute top-4 left-4 bg-white/80 dark:bg-black/80 p-2 rounded text-xs z-10">
                <div className="flex items-center gap-2 mb-1"><span className="block w-3 h-3 rounded-full" style={{ background: COLORS.completed }}></span> Completed</div>
                <div className="flex items-center gap-2 mb-1"><span className="block w-3 h-3 rounded-full" style={{ background: COLORS.available }}></span> Available</div>
                <div className="flex items-center gap-2"><span className="block w-3 h-3 rounded-full" style={{ background: COLORS.locked }}></span> Locked</div>
            </div>
            <svg ref={svgRef}></svg>
        </div>
    );
}
