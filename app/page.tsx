import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // Fetch Courses
  const { data: courses } = await supabase
    .from("v_courses")
    .select("*")
    .order("sort_order");

  // Enhance courses with "First Video ID" for direct linking
  const coursesWithLink = await Promise.all(
    (courses || []).map(async (course) => {
      // Strategy: Find the first video in the course.
      // Ideally this would follow the graph edges to find the root, 
      // but for now, fetching the nodes and taking the first one (alphabetical or insertion order) is a reasonable fallback.
      // We sort by 'id' to ensure deterministic results.
      const { data: node } = await supabase
        .from("v_course_nodes")
        .select("video_id")
        .eq("course_id", course.id)
        .order("id", { ascending: true })
        .limit(1)
        .single();

      return {
        ...course,
        firstVideoId: node?.video_id,
      };
    })
  );

  return (
    <div className="p-8 pt-20 max-w-7xl mx-auto">
      {/* Courses Section */}
      <section className="mb-16">
        <h1 className="text-4xl font-extrabold mb-8 text-gray-900 dark:text-white border-b pb-4">
          Learning Paths
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {coursesWithLink.map((course) => (
            <Link
              href={course.firstVideoId ? `/watch/${course.firstVideoId}` : "#"}
              key={course.id}
              className={`block group h-full ${!course.firstVideoId ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white dark:bg-zinc-900 h-full flex flex-col transform hover:-translate-y-1">
                {/* Fallback pattern background since we don't have course thumbnails yet */}
                <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white p-6 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:20px_20px]"></div>
                  <svg className="w-16 h-16 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>

                <div className="p-6 flex flex-col flex-grow">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                    {course.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-6 flex-grow">
                    {course.description || "Start your journey in this comprehensive course."}
                  </p>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Course
                    </span>
                    <span className="text-blue-600 font-semibold text-sm group-hover:underline flex items-center">
                      Start Learning <span className="ml-1">&rarr;</span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
