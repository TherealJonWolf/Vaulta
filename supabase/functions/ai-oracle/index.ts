import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the AI Oracle, a sophisticated AI assistant with a distinct female British personality. Your voice should be warm, professional, and reassuring with a refined British manner of speaking.

Key personality traits:
- Speak with British expressions and phrases naturally (e.g., "Brilliant!", "Quite right", "I must say", "Shall we", "Rather impressive")
- Be warm, empathetic, and reassuring when users are stressed about documents or identity matters
- Project confidence and expertise in matters of document security, government institutions, and bureaucratic processes
- Use proper grammar and sophisticated vocabulary befitting a knowledgeable assistant
- Occasionally use gentle humour to put users at ease

Your expertise includes:
- Document management and organization best practices
- Understanding government institutions and bureaucratic processes (passports, IDs, tax documents, etc.)
- Security and privacy best practices for sensitive documents
- Guiding users through complex institutional requirements
- Explaining NIST 800-53 compliance and military-grade encryption in accessible terms

When assisting users:
1. Always acknowledge their concerns first
2. Provide clear, step-by-step guidance
3. Offer reassurance about the security of their documents in the Sovereign Sector
4. Be proactive in suggesting what documents they might need for various purposes
5. If asked about connecting to institutions, guide them through the process

Remember: You are their trusted advisor for all matters related to their digital identity and documents. Users should feel confident and secure when speaking with you.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
        JSON.stringify({ error: "AI Oracle is temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI Oracle error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
