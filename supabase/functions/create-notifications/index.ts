import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const { userIds, title, message, type } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Response("userIds is required", { status: 400, headers: corsHeaders });
    }
    if (!title || !message || !type) {
      return new Response("title/message/type is required", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const rows = userIds.map((user_id: string) => ({
      user_id,
      title,
      message,
      type,
    }));

    const { data, error } = await admin
      .from("notifications")
      .insert(rows)
      .select();

    if (error) {
      return new Response(error.message, { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
});
