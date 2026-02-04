"use client";

import { useEffect, useRef, useState } from "react";
import { savePlaybackProgress } from "@/app/actions";
import { Stream } from "@cloudflare/stream-react";
import Link from "next/link";

type Video = {
    id: string;
    title: string;
    cloudflare_uid: string;
    duration: number;
};

type PlaybackHistory = {
    progress_seconds: number;
    is_completed: boolean;
};

export default function VideoPlayer({
    video,
    initialHistory,
    nextVideoId, // New prop
    signedToken,
}: {
    video: Video;
    initialHistory: PlaybackHistory | null;
    nextVideoId?: string | null;
    signedToken?: string | null; // New prop for signed URL
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<any>(null);
    const [progress, setProgress] = useState(initialHistory?.progress_seconds || 0);
    const [isEnded, setIsEnded] = useState(false); // Track ended state
    const [isReady, setIsReady] = useState(false); // Track if player is ready to seek

    // Hybrid Logic: Check if it's a real Cloudflare UID or a dummy one
    // Dummy UIDs in seed_data start with "uid_"
    const isCloudflareVideo = !video.cloudflare_uid.startsWith("uid_");

    // Determine sample video based on video ID to show variety
    const getSampleVideo = (id: string) => {
        // Using highly reliable Google sample videos
        const samples = [
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
        ];
        // Simple hash to pick a video
        const index = id.charCodeAt(0) % samples.length;
        return samples[index];
    };

    const sampleVideoUrl = getSampleVideo(video.id);

    useEffect(() => {
        // Set initial time if history exists AND player is ready
        if (initialHistory?.progress_seconds && initialHistory.progress_seconds > 0) {
            const targetTime = initialHistory.progress_seconds;

            if (isCloudflareVideo) {
                if (streamRef.current && isReady) {
                    // Ensure we don't seek if we are already past it (avoid loops)
                    if (Math.abs(streamRef.current.currentTime - targetTime) > 2) {
                        console.log("Restoring playback position (Cloudflare):", targetTime);
                        streamRef.current.currentTime = targetTime;
                    }
                }
            } else {
                if (videoRef.current && isReady) {
                    if (Math.abs(videoRef.current.currentTime - targetTime) > 2) {
                        console.log("Restoring playback position (HTML5):", targetTime);
                        videoRef.current.currentTime = targetTime;
                    }
                }
            }
        }
    }, [initialHistory, isCloudflareVideo, isReady]);

    const saveProgress = async (seconds: number, completed: boolean = false) => {
        // Use Server Action to save progress
        // Get actual duration from the active player
        const currentDuration = isCloudflareVideo
            ? streamRef.current?.duration
            : videoRef.current?.duration;

        const result = await savePlaybackProgress(video.id, seconds, completed, currentDuration || 0);

        if (result.error) {
            console.error("Error saving progress:", result.error);
        } else {
            console.log("Progress saved via Server Action");
        }
    };

    const handleTimeUpdate = (e?: any) => {
        let current = 0;

        if (isCloudflareVideo) {
            // Cloudflare Stream event or ref
            current = streamRef.current?.currentTime || e?.detail?.currentTime || 0;
        } else {
            // HTML5 Video
            if (!videoRef.current) return;
            current = videoRef.current.currentTime;
        }

        // Save locally to state
        setProgress(current);
        if (isEnded && current < (videoRef.current?.duration || 0) - 1) setIsEnded(false); // Reset ended if rewind

        // Save to DB every 5 seconds (roughly)
        if (Math.floor(current) % 5 === 0 && Math.floor(current) !== Math.floor(progress)) {
            saveProgress(current);
        }
    };

    const handleEnded = () => {
        const duration = isCloudflareVideo
            ? streamRef.current?.duration || video.duration
            : videoRef.current?.duration || 0;

        saveProgress(duration, true);
        setIsEnded(true);
        // alert("Video Completed!"); // Removed annoying alert
    };

    const [error, setError] = useState<string | null>(null);

    const handleError = (e: any) => {
        console.error("Video Error:", e);
        if (isCloudflareVideo) {
            setError("Cloudflare Player Error: See console for details.");
        } else {
            const videoElement = e.target as HTMLVideoElement;
            setError(`Playback Error: ${videoElement.error?.message || "Unknown error"} (Code: ${videoElement.error?.code})`);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            )}
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg group">
                {isCloudflareVideo ? (
                    <Stream
                        controls
                        responsive
                        src={signedToken || video.cloudflare_uid}
                        streamRef={streamRef}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleEnded}
                        onError={handleError}
                        onLoadedData={() => setIsReady(true)} // Cloudflare Stream often supports this
                        className="w-full h-full"
                    />
                ) : (
                    <video
                        ref={videoRef}
                        src={sampleVideoUrl}
                        controls
                        className="w-full h-full"
                        poster={`https://placehold.co/600x400?text=${encodeURIComponent(video.title)}`}
                        onTimeUpdate={() => handleTimeUpdate()}
                        onEnded={handleEnded}
                        onError={handleError}
                        onLoadedMetadata={() => setIsReady(true)} // HTML5 
                    />
                )}

                {/* Next Video Overlay on End */}
                {isEnded && nextVideoId && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 animate-fade-in">
                        <p className="text-white text-lg mb-4">Lesson Completed!</p>
                        <Link
                            href={`/watch/${nextVideoId}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition-transform transform hover:scale-105 flex items-center"
                        >
                            Next Lesson &rarr;
                        </Link>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded border flex justify-between items-center">
                <div>
                    <h2 className="font-bold">Playback Info</h2>
                    <p className="text-sm text-gray-600">Current Progress: {progress.toFixed(1)}s</p>
                </div>

                {/* Always visible Next button if available */}
                {nextVideoId && (
                    <Link
                        href={`/watch/${nextVideoId}`}
                        className="text-blue-600 hover:underline text-sm font-semibold flex items-center"
                    >
                        Next Lesson &rarr;
                    </Link>
                )}
            </div>

            {/* Debug Info Hidden or Collapsed by default could be here */}
        </div>
    );
}
