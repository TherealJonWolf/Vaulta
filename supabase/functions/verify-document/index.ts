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
      
      // Exclude ICC color profile references like "Adobe RGB" which are NOT editing software
      const iccProfilePatterns = ["adobe rgb", "adobe srgb", "adobe icc", "adobe color"];
      const isIccProfile = iccProfilePatterns.some((p) => editorUsed.includes(p));
      
      const isEdited = !isIccProfile && suspiciousEditors.some((editor) => editorUsed.includes(editor));

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
                  content: `You are a document authenticity analyst specializing in detecting AI-generated or synthetic documents. Evaluate the provided document across THREE LAYERS and cross-reference against your internal baseline of known-authentic real-world examples for the document type (paystub, bank statement, ID, utility bill, lease, government letter, etc.).

LAYER 1 — LINGUISTIC MARKERS
   - Overly uniform phrasing, unnaturally consistent tone, or templated sentence structure with no human variation.
   - Generic placeholder-feeling language ("Dear valued customer", boilerplate that no real issuer uses verbatim).
   - Absence of normal human/institutional quirks: abbreviations, footnotes, legalese fragments, mixed casing, line-break artifacts.

LAYER 2 — FORMATTING SIGNALS
   - Suspicious precision: perfectly aligned columns, uniform kerning, mathematically clean spacing inconsistent with real printed/scanned output.
   - Missing real-world variability: no scan skew, no compression noise, no paper texture, no fold/shadow artifacts, no slight rotation.
   - Vector-clean fonts on what claims to be a scanned/photographed document; uniform background gradient where real scans show noise.

LAYER 3 — CONTEXTUAL AUTHENTICITY
   - Realistic, domain-specific details: plausible employer/bank/agency names, real-looking logos and letterhead, valid-looking reference/account numbers, jurisdictionally correct formatting.
   - Natural financial/data variability: non-round numbers, consistent tax math, believable YTD totals, realistic dates.
   - Legitimate branding cues and minor real-world inconsistencies (slight misalignments, stamp marks, handwritten notes) INCREASE authenticity.

CROSS-REFERENCE
   Compare against your baseline of authentic examples of this document type. If the document's structure, branding, and data variability are consistent with real examples you have seen, treat it as authentic.

FALSE-POSITIVE DISCIPLINE (CRITICAL)
   - Default to "Likely Authentic" unless you have STRONG, SPECIFIC evidence of synthesis.
   - Natural imperfections, varied financial data, real branding, and minor human-like inconsistencies are signs of authenticity — do NOT flag them.
   - Do not penalize a document merely for being clean or well-formatted; many real digital documents (e-statements, payroll PDFs) are crisp by design.
   - Only assign "Likely AI-Generated" when multiple layers independently show strong synthetic signals.
   - When uncertain, prefer "Likely Authentic" over "Suspicious", and "Suspicious" over "Likely AI-Generated".

OUTPUT (JSON only, no markdown):
{
  "classification": "Likely Authentic" | "Suspicious" | "Likely AI-Generated",
  "confidence": 0-100,            // confidence that the document is AI-generated/synthetic
  "authentic": true | false,      // true unless classification is "Likely AI-Generated"
  "ai_generated_likelihood": "none" | "low" | "medium" | "high",
  "layer_findings": {
     "linguistic": "short note on what you observed",
     "formatting": "short note on what you observed",
     "contextual": "short note on what you observed"
  },
  "issues": ["specific, evidence-backed signals only — empty array if none"],
  "summary": "2-3 sentence justification of the classification"
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
              const aiGenLikelihood = (analysis.ai_generated_likelihood || "none").toLowerCase();
              const classification = (analysis.classification || "Likely Authentic") as string;
              const aiConfidence = Number(analysis.confidence) || 0; // confidence that doc IS AI-generated
              // False-positive discipline: only FAIL when the model is HIGHLY confident the doc is synthetic.
              //   - "Likely AI-Generated" with confidence >= 80  → fail
              //   - "Likely AI-Generated" with 60 <= conf < 80   → pass but route to manual review
              //   - "Suspicious"                                  → pass but route to manual review
              //   - "Likely Authentic"                            → pass, no review
              const failed =
                classification === "Likely AI-Generated" && aiConfidence >= 80;
              results.aiAnalysis = {
                passed: !failed,
                classification,
                confidence: aiConfidence,
                ai_generated_likelihood: aiGenLikelihood,
                layer_findings: analysis.layer_findings || null,
                issues: analysis.issues || [],
                summary: analysis.summary,
                authentic: analysis.authentic !== false && !failed,
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

    // Queue for human review when the AI analyst is uncertain or flags the document
    // as "Suspicious" / borderline "Likely AI-Generated", or when metadata raised a warning.
    // Per false-positive discipline, "Likely Authentic" documents are NEVER queued.
    const aiConf = results.aiAnalysis?.confidence;
    const classification = (results.aiAnalysis?.classification || "").toString();
    const aiBorderline =
      classification === "Likely AI-Generated" && (aiConf || 0) >= 60 && (aiConf || 0) < 80;
    const aiSuspicious = classification === "Suspicious";
    const aiGenSuspect = ["high"].includes(
      (results.aiAnalysis?.ai_generated_likelihood || "").toLowerCase()
    ) && !results.aiAnalysis?.passed === false; // already failed = not queued, just failed
    const metadataWarn = !!results.metadataCheck?.warning || !!results.metadataCheck?.rapidEdit ||
      !!results.metadataCheck?.incrementalSaves || !!results.metadataCheck?.annotations;
    const needsManualReview = (aiBorderline || aiSuspicious || aiGenSuspect || metadataWarn);
    if (needsManualReview) {
      const { documentId, institutionId } = metadata || {};
      // document_id is nullable — only set it when the caller passed a real UUID.
      // The SHA-256 hex string is NOT a UUID and would cause 22P02 (which the
      // supabase-js client surfaces as "database error, code: 08P01").
      const isUuid = (v: unknown): v is string =>
        typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const { error: queueError } = await serviceClient
        .from("manual_review_queue")
        .insert({
          document_id: isUuid(documentId) ? documentId : null,
          document_hash: sha256Hash,
          user_id: user.id,
          institution_id: isUuid(institutionId) ? institutionId : null,
          file_name: fileName,
          mime_type: mimeType || null,
          ai_confidence: Math.round(aiConf || 0),
          ai_summary: results.aiAnalysis?.summary || null,
          ai_issues: results.aiAnalysis?.issues || [],
          ai_generated_likelihood:
            results.aiAnalysis?.ai_generated_likelihood || "none",
          verification_result: results,
          status: "pending",
        });
      if (queueError) {
        // Log but don't fail the verification — the user-facing decision is
        // already encoded in `results` and `criticalFailures`.
        console.error("manual_review_queue insert failed:", queueError);
      }
    }
    const criticalFailures = Object.entries(results)
      .filter(([, r]: any) => r.passed === false)
      .map(([key, r]: any) => ({ check: key, reason: r.reason || "Verification check failed" }));

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
