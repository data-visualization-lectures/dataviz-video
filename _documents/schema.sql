-- Videos table
CREATE TABLE public.v_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    cloudflare_uid TEXT NOT NULL,
    duration INTEGER, -- Duration in seconds
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Courses table (Roots of the learning paths)
CREATE TABLE public.v_courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Course Nodes (Video nodes within a course graph)
CREATE TABLE public.v_course_nodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES public.v_courses(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.v_videos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Node Edges (Defining the directed graph structure for viewing order)
CREATE TABLE public.v_node_edges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_node_id UUID NOT NULL REFERENCES public.v_course_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.v_course_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT prevent_self_loop CHECK (source_node_id != target_node_id)
);

-- Playback History (Tracking user progress)
CREATE TABLE public.v_playback_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.v_videos(id) ON DELETE CASCADE,
    progress_seconds INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, video_id) -- Ensure one record per user per video
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.v_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v_course_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v_node_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v_playback_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic examples, adjust as needed)

-- Videos: Public read access
CREATE POLICY "Enable read access for all users" ON public.v_videos FOR SELECT USING (true);

-- Courses: Public read access
CREATE POLICY "Enable read access for all users" ON public.v_courses FOR SELECT USING (true);

-- Course Nodes: Public read access
CREATE POLICY "Enable read access for all users" ON public.v_course_nodes FOR SELECT USING (true);

-- Node Edges: Public read access
CREATE POLICY "Enable read access for all users" ON public.v_node_edges FOR SELECT USING (true);

-- Playback History: Users can view and update their own history
CREATE POLICY "Users can view own history" ON public.v_playback_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.v_playback_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own history" ON public.v_playback_history FOR UPDATE USING (auth.uid() = user_id);
