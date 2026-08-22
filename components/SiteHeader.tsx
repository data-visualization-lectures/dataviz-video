import Link from "next/link";
import ViewModeNav from "@/components/ViewModeNav";

export default function SiteHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 h-16 flex items-center justify-between px-4 md:px-8 mt-12 md:mt-12 transition-all">
            {/* Note: mt-12 is roughly to account for the Global Header which is usually fixed at top.
                If Global Header is 48px, mt-12 (48px) pushes this down.
                Adjust based on actual Global Header height if needed.
            */}

            <div className="flex items-center gap-4">
                <Link href="/" className="font-bold text-xl text-gray-900 dark:text-white hover:opacity-80 hover:underline transition-all">
                    DataViz.jp Video
                </Link>
            </div>

            <ViewModeNav />
        </header>
    );
}
