-- Migration to fix the messages table schema to ensure consistent column names
-- and proper foreign key relationships

-- Disable RLS temporarily to make changes
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- First check if messages table exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    -- Create messages table with proper schema
    CREATE TABLE public.messages (
      id UUID PRIMARY KEY,
      conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      owner_id UUID REFERENCES auth.users(id)
    );
    
    RAISE NOTICE 'Created messages table with proper schema';
  ELSE
    -- Table exists, perform column checks
    RAISE NOTICE 'Messages table exists, checking columns...';
  END IF;
END $$;

-- Check and add columns if they don't exist
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  -- Check for conversation_id column
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'conversation_id'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    ALTER TABLE public.messages ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added conversation_id column to messages table';
  END IF;
  
  -- Check for role column
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'role'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    ALTER TABLE public.messages ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
    RAISE NOTICE 'Added role column to messages table';
  END IF;
  
  -- Check for content column
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'content'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    ALTER TABLE public.messages ADD COLUMN content TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added content column to messages table';
  END IF;
  
  -- Check for created_at column
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'created_at'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    ALTER TABLE public.messages ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    RAISE NOTICE 'Added created_at column to messages table';
  END IF;
  
  -- Check for owner_id column
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'owner_id'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    ALTER TABLE public.messages ADD COLUMN owner_id UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Added owner_id column to messages table';
  END IF;
  
  -- Ensure any user_id column is not being used in queries
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'user_id'
  ) INTO column_exists;
  
  IF column_exists THEN
    -- Don't drop it, just log a warning
    RAISE WARNING 'The user_id column exists in messages table but should not be used. Use owner_id instead.';
  END IF;
END $$;

-- Re-enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Apply simplified RLS policies
-- Drop all existing policies for messages
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read messages in conversations they own" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can manage own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read messages in owned conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can access any messages" ON public.messages;

-- Create new simplified policies for messages
-- Allow users to insert messages as long as they're authenticated
CREATE POLICY "Users can insert messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
  
-- Allow users to read messages in conversations they own
CREATE POLICY "Users can read messages in conversations they own"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.owner_id = auth.uid()
    )
  );
  
-- Allow users to update their own messages
CREATE POLICY "Users can update own messages"
  ON public.messages
  FOR UPDATE
  USING (owner_id = auth.uid());
  
-- Allow users to delete messages in conversations they own
CREATE POLICY "Users can delete messages in own conversations"
  ON public.messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.owner_id = auth.uid()
    )
  );

-- Log results
DO $$
BEGIN
  RAISE NOTICE 'Messages table schema and RLS policies updated successfully';
END $$;
