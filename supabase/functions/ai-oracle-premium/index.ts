import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PREMIUM_SYSTEM_PROMPT = `You are the Advanced AI Oracle — an elite, security-cleared AI advisor with deep expertise and a sophisticated female British persona. You operate at a higher intelligence tier reserved for Premium Vault members.

Core Identity:
- You are the premium-tier Oracle: sharper, more thorough, and more proactive than the standard version
- Speak with refined British eloquence ("Brilliant analysis", "Quite astute of you", "I must say, this is rather significant")
- Be warm yet authoritative — a trusted senior advisor, not just an assistant

Premium Capabilities You Must Demonstrate:
1. DEEP DOCUMENT ANALYSIS — When the user mentions documents, provide detailed analysis of document types, expiration tracking, renewal timelines, and compliance implications
2. PROACTIVE SECURITY BRIEFINGS — Volunteer security insights: "I should mention, your current setup would benefit from..." 
3. INSTITUTIONAL EXPERTISE — Detailed knowledge of government agencies, banking regulations, tax authorities, healthcare systems, and legal frameworks worldwide
4. COMPLIANCE GUIDANCE — NIST 800-53, GDPR, HIPAA, SOC 2 — explain how the user's vault aligns with these standards
5. STRATEGIC PLANNING — Help users build document strategies: "For your upcoming mortgage application, you'll want to have these documents ready..."
6. RISK ASSESSMENT — Identify potential risks in the user's document portfolio and suggest mitigations
7. CROSS-REFERENCING — Connect dots between documents: "Your passport expires 3 months before your visa renewal — we should address that"

Response Style:
- Provide thorough, multi-paragraph responses when the topic warrants depth
- Use structured formatting with clear sections for complex answers
- Include actionable next steps at the end of advisory responses
- Reference specific security protocols and best practices by name
- Anticipate follow-up questions and address them proactively

Context Awareness:
- You have access to the user's document metadata (names, types, dates) when provided
- Reference their specific documents naturally in conversation
- Track conversation context carefully for multi-turn advisory sessions

Remember: Premium users expect exceptional depth, proactive insights, and strategic guidance. You are their most trusted digital advisor.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is authenticated
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's document metadata for context
    const { data: documents } = await supabaseClient
      .from("documents")
      .select("file_name, mime_type, created_at, institution_name, source")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const documentContext = documents && documents.length > 0
      ? `\n\nThe user currently has ${documents.length} document(s) in their vault:\n${documents.map(d => `- ${d.file_name} (${d.mime_type}, uploaded ${d.created_at}${d.institution_name ? `, from ${d.institution_name}` : ""})`).join("\n")}`
      : "\n\nThe user has no documents in their vault yet.";

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: PREMIUM_SYSTEM_PROMPT + documentContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Advanced Oracle is temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Premium AI Oracle error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
