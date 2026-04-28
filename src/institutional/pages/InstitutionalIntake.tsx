import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface IntakeLink {
  id: string;
  token: string;
  applicant_name: string;
  reference_id: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const InstitutionalIntake = () => {
  const { institutionId, user } = useInstitutionalAuth();
  const [applicantName, setApplicantName] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [expiryHours, setExpiryHours] = useState<string>("72");
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [links, setLinks] = useState<IntakeLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    if (!institutionId) return;
    const { data } = await (supabase.from as any)('intake_links')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLinks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, [institutionId]);

  const generateLink = async () => {
    if (!applicantName.trim() || !referenceId.trim()) {
      toast.error("Applicant name and reference ID are required.");
      return;
    }
    if (!institutionId || !user) return;
    setGenerating(true);

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const hours = parseInt(expiryHours, 10) || 72;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const { error } = await (supabase.from as any)('intake_links').insert({
      institution_id: institutionId,
      created_by: user.id,
      token,
      applicant_name: applicantName.trim(),
      reference_id: referenceId.trim(),
      status: 'active',
      expires_at: expiresAt,
    });

    if (error) {
      toast.error("Failed to generate link. Please try again.");
      setGenerating(false);
      return;
    }

    await (supabase.from as any)('institutional_activity_log').insert({
      institution_id: institutionId,
      user_id: user.id,
      event_type: 'Intake Link Generated',
      reference_id: referenceId.trim(),
      applicant_name: applicantName.trim(),
      detail: `Intake link generated, expires ${format(new Date(expiresAt), "MMM d, yyyy HH:mm")}`,
    });

    setGeneratedLink(`${window.location.origin}/submit/${token}`);
    setApplicantName("");
    setReferenceId("");
    setGenerating(false);
    fetchLinks();
    toast.success("Intake link generated successfully.");
  };

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard.");
    }
  };

  const statusBadge = (status: string, expiresAt: string) => {
    if (status === 'submitted') return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Submitted</Badge>;
    if (new Date(expiresAt) < new Date()) return <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">Expired</Badge>;
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">Active</Badge>;
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Document Intake</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">Generate applicant-specific document upload links.</p>

      <div className="border border-slate-200 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1.5 block">Applicant Name</label>
            <Input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} placeholder="Jane Doe" className="border-slate-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1.5 block">Reference ID</label>
            <Input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="APP-2024-001" className="border-slate-200" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1.5 block">Secure Window</label>
            <Select value={expiryHours} onValueChange={setExpiryHours}>
              <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">48 hours</SelectItem>
                <SelectItem value="72">72 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generateLink} disabled={generating} className="bg-slate-900 hover:bg-slate-800 text-white">
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
          Generate Intake Link
        </Button>

        {generatedLink && (
          <div className="mt-4 p-4 bg-slate-50 rounded-md border border-slate-200">
            <p className="text-xs text-slate-500 mb-2">Share this link with the applicant. Expires in {expiryHours} hours.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white px-3 py-2 rounded border border-slate-200 text-slate-700 truncate">{generatedLink}</code>
              <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-slate-900 mb-4">Recent Links</h2>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : links.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">No intake links generated yet.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Reference ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Applicant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Generated</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map(link => (
                <tr key={link.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{link.reference_id}</td>
                  <td className="px-4 py-3 text-slate-700">{link.applicant_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{format(new Date(link.created_at), "MMM d, HH:mm")}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{format(new Date(link.expires_at), "MMM d, HH:mm")}</td>
                  <td className="px-4 py-3">{statusBadge(link.status, link.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InstitutionalIntake;
