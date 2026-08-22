import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ViewModeNav from "@/components/ViewModeNav";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  const supabase = await createClient();

  // Fetch Courses & Nodes in parallel (avoid per-course N+1 queries)
  const [coursesResult, nodesResult] = await Promise.all([
    supabase.from("v_courses").select("*").order("sort_order"),
    supabase
      .from("v_course_nodes")
      .select("course_id, id, video:v_videos (slug)")
      .order("id", { ascending: true }),
  ]);

  const courses = coursesResult.data || [];

  // Strategy: Find the first video in each course.
  // Ideally this would follow the graph edges to find the root,
  // but taking the first node by 'id' is a deterministic fallback.
  const firstVideoSlugByCourse = new Map<string, string>();
  for (const node of nodesResult.data || []) {
    const video = Array.isArray(node.video) ? node.video[0] : node.video;
    if (video?.slug && !firstVideoSlugByCourse.has(node.course_id)) {
      firstVideoSlugByCourse.set(node.course_id, video.slug);
    }
  }

  const coursesWithLink = courses.map((course) => {
    const firstVideoSlug = firstVideoSlugByCourse.get(course.id);
    return {
      ...course,
      href: firstVideoSlug
        ? `/courses/${course.slug}/watch/${firstVideoSlug}`
        : null,
    };
  });

  return (
    <div className="p-8 pt-32 max-w-7xl mx-auto">
      <section className="mb-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-2">
          <h1 className="text-3xl font-bold">学習コース</h1>
          <ViewModeNav />
        </div>
        <p className="text-muted-foreground mb-8 border-b pb-6">
          コースを選んで、動画で順に学べます。視聴の進み具合は自動で記録されます。知識のつながりは知識マップでも見られます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coursesWithLink.map((course) => (
            <Link
              href={course.href ?? "#"}
              key={course.id}
              className={`block group h-full ${!course.href ? "pointer-events-none opacity-50" : ""}`}
            >
              <Card className="h-full overflow-hidden pt-0 transition-shadow hover:shadow-md">
                <div className="h-36 bg-muted flex items-center justify-center border-b">
                  <BookOpen
                    className="w-12 h-12 text-muted-foreground/60"
                    strokeWidth={1.25}
                  />
                </div>
                <CardContent className="flex flex-col flex-grow gap-2">
                  <CardTitle className="text-lg group-hover:underline">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {course.description || "基礎から順に学べるコースです。"}
                  </CardDescription>
                </CardContent>
                <CardFooter className="mt-auto justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    コース
                  </span>
                  <span className="text-sm font-semibold text-primary flex items-center gap-1">
                    学習を始める <ArrowRight className="w-4 h-4" />
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
