"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ViewModeNav() {
    const pathname = usePathname();
    const isCourses = pathname === "/";
    const isMap = pathname === "/map";

    return (
        <nav className="flex items-center gap-2" aria-label="表示モード">
            <Link
                href="/"
                className={cn(
                    buttonVariants({
                        variant: isCourses ? "default" : "outline",
                        size: "sm",
                    })
                )}
                aria-current={isCourses ? "page" : undefined}
            >
                コース一覧
            </Link>
            <Link
                href="/map"
                className={cn(
                    buttonVariants({
                        variant: isMap ? "default" : "outline",
                        size: "sm",
                    })
                )}
                aria-current={isMap ? "page" : undefined}
            >
                知識マップ
            </Link>
        </nav>
    );
}
