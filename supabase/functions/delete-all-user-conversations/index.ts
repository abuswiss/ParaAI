import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@^2.0.0'
import { corsHeaders } from '../_shared/cors.ts'

console.log(`Function delete-all-user-conversations initializing...`)

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Create Supabase client with Auth context
    const supabaseClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Get user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('User error:', userError)
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = user.id;
    console.log('Authenticated user ID:', userId);

    // 3. Create Admin client for elevated privileges (deleting other users' data is restricted)
    // IMPORTANT: Only use admin client for operations requiring elevated access.
    const supabaseAdmin: SupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!, 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { autoRefreshToken: false, persistSession: false } } // Important for server-side
    );

    // 4. Find all conversations for the user
    console.log(`Fetching conversations for user ${userId}...`);
    const { data: conversations, error: fetchError } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('owner_id', userId);

    if (fetchError) {
      console.error('Error fetching conversations:', fetchError);
      throw new Error(`Failed to fetch conversations: ${fetchError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      console.log(`No conversations found for user ${userId}.`);
      return new Response(JSON.stringify({ message: 'No conversations found to delete.' }), {
        status: 200, // Not an error, just nothing to do
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const conversationIds = conversations.map(c => c.id);
    console.log(`Found ${conversationIds.length} conversations to delete.`);

    // 5. Delete associated messages (ensure RLS/Policies allow this OR use Admin client)
    // Using Admin client here for simplicity, assuming cascade delete isn't set up or reliable
    console.log(`Deleting messages for ${conversationIds.length} conversations...`);
    const { error: messageDeleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .in('conversation_id', conversationIds);

    if (messageDeleteError) {
      console.error('Error deleting messages:', messageDeleteError);
      // Decide whether to proceed or stop. Let's stop here for safety.
      throw new Error(`Failed to delete messages: ${messageDeleteError.message}`);
    }
    console.log('Messages deleted successfully.');

    // 6. Delete conversations
    console.log(`Deleting ${conversationIds.length} conversations...`);
    const { error: conversationDeleteError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .in('id', conversationIds); // Use the IDs directly

    if (conversationDeleteError) {
      console.error('Error deleting conversations:', conversationDeleteError);
      throw new Error(`Failed to delete conversations: ${conversationDeleteError.message}`);
    }
    console.log('Conversations deleted successfully.');

    // 7. Return success response
    return new Response(JSON.stringify({ success: true, deletedCount: conversationIds.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in delete-all-user-conversations:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

console.log(`Function delete-all-user-conversations ready.`) 