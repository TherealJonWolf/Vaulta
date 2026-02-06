import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, Download, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { calculateTrustScore, saveTrustScore, getLatestTrustScore, TrustScoreResult } from "@/lib/trustScore";
import { useToast } from "@/hooks/use-toast";

interface TrustScoreDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrustScoreDashboard({ open, onOpenChange }: TrustScoreDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrustScoreResult | null>(null);
  const [showFactors, setShowFactors] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadCachedScore();
    }
  }, [open, user]);

  const loadCachedScore = async () => {
    if (!user) return;
    const cached = await getLatestTrustScore(user.id);
    if (cached) {
      setResult(cached);
    }
  };

  const runTrustAnalysis = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const scoreResult = await calculateTrustScore(user.id);
      setResult(scoreResult);
      await saveTrustScore(user.id, scoreResult);
      toast({
        title: "Trust Score Calculated",
        description: `Your trust score is ${scoreResult.trustScore}/100`,
      });
    } catch (error) {
      console.error("Failed to calculate trust score:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "Could not calculate trust score. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTrustIcon = (level: string) => {
    switch (level) {
      case "Highly Trusted":
        return <ShieldCheck className="text-emerald-500" size={32} />;
      case "Trusted":
        return <Shield className="text-primary" size={32} />;
      case "Neutral":
        return <Shield className="text-yellow-500" size={32} />;
      case "Low Trust":
        return <ShieldAlert className="text-orange-500" size={32} />;
      case "Restricted":
        return <ShieldX className="text-destructive" size={32} />;
      default:
        return <Shield className="text-muted-foreground" size={32} />;
    }
  };

  const getTrustColor = (score: number): string => {
    if (score >= 90) return "from-emerald-500 to-green-400";
    if (score >= 70) return "from-primary to-accent";
    if (score >= 50) return "from-yellow-500 to-orange-400";
    if (score >= 30) return "from-orange-500 to-red-400";
    return "from-red-600 to-red-500";
  };

  const getProgressColor = (score: number): string => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 70) return "bg-primary";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 30) return "bg-orange-500";
    return "bg-destructive";
  };

  const exportReport = () => {
    if (!result) return;
    const report = {
      generatedAt: new Date().toISOString(),
      platform: "Vaulta Security Platform",
      ...result,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaulta-trust-score-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl gradient-text">
            <TrendingUp className="text-primary" size={24} />
            Trust Score Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!result ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Shield className="mx-auto text-muted-foreground mb-4" size={64} />
              <h3 className="font-display text-lg mb-2">Calculate Your Trust Score</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Analyze your account's security posture, behavioral patterns, and platform engagement.
              </p>
              <Button onClick={runTrustAnalysis} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    Run Trust Analysis
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Score Display */}
                <Card className="border-border bg-gradient-to-br from-card to-card/80">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getTrustColor(result.trustScore)} flex items-center justify-center`}>
                          <span className="text-3xl font-bold text-white font-display">
                            {result.trustScore}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1">
                          {getTrustIcon(result.trustLevel)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-display text-xl font-bold">{result.trustLevel}</h3>
                          <Badge variant="outline" className="text-xs">
                            {result.confidence} Confidence
                          </Badge>
                        </div>
                        <Progress
                          value={result.trustScore}
                          className={`h-2 ${getProgressColor(result.trustScore)}`}
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          {result.explanation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Factors Accordion */}
                <Card className="border-border">
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => setShowFactors(!showFactors)}
                  >
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="text-primary" size={18} />
                        Contributing Factors
                      </span>
                      {showFactors ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </CardTitle>
                  </CardHeader>
                  <AnimatePresence>
                    {showFactors && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0 space-y-4">
                          {result.positiveFactors.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-emerald-500 mb-2 flex items-center gap-1">
                                <CheckCircle2 size={14} />
                                Positive Factors
                              </h4>
                              <ul className="space-y-1">
                                {result.positiveFactors.map((factor, i) => (
                                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <span className="text-emerald-500 mt-0.5">+</span>
                                    {factor}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.negativeFactors.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-orange-500 mb-2 flex items-center gap-1">
                                <XCircle size={14} />
                                Negative Factors
                              </h4>
                              <ul className="space-y-1">
                                {result.negativeFactors.map((factor, i) => (
                                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                    <span className="text-orange-500 mt-0.5">−</span>
                                    {factor}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                {/* Recommendations */}
                {result.recommendations.length > 0 && (
                  <Card className="border-border">
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => setShowRecommendations(!showRecommendations)}
                    >
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="text-yellow-500" size={18} />
                          Recommendations
                        </span>
                        {showRecommendations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </CardTitle>
                    </CardHeader>
                    <AnimatePresence>
                      {showRecommendations && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CardContent className="pt-0">
                            <ul className="space-y-2">
                              {result.recommendations.map((rec, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="text-primary font-bold">{i + 1}.</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button onClick={runTrustAnalysis} disabled={loading} variant="outline" className="flex-1 gap-2">
                    {loading ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Recalculate
                  </Button>
                  <Button onClick={exportReport} variant="outline" className="flex-1 gap-2">
                    <Download size={16} />
                    Export Report
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
