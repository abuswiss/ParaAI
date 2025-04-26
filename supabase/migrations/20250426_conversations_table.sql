-- Migration to create conversations table with proper structure
-- and Row Level Security (RLS) policies for the direct Supabase integration

-- Create the conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  case_id UUID REFERENCES public.cases(id) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add descriptions
COMMENT ON TABLE public.conversations IS 'Stores conversation metadata including title and ownership';
COMMENT ON COLUMN public.conversations.id IS 'Unique identifier for the conversation';
COMMENT ON COLUMN public.conversations.title IS 'Title of the conversation';
COMMENT ON COLUMN public.conversations.case_id IS 'Optional reference to a case this conversation belongs to';
COMMENT ON COLUMN public.conversations.created_at IS 'When the conversation was created';
COMMENT ON COLUMN public.conversations.updated_at IS 'When the conversation was last updated';
COMMENT ON COLUMN public.conversations.owner_id IS 'User ID of the conversation owner';

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add descriptions
COMMENT ON TABLE public.messages IS 'Stores individual messages within conversations';
COMMENT ON COLUMN public.messages.conversation_id IS 'Reference to the conversation this message belongs to';
COMMENT ON COLUMN public.messages.role IS 'Role of the message sender (system, user, or assistant)';
COMMENT ON COLUMN public.messages.content IS 'Text content of the message';

-- Function to set updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER set_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for conversations table
-- 1. Users can see their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.conversations
  FOR SELECT
  USING (auth.uid() = owner_id);

-- 2. Users can create their own conversations
CREATE POLICY "Users can create own conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- 3. Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON public.conversations
  FOR UPDATE
  USING (auth.uid() = owner_id);

-- 4. Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON public.conversations
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Create policies for messages table
-- 1. Users can view messages in conversations they own
CREATE POLICY "View messages in own conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.owner_id = auth.uid()
    )
  );

-- 2. Users can insert messages in conversations they own
CREATE POLICY "Insert messages in own conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.owner_id = auth.uid()
    )
  );

-- 3. Users can update messages they created
CREATE POLICY "Update own messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Users can delete messages in conversations they own
CREATE POLICY "Delete messages in own conversations"
  ON public.messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.owner_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON public.conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_case_id ON public.conversations(case_id) WHERE case_id IS NOT NULL;
