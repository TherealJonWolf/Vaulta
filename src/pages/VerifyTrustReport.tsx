import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface VerifyResult {
  valid: boolean;
  generated_at?: string;
  trust_score?: number;
  trust_level?: string;
  version?: string;
  message?: string;
}

export default function VerifyTrustReport() {
  const { hash } = useParams<{ hash: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hash) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "verify-trust-report",
          { body: { report_hash: hash } },
        );
        if (cancelled) return;
        if (error) {
          setResult({ valid: false, message: error.message });
        } else {
          setResult(data as VerifyResult);
        }
      } catch (err) {
        if (!cancelled) {
          setResult({
            valid: false,
            message: err instanceof Error ? err.message : "Verification failed",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hash]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Vaulta
        </Link>

        <div className="mt-6">
          <h1 className="text-3xl font-bold">Verify Trust Report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Independent authenticity check for a Vaulta Verified Trust Report.
            No personally identifying information is exposed.
          </p>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Report Hash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="block break-all font-mono text-xs">{hash}</code>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="py-8">
            {loading ? (
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying…
              </div>
            ) : result?.valid ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-primary">
                  <ShieldCheck className="h-8 w-8" />
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      Authentic
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Hash matches an immutable Vaulta snapshot.
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Trust Score
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {Math.round(result.trust_score ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Trust Level
                    </dt>
                    <dd className="mt-1 text-base font-semibold capitalize">
                      {result.trust_level?.replace(/_/g, " ")}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs uppercase text-muted-foreground">
                      Generated
                    </dt>
                    <dd className="mt-1 text-sm">
                      {result.generated_at
                        ? new Date(result.generated_at).toUTCString()
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Schema Version
                    </dt>
                    <dd className="mt-1 text-sm">{result.version}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-destructive">
                <ShieldAlert className="h-8 w-8" />
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    Not Verified
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {result?.message ??
                      "No matching report found. The hash may be invalid or the report has been revoked."}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Verification queries are anonymous and rate-limited. Vaulta cannot
          reconstruct the underlying user identity from a report hash.
        </p>
      </div>
    </div>
  );
}