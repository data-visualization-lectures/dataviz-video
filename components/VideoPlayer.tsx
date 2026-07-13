"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePlaybackProgress } from "@/app/actions";
import { Stream } from "@cloudflare/stream-react";
import Link from "next/link";
import { trackVideoPlay, trackVideoComplete } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";

const LOGIN_URL = "https://id.data-viz-lectures.com/auth/login";
const PRICING_URL = "https://www.dataviz.jp/pricing/";

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
    nextHref,
    signedToken,
    canWatch,
    isAuthenticated,
}: {
    video: Video;
    initialHistory: PlaybackHistory | null;
    nextHref?: string | null;
    signedToken?: string | null; // New prop for signed URL
    canWatch: boolean;
    isAuthenticated: boolean;
}) {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<any>(null);
    const [progress, setProgress] = useState(initialHistory?.progress_seconds || 0);
    const [isEnded, setIsEnded] = useState(false); // Track ended state
    const [isReady, setIsReady] = useState(false); // Track if player is ready to seek
    const hasTrackedPlay = useRef(false);
    const hasSyncedDuration = useRef(false);
    const hasTrackedComplete = useRef(false);
    const [loginHref, setLoginHref] = useState(LOGIN_URL);

    useEffect(() => {
        // redirect_to は クライアントでのみ確定できる（SSR に window が無いため）
        const redirectTo = encodeURIComponent(window.location.href);
        setLoginHref(`${LOGIN_URL}?redirect_to=${redirectTo}&lang=ja`);
    }, []);

    // Hybrid Logic: Check if it's a real Cloudflare UID or a dummy one
    // Dummy UIDs in seed_data start with "uid_"
    const isCloudflareVideo = !video.cloudflare_uid.startsWith("uid_");

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
        // duration の自己修復は「DB 値と 2 秒超乖離しているときに 1 回だけ」送る。
        // 毎回送るとサーバー側で不要な UPDATE が 5 秒ごとに走る。
        const actualDuration = isCloudflareVideo
            ? streamRef.current?.duration
            : videoRef.current?.duration;
        let durationToSync = 0;
        if (
            !hasSyncedDuration.current &&
            actualDuration && actualDuration > 0 &&
            Math.abs(actualDuration - (video.duration || 0)) > 2
        ) {
            hasSyncedDuration.current = true;
            durationToSync = actualDuration;
        }

        const result = await savePlaybackProgress(video.id, seconds, completed, durationToSync);

        if (result.error) {
            console.error("Error saving progress:", result.error);
        }
    };

    const handlePlay = () => {
        if (hasTrackedPlay.current) return;
        hasTrackedPlay.current = true;
        trackVideoPlay(video.id, video.title);
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

        // GA4: 90% 視聴到達で video_complete（1 回のみ）
        const totalDuration = isCloudflareVideo
            ? streamRef.current?.duration
            : videoRef.current?.duration;
        if (
            !hasTrackedComplete.current &&
            totalDuration && totalDuration > 0 &&
            current / totalDuration >= 0.9
        ) {
            hasTrackedComplete.current = true;
            trackVideoComplete(video.id, video.title);
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

        saveProgress(duration, true).then(() => {
            // サイドバーの完了チェックを更新（1 回だけ、明示的に）
            router.refresh();
        });
        setIsEnded(true);
    };

    const [error, setError] = useState<string | null>(null);

    const handleError = (e: any) => {
        console.error("Video Error:", e);
        if (isCloudflareVideo) {
            setError("動画プレイヤーでエラーが発生しました。時間をおいて再読み込みしてください。");
        } else {
            const videoElement = e.target as HTMLVideoElement;
            setError(`再生エラー: ${videoElement.error?.message || "不明なエラー"} (Code: ${videoElement.error?.code})`);
        }
    };

    if (!canWatch) {
        // 契約なし: プレイヤーの代わりにロックパネルを表示（署名トークンも発行されていない）
        return (
            <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden shadow-lg flex flex-col items-center justify-center text-white text-center p-8 space-y-5">
                <svg className="w-12 h-12 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-lg font-bold">この動画の視聴には「データの道具箱」の有効な契約が必要です</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    {!isAuthenticated && (
                        <Button
                            asChild
                            size="lg"
                            className="bg-white text-zinc-900 hover:bg-white/85"
                        >
                            <a href={loginHref}>ログイン</a>
                        </Button>
                    )}
                    <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="bg-transparent text-white border-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <a href={PRICING_URL}>プランを見る</a>
                    </Button>
                </div>
                {!isAuthenticated && (
                    <p className="text-sm text-gray-400">
                        契約済みの方はログインすると視聴できます。
                    </p>
                )}
            </div>
        );
    }

    if (!isCloudflareVideo) {
        // seed の仮動画（cloudflare_uid が "uid_" 始まり）: 配信素材が未登録
        return (
            <div className="relative w-full aspect-video bg-muted rounded-lg flex flex-col items-center justify-center text-center p-8 space-y-3 border">
                <p className="text-lg font-semibold">この動画は準備中です</p>
                <p className="text-sm text-muted-foreground">公開までしばらくお待ちください。</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">エラー</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            )}
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg group">
                <Stream
                        controls
                        responsive
                        src={signedToken || video.cloudflare_uid}
                        streamRef={streamRef}
                        onPlay={handlePlay}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleEnded}
                        onError={handleError}
                        onLoadedData={() => setIsReady(true)} // Cloudflare Stream often supports this
                        className="w-full h-full"
                    />

                {/* Next Video Overlay on End */}
                {isEnded && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 animate-fade-in text-white space-y-6">
                        <p className="text-xl font-bold">レッスン完了！</p>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setIsEnded(false);
                                    if (isCloudflareVideo) {
                                        streamRef.current?.play();
                                        streamRef.current.currentTime = 0;
                                    } else {
                                        if (videoRef.current) {
                                            videoRef.current.currentTime = 0;
                                            videoRef.current.play();
                                        }
                                    }
                                }}
                                className="px-6 py-2 rounded-full border border-white hover:[filter:brightness(1.3)] transition-[filter] flex items-center font-semibold"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                もう一度再生
                            </button>

                            {nextHref && (
                                <Link
                                    href={nextHref}
                                    className="bg-blue-600 hover:[filter:brightness(0.7)] dark:hover:[filter:brightness(1.3)] text-white font-bold px-8 py-2 rounded-full transition-[filter] transform hover:scale-105 flex items-center"
                                >
                                    次のレッスン &rarr;
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Always visible Next link if available */}
            {nextHref && (
                <div className="flex justify-end">
                    <Link
                        href={nextHref}
                        className="text-blue-600 hover:underline text-sm font-semibold flex items-center"
                    >
                        次のレッスン &rarr;
                    </Link>
                </div>
            )}
        </div>
    );
}
