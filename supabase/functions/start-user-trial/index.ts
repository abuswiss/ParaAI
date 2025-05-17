import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2' // Using esm.sh for Deno compatibility
import { corsHeaders } from '../_shared/cors.ts' // Assuming cors.ts is in _shared

// Configuration for the trial
const TRIAL_DURATION_DAYS = 10;
const TRIAL_AI_CALLS_INITIAL_COUNT = 0; // Explicitly setting initial count

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }

    const trial_started_at = new Date().toISOString();
    const trial_ends_at_date = new Date();
    trial_ends_at_date.setDate(trial_ends_at_date.getDate() + TRIAL_DURATION_DAYS);
    const trial_ends_at = trial_ends_at_date.toISOString();

    const updatePayload = {
      subscription_status: 'trialing',
      trial_started_at,
      trial_ends_at,
      trial_ai_calls_used: TRIAL_AI_CALLS_INITIAL_COUNT,
      // Reset Stripe fields to ensure a clean trial slate
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      current_period_ends_at: null,
    };

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select() // Select the updated row to return it
      .single(); // Expect a single row to be updated and returned

    if (error) {
      console.error('Error updating profile to start trial:', error);
      // Check for specific errors, e.g., RLS or profile not found (though .single() helps)
      if (error.code === 'PGRST116') { // PGRST116: "Searched for a single row, but found no rows" (or multiple, but eq('id', ...) should prevent multiple)
         return new Response(JSON.stringify({ error: 'Profile not found for the given user ID.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404, // Not Found
        });
      }
      throw error; // Rethrow for generic error handling
    }
    
    if (!data) {
        // This case should ideally be caught by the error check above if .single() finds no row.
        // Adding as a safeguard.
        return new Response(JSON.stringify({ error: 'Profile not found or failed to update and return data.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404, 
        });
    }

    return new Response(JSON.stringify({ message: 'Trial started successfully.', profile: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Generic error in start-user-trial function:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.status || 500, // Use error status if available, else 500
    });
  }
}); 