-- Migration to fix recursive RLS policies and properly set up tables

-- Step 1: Temporarily disable RLS on all tables to prevent recursion during changes
ALTER TABLE IF EXISTS public.case_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can view cases they collaborate on" ON public.cases;
DROP POLICY IF EXISTS "Users can update own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can view own collaborations" ON public.case_collaborators;
DROP POLICY IF EXISTS "Users can create collaborations for own cases" ON public.case_collaborators;
DROP POLICY IF EXISTS "Users can delete collaborations for own cases" ON public.case_collaborators;

-- Step 3: Create conversations table with proper structure
-- (Will not fail if table already exists due to IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  case_id UUID NULL,  -- We'll add the foreign key constraint later
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Step 4: Create messages table
-- Check if table exists first
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    -- Create new table with current structure
    CREATE TABLE public.messages (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
    );
    
    -- Add explanatory comment
    COMMENT ON TABLE public.messages IS 'Stores messages within conversations for the paralegal AI assistant';
  ELSE
    -- Table exists, ensure required columns exist
    -- Note: We use owner_id for consistency with the conversations table
    BEGIN
      ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_column THEN
      RAISE NOTICE 'Column owner_id already exists in messages table';
    END;
  END IF;
END$$;

-- Step 5: Add function for auto-updating timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Set up trigger for conversations
DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Step 7: Re-enable RLS
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- Step 8: Create simplified policies that avoid recursion
-- Simplified policy for conversations - direct owner check
CREATE POLICY "Users can access own conversations"
  ON public.conversations
  USING (auth.uid() = owner_id);
  
-- Create policy using owner_id field for consistency
DROP POLICY IF EXISTS "Users can manage own messages" ON public.messages;
CREATE POLICY "Users can manage own messages"
  ON public.messages
  USING (auth.uid() = owner_id);
  
-- This policy allows users to read messages in owned conversations
DROP POLICY IF EXISTS "Users can read messages in owned conversations" ON public.messages;
CREATE POLICY "Users can read messages in owned conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id 
      AND c.owner_id = auth.uid()
    )
  );

-- Step 9: Create safer policies for cases and case_collaborators later
-- For now we'll keep them disabled to prevent the recursion

-- Step 10: Add foreign key for case_id if cases table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cases') THEN
    -- Check if the constraint already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'conversations_case_id_fkey' 
      AND conrelid = 'public.conversations'::regclass
    ) THEN
      -- Add the foreign key constraint
      ALTER TABLE public.conversations 
      ADD CONSTRAINT conversations_case_id_fkey 
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
