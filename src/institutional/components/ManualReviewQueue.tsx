import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ReviewItem {
  id: string;
  document_id: string;
  user_id: string;
  institution_id: string;
  file_name: string;
  mime_type: string | null;
  ai_confidence: number;
  ai_summary: string | null;
  ai_issues: string[];
  ai_generated_likelihood: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_decision: string | null;
  review_notes: string | null;
  created_at: string;
}

type FilterStatus = "pending" | "approved" | "rejected" | "all";

export const ManualReviewQueue = () => {
  const { institutionId } = useInstitutionalAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!institutionId) return;
    let query = (supabase.from as any)("manual_review_queue")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch review queue:", error);
      return;
    }
    setItems(
      (data || []).map((d: any) => ({
        ...d,
        ai_issues: Array.isArray(d.ai_issues) ? d.ai_issues : [],
      }))
    );
    setLoading(false);
  }, [institutionId, filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleReview = (item: ReviewItem) => {
    setSelectedItem(item);
    setReviewNotes("");
    setDialogOpen(true);
  };

  const submitDecision = async (decision: "approved" | "rejected") => {
    if (!selectedItem) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke("review-decision", {
        body: {
          reviewItemId: selectedItem.id,
          decision,
          notes: reviewNotes.trim() || null,
        },
      });

      if (error) throw error;

      toast.success(
        decision === "approved"
          ? "Document approved — trust score updated"
          : "Document rejected — trust score adjusted"
      );
      setDialogOpen(false);
      setSelectedItem(null);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit decision");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = items.filter((i) => i.status === "pending").length;

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 70)
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          {confidence}%
        </Badge>
      );
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
        {confidence}%
      </Badge>
    );
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 text-xs gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 text-xs gap-1">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Document Review Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Documents with borderline AI confidence (60–75%) requiring human review
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "rejected", "all"] as FilterStatus[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter(f); setLoading(true); }}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Eye className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No documents in the {filter} queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-md">
                    <FileText className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.file_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Submitted {format(new Date(item.created_at), "MMM d, yyyy 'at' HH:mm")}
                    </p>
                    {item.ai_summary && (
                      <p className="text-xs text-slate-600 mt-2 max-w-lg">{item.ai_summary}</p>
                    )}
                    {item.ai_issues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.ai_issues.map((issue, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200"
                          >
                            {issue}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.review_notes && item.status !== "pending" && (
                      <p className="text-xs text-slate-500 mt-2 italic">
                        Note: {item.review_notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right space-y-1">
                    {confidenceBadge(item.ai_confidence)}
                    <div>{statusBadge(item.status)}</div>
                    {item.ai_generated_likelihood !== "none" && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                        AI-gen: {item.ai_generated_likelihood}
                      </Badge>
                    )}
                  </div>
                  {item.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(item)}
                    >
                      Review
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Decision Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-md space-y-2">
                <p className="text-sm font-medium">{selectedItem.file_name}</p>
                <div className="flex gap-2">
                  {confidenceBadge(selectedItem.ai_confidence)}
                  {selectedItem.ai_generated_likelihood !== "none" && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                      AI-gen: {selectedItem.ai_generated_likelihood}
                    </Badge>
                  )}
                </div>
                {selectedItem.ai_summary && (
                  <p className="text-xs text-slate-600">{selectedItem.ai_summary}</p>
                )}
                {selectedItem.ai_issues.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-1">Issues flagged:</p>
                    <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                      {selectedItem.ai_issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Review Notes (optional)</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => submitDecision("rejected")}
              disabled={submitting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
              Reject
            </Button>
            <Button
              onClick={() => submitDecision("approved")}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
