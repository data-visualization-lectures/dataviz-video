"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle, PlayCircle, Video } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type SidebarVideo = {
    slug: string;
    title: string;
    duration: number;
    isCompleted: boolean;
    progressPercent: number;
};

type CourseSidebarProps = {
    courseSlug: string;
    courseTitle: string;
    videos: SidebarVideo[];
};

export default function CourseSidebar({
    courseSlug,
    courseTitle,
    videos,
}: CourseSidebarProps) {
    const pathname = usePathname();

    return (
        <div className="w-full md:w-80 border-r bg-muted/30 overflow-y-auto h-full min-h-screen">
            <div className="p-4 border-b bg-background sticky top-0 z-10">
                <Link
                    href={`/courses/${courseSlug}`}
                    className="font-bold text-lg truncate block hover:underline"
                    title={courseTitle}
                >
                    {courseTitle}
                </Link>
                <div className="text-xs text-muted-foreground mt-1">
                    {videos.filter((v) => v.isCompleted).length} / {videos.length} 本 完了
                </div>
            </div>

            <div className="flex flex-col">
                {videos.map((video) => {
                    const href = `/courses/${courseSlug}/watch/${video.slug}`;
                    const isActive = pathname === href;

                    return (
                        <Link
                            key={video.slug}
                            href={href}
                            className={`p-4 flex gap-3 items-start border-l-4 transition-colors hover:bg-accent ${isActive
                                ? "border-primary bg-accent"
                                : "border-transparent"
                                }`}
                        >
                            {video.isCompleted ? (
                                <CheckCircle className="w-5 h-5 mt-0.5 text-green-600 flex-shrink-0" />
                            ) : isActive ? (
                                <PlayCircle className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                            ) : (
                                <Video className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                            )}

                            <div className="text-sm w-full min-w-0">
                                <div className={`font-medium line-clamp-2 ${isActive ? "text-primary" : ""}`}>
                                    {video.title}
                                </div>
                                <Progress
                                    className="h-1.5 mt-2"
                                    value={Math.min(100, Math.max(0, video.progressPercent || 0))}
                                />
                                <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                                    <span>{Math.floor(video.duration / 60)}分</span>
                                    {video.progressPercent > 0 && (
                                        <span className="text-[10px]">{Math.floor(video.progressPercent)}%</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
