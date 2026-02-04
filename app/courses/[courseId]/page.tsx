import { createClient } from "@/lib/supabase/server";
import LearningPathGraph from "@/components/LearningPathGraph";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CoursePage({
    params,
}: {
    params: Promise<{ courseId: string }>;
}) {
    const { courseId } = await params;
    const supabase = await createClient();

    // Fetch Course Details
    const { data: course, error } = await supabase
        .from("v_courses")
        .select("*")
        .eq("id", courseId)
        .single();

    if (error || !course) {
        console.error("Error fetching course:", error);
        return notFound();
    }

    return (
        <div className="p-8 pt-32 max-w-6xl mx-auto">
            <div className="mb-8">
                <Link href="/" className="text-sm text-blue-600 hover:underline mb-2 block">
                    &larr; Back to Home
                </Link>
                <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                <p className="text-gray-600 dark:text-gray-300">{course.description}</p>
            </div>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Learning Path</h2>
                <div className="h-[600px] border rounded-lg shadow-sm">
                    <LearningPathGraph courseId={courseId} />
                </div>
            </div>
        </div>
    );
}
