
-- Create sprites table
CREATE TABLE public.sprites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  grid_size TEXT NOT NULL DEFAULT '64x64',
  viewing_angle TEXT NOT NULL DEFAULT 'front',
  pose TEXT NOT NULL DEFAULT 'idle',
  frame_count INTEGER NOT NULL DEFAULT 1,
  frame_width INTEGER NOT NULL DEFAULT 64,
  frame_height INTEGER NOT NULL DEFAULT 64,
  image_data TEXT NOT NULL,
  palette TEXT[] NOT NULL DEFAULT '{}',
  pixel_data JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] NOT NULL DEFAULT '{}',
  reference_image_url TEXT,
  collection_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collections table
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#00FF88',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sprites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Sprites policies
CREATE POLICY "Users can view own sprites" ON public.sprites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sprites" ON public.sprites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sprites" ON public.sprites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sprites" ON public.sprites FOR DELETE USING (auth.uid() = user_id);

-- Collections policies
CREATE POLICY "Users can view own collections" ON public.collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own collections" ON public.collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON public.collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON public.collections FOR DELETE USING (auth.uid() = user_id);
