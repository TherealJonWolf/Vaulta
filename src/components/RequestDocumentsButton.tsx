import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileInput, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPossessionRequest } from "@/institutional/components/DocumentPossessionRequest";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Reusable "Request Documents" launcher for landlord / lender portals.
 * It ensures the caller has an institution attached (creates one on first use),
 * then opens the existing institutional possession-request wizard.
 */
interface Props {
  applicantUserId: string;
  applicantName: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
  className?: string;
}

export const RequestDocumentsButton = ({
  applicantUserId,
  applicantName,
  variant = "outline",
  size = "sm",
  className,
}: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [institutionReady, setInstitutionReady] = useState(false);

  useEffect(() => {
    if (!user || institutionReady) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("ensure_institutional_access", {
        _user_id: user.id,
      });
      if (!error && data && !data.error) setInstitutionReady(true);
    })();
  }, [user, institutionReady]);

  const handleOpen = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Confirm membership is provisioned
      const { data, error } = await (supabase as any).rpc("ensure_institutional_access", {
        _user_id: user.id,
      });
      if (error || (data && data.error)) {
        toast.error("You don't have permission to request documents.");
        return;
      }
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <FileInput className="h-3.5 w-3.5 mr-1.5" />
        )}
        Request Documents
      </Button>
      <DocumentPossessionRequest
        open={open}
        onClose={() => setOpen(false)}
        applicantName={applicantName}
        applicantUserId={applicantUserId}
        submissionId={null}
        referenceId={null}
      />
    </>
  );
};