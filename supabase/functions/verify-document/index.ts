import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sha256Hash, fileName, fileSize, mimeType, metadata } = await req.json();

    if (!sha256Hash || !fileName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Record<string, any> = {
      hashCheck: { passed: true },
      duplicateCheck: { passed: true },
      metadataCheck: { passed: true },
      aiAnalysis: { passed: true },
    };

    // 1. Check hash against flagged documents
    const { data: hashData } = await serviceClient.rpc("check_document_hash", {
      p_hash: sha256Hash,
    });

    if (hashData && hashData.length > 0 && hashData[0].is_flagged) {
      results.hashCheck = {
        passed: false,
        reason: `Previously flagged document: ${hashData[0].flag_reason}`,
      };
    }

    // 2. Cross-user duplicate detection
    if (hashData && hashData.length > 0 && hashData[0].duplicate_count > 2) {
      results.duplicateCheck = {
        passed: false,
        reason: `Document uploaded by ${hashData[0].duplicate_count} different users — possible mass-submitted forgery`,
        count: hashData[0].duplicate_count,
      };
    }

    // 3. EXIF/Metadata analysis
    if (metadata) {
      const suspiciousEditors = [
        "adobe photoshop",
        "gimp",
        "paint.net",
        "pixlr",
        "canva",
        "affinity photo",
        "corel",
      ];

      const editorUsed = (metadata.software || metadata.creator || "").toLowerCase();
      const isEdited = suspiciousEditors.some((editor) => editorUsed.includes(editor));

      if (isEdited) {
        results.metadataCheck = {
          passed: false,
          reason: `Document created/modified with image editing software: ${metadata.software || metadata.creator}`,
          software: metadata.software || metadata.creator,
        };
      }

      // Check for suspicious modification dates
      if (metadata.modifyDate && metadata.createDate) {
        const created = new Date(metadata.createDate).getTime();
        const modified = new Date(metadata.modifyDate).getTime();
        if (modified > 0 && created > 0 && modified - created < 60000) {
          // Modified within 1 minute of creation — suspicious for government docs
          results.metadataCheck.rapidEdit = true;
          results.metadataCheck.warning =
            "Document was modified within 1 minute of creation";
        }
      }

      // PDF structure validation
      if (metadata.pdfInfo) {
        const { hasIncrementalSaves, hasAnnotations, hasFormFields, producer } =
          metadata.pdfInfo;

        if (hasIncrementalSaves) {
          results.metadataCheck.incrementalSaves = true;
          results.metadataCheck.passed = false;
          results.metadataCheck.reason =
            (results.metadataCheck.reason || "") +
            " PDF has incremental saves indicating post-issuance editing.";
        }

        if (hasAnnotations) {
          results.metadataCheck.annotations = true;
          results.metadataCheck.warning =
            (results.metadataCheck.warning || "") +
            " PDF contains annotation layers.";
        }
      }
    }

    // 4. AI-powered document authenticity analysis
    if (lovableApiKey && metadata?.base64Preview) {
      try {
        const aiResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `You are a document fraud detection specialist. Analyze the provided document image for signs of forgery or tampering. Check for:
1. Font inconsistencies (mixed fonts, sizes, or weights that don't match official documents)
2. Seal/watermark irregularities (blurry, misaligned, or digitally overlaid seals)
3. Layout anomalies (misaligned text, uneven spacing, incorrect margins for official documents)
4. Color inconsistencies (different ink colors, digital artifacts, compression anomalies)
5. Text overlay signs (text that appears pasted over existing content)
6. Missing or incorrect official formatting (wrong letterhead, incorrect date formats, missing reference numbers)

Respond ONLY with a JSON object (no markdown):
{
  "authentic": true/false,
  "confidence": 0-100,
  "issues": ["list of specific issues found"],
  "summary": "brief assessment"
}`,
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Analyze this ${mimeType} document named "${fileName}" for authenticity. File size: ${fileSize} bytes.`,
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${metadata.base64Preview}`,
                      },
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";

          try {
            // Try to parse JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const analysis = JSON.parse(jsonMatch[0]);
              results.aiAnalysis = {
                passed: analysis.authentic !== false || analysis.confidence > 70,
                confidence: analysis.confidence,
                issues: analysis.issues || [],
                summary: analysis.summary,
                authentic: analysis.authentic,
              };
            }
          } catch {
            console.error("Failed to parse AI analysis response");
            results.aiAnalysis = { passed: true, note: "AI analysis inconclusive" };
          }
        } else if (aiResponse.status === 429) {
          results.aiAnalysis = { passed: true, note: "Rate limited — skipped AI analysis" };
        } else if (aiResponse.status === 402) {
          results.aiAnalysis = { passed: true, note: "Credits exhausted — skipped AI analysis" };
        }
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
        results.aiAnalysis = { passed: true, note: "AI analysis unavailable" };
      }
    }

    // Store the hash record
    await serviceClient.from("document_hashes").insert({
      sha256_hash: sha256Hash,
      user_id: user.id,
      file_name: fileName,
      file_size: fileSize || 0,
    });

    // Overall verdict
    const allPassed = Object.values(results).every((r: any) => r.passed !== false);
    const criticalFailures = Object.entries(results)
      .filter(([, r]: any) => r.passed === false)
      .map(([key, r]: any) => ({ check: key, reason: r.reason }));

    return new Response(
      JSON.stringify({
        verified: allPassed,
        results,
        criticalFailures,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
