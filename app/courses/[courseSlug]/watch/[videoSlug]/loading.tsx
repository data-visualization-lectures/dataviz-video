import { Skeleton } from "@/components/ui/skeleton";

export default function WatchLoading() {
    return (
        <>
            <Skeleton className="h-8 w-2/3 mb-2" />
            <Skeleton className="w-full aspect-video rounded-lg" />
            <div className="mt-8 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-52" />
            </div>
        </>
    );
}
