import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage, base64Content, mimeType } = await req.json();

    if (!targetLanguage) {
      return new Response(JSON.stringify({ error: "Missing targetLanguage" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text && !base64Content) {
      return new Response(JSON.stringify({ error: "Missing text or base64Content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const languageNames: Record<string, string> = {
      en: "English",
      "fr-CA": "French Canadian (Québécois French)",
      es: "Spanish",
    };

    const langName = languageNames[targetLanguage] || targetLanguage;

    // Build messages based on whether we have text or binary content
    const userContent: any[] = [];

    if (base64Content && mimeType) {
      // For binary documents (PDF, images), use vision to extract and translate
      userContent.push({
        type: "text",
        text: `Extract ALL text from this document and translate it to ${langName}. Return ONLY the translated text, preserving the original structure and formatting as much as possible. If the document contains no readable text, respond with "[No translatable text found in document]".`,
      });
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Content}`,
        },
      });
    } else {
      userContent.push({
        type: "text",
        text: text,
      });
    }

    const systemPrompt = base64Content
      ? `You are a professional document translator and OCR specialist. Extract text from the provided document image and translate it to ${langName}. Preserve formatting and structure. Return ONLY the translated text.`
      : `You are a professional document translator. Translate the following text to ${langName}. Return ONLY the translated text, no explanations or extra formatting. Preserve the original formatting and structure as much as possible.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Translation failed: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ translatedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
