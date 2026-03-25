import { useState, useEffect } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNarrativesForApplicant, type TrustNarrative } from "@/lib/trustNarrative";
import { TrustNarrativeCard, ScoreStateIndicator } from "@/components/TrustNarrativeCard";
import { NarrativeTimelineDialog } from "@/components/NarrativeTimeline";

interface ApplicantNarrativesProps {
  applicantUserId: string;
  applicantLabel?: string;
  compact?: boolean;
}

export function ApplicantNarratives({ applicantUserId, applicantLabel, compact }: ApplicantNarrativesProps) {
  const [narratives, setNarratives] = useState<TrustNarrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);

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

  const latest = narratives[0];

  return (
    <div className="mt-3">
      <TrustNarrativeCard narrative={latest} compact={compact} />
      {narratives.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5 h-6 text-[10px] font-mono gap-1 text-muted-foreground hover:text-primary"
          onClick={() => setTimelineOpen(true)}
        >
          <History size={10} />
          {narratives.length} assessments — view history
        </Button>
      )}
      <NarrativeTimelineDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        applicantUserId={applicantUserId}
        applicantLabel={applicantLabel}
      />
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
