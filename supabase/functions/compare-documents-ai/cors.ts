// supabase/functions/compare-documents-ai/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins (adjust in production)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Standard Supabase headers + content-type
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS for preflight
}; 