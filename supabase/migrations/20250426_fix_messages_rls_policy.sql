-- Migration to fix the messages table RLS policy for proper permissions

-- First, let's identify which columns are actually in the messages table
DO $$
DECLARE
  has_user_id BOOLEAN;
  has_owner_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'user_id'
  ) INTO has_user_id;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'owner_id'
  ) INTO has_owner_id;
  
  RAISE NOTICE 'Messages table has user_id: %, owner_id: %', has_user_id, has_owner_id;
END $$;

-- Disable RLS temporarily to make changes
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies for messages
DROP POLICY IF EXISTS "Users can manage own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read messages in owned conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can access any messages" ON public.messages;

-- Add the owner_id column if it doesn't exist (using the more reliable approach)
DO $$
BEGIN
  -- First check if column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages'
    AND column_name = 'owner_id'
  ) THEN
    -- Add the column
    ALTER TABLE public.messages ADD COLUMN owner_id UUID REFERENCES auth.users(id);
    
    -- Set owner_id from user_id for existing rows if user_id exists
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'messages'
      AND column_name = 'user_id'
    ) THEN
      UPDATE public.messages SET owner_id = user_id WHERE owner_id IS NULL;
    END IF;
  END IF;
END $$;

-- Re-enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create new simplified policies for messages
-- Allow users to insert messages into any conversation
CREATE POLICY "Users can insert messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
  
-- Allow users to read messages if they own the conversation
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
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid()) OR
    (owner_id IS NULL AND 
      EXISTS (
        SELECT 1 FROM public.conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.owner_id = auth.uid()
      )
    )
  );
  
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
  RAISE NOTICE 'Messages table RLS policies updated successfully';
END $$;
