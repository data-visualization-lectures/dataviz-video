import { createClient } from "@/lib/supabase/server";
import LearningPathGraph from "@/components/LearningPathGraph";
import { notFound } from "next/navigation";

export default async function CoursePage({
    params,
}: {
    params: Promise<{ courseSlug: string }>;
}) {
    const { courseSlug } = await params;
    const supabase = await createClient();

    const { data: course } = await supabase
        .from("v_courses")
        .select("id, title, description, slug")
        .eq("slug", courseSlug)
        .maybeSingle();

    if (!course) return notFound();

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                <p className="text-muted-foreground">{course.description}</p>
            </div>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">学習パス</h2>
                <div className="h-[600px] border rounded-lg shadow-sm">
                    <LearningPathGraph courseId={course.id} courseSlug={course.slug} />
                </div>
            </div>
        </>
    );
}
