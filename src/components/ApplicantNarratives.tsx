import { useState, useEffect } from "react";
import { getNarrativesForApplicant, type TrustNarrative } from "@/lib/trustNarrative";
import { TrustNarrativeCard, ScoreStateIndicator } from "@/components/TrustNarrativeCard";

interface ApplicantNarrativesProps {
  applicantUserId: string;
  compact?: boolean;
}

export function ApplicantNarratives({ applicantUserId, compact }: ApplicantNarrativesProps) {
  const [narratives, setNarratives] = useState<TrustNarrative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNarrativesForApplicant(applicantUserId).then((data) => {
      if (!cancelled) {
        setNarratives(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [applicantUserId]);

  if (loading) {
    return (
      <div className="text-[10px] text-muted-foreground font-mono py-1">
        Loading assessment...
      </div>
    );
  }

  if (narratives.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground font-mono py-1">
        No assessment narrative available
      </div>
    );
  }

  // Show the most recent narrative
  const latest = narratives[0];

  return (
    <div className="mt-3">
      <TrustNarrativeCard narrative={latest} compact={compact} />
    </div>
  );
}

export function ApplicantScoreIndicator({ applicantUserId }: { applicantUserId: string }) {
  const [narratives, setNarratives] = useState<TrustNarrative[]>([]);

  useEffect(() => {
    getNarrativesForApplicant(applicantUserId).then(setNarratives);
  }, [applicantUserId]);

  if (narratives.length === 0) return null;

  return <ScoreStateIndicator state={narratives[0].score_state as any} />;
}
