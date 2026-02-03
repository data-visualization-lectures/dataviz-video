import Link from "next/link";
import { CheckCircle, PlayCircle, Lock, Video } from "lucide-react";

type SidebarVideo = {
    id: string;
    title: string;
    duration: number;
    isCompleted: boolean;
    isLocked: boolean;
    progressPercent: number;
};

type CourseSidebarProps = {
    courseTitle: string;
    videos: SidebarVideo[];
    currentVideoId: string;
};

export default function CourseSidebar({
    courseTitle,
    videos,
    currentVideoId,
}: CourseSidebarProps) {
    return (
        <div className="w-full md:w-80 border-r bg-gray-50 dark:bg-zinc-900 overflow-y-auto h-full min-h-screen">
            <div className="p-4 border-b bg-white dark:bg-zinc-900 sticky top-0 z-10">
                <h2 className="font-bold text-lg truncate" title={courseTitle}>
                    {courseTitle}
                </h2>
                <div className="text-xs text-gray-500 mt-1">
                    {videos.filter(v => v.isCompleted).length} / {videos.length} completed
                </div>
            </div>

            <div className="flex flex-col">
                {videos.map((video, index) => {
                    const isActive = video.id === currentVideoId;

                    return (
                        <div key={video.id}>
                            {video.isLocked ? (
                                <div className="p-4 flex gap-3 items-start border-l-4 border-transparent text-gray-400 cursor-not-allowed bg-gray-50 dark:bg-zinc-900/50">
                                    <Lock className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <div className="font-medium line-clamp-2">{video.title}</div>
                                        <div className="text-xs mt-1">{Math.floor(video.duration / 60)} min</div>
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    href={`/watch/${video.id}`}
                                    className={`p-4 flex gap-3 items-start border-l-4 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 ${isActive
                                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/10"
                                        : "border-transparent"
                                        }`}
                                >
                                    {video.isCompleted ? (
                                        <CheckCircle className="w-5 h-5 mt-0.5 text-green-600 flex-shrink-0" />
                                    ) : isActive ? (
                                        <PlayCircle className="w-5 h-5 mt-0.5 text-blue-600 flex-shrink-0" />
                                    ) : (
                                        <Video className="w-5 h-5 mt-0.5 text-gray-400 flex-shrink-0" />
                                    )}

                                    <div className="text-sm w-full min-w-0">
                                        <div className={`font-medium line-clamp-2 ${isActive ? "text-blue-700 dark:text-blue-300" : ""}`}>
                                            {video.title}
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-gray-200 dark:bg-zinc-700 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="bg-green-500 h-full rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(100, Math.max(0, video.progressPercent || 0))}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 flex justify-between">
                                            <span>{Math.floor(video.duration / 60)} min</span>
                                            {video.progressPercent > 0 && <span className="text-[10px]">{Math.floor(video.progressPercent)}%</span>}
                                        </div>
                                    </div>
                                </Link>
                            )
                            }
                        </div>
                    );
                })}
            </div>
        </div >
    );
}
