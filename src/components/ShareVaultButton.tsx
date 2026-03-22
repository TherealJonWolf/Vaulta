import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Copy, CheckCircle2, Clock, Trash2, Link2, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface SharedToken {
  id: string;
  token: string;
  label: string;
  expires_at: string;
  is_active: boolean;
  view_count: number;
  created_at: string;
}

const ShareVaultButton = () => {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<SharedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("7");
  const [copied, setCopied] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) fetchTokens();
  }, [open, user]);

  const fetchTokens = async () => {
    setLoading(true);
    const { data } = await (supabase.from("shared_profile_tokens") as any)
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setTokens(data || []);
    setLoading(false);
  };

  const generateToken = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let result = "";
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    for (const byte of array) {
      result += chars[byte % chars.length];
    }
    return result;
  };

  const createShareLink = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiry));

      const { error } = await (supabase.from("shared_profile_tokens") as any).insert({
        user_id: user.id,
        token,
        label: label || "Shared Profile",
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Share Link Created",
        description: "Your shareable profile link is ready.",
      });
      setLabel("");
      fetchTokens();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Link Copied", description: "Share this link with your landlord or property manager." });
  };

  const revokeToken = async (id: string) => {
    await (supabase.from("shared_profile_tokens") as any)
      .update({ is_active: false })
      .eq("id", id);
    toast({ title: "Link Revoked", description: "This share link has been deactivated." });
    fetchTokens();
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground"
        title="Share Profile"
      >
        <Share2 size={18} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 gradient-text">
              <Share2 size={20} />
              Share Your Verified Profile
            </DialogTitle>
            <DialogDescription className="font-rajdhani">
              Generate a secure link so landlords and property managers can view your trust score and document verification reports.
            </DialogDescription>
          </DialogHeader>

          {/* Create new link */}
          <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
            <div className="space-y-2">
              <Label className="font-rajdhani text-sm">Link Label (optional)</Label>
              <Input
                placeholder="e.g. 123 Main St Application"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="bg-card/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-rajdhani text-sm">Expires In</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className="bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={createShareLink}
              disabled={creating}
              className="w-full btn-gradient font-rajdhani font-bold text-primary-foreground"
            >
              <Plus size={16} className="mr-2" />
              {creating ? "Creating..." : "Generate Share Link"}
            </Button>
          </div>

          {/* Existing links */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Active Share Links
            </h3>
            {loading ? (
              <p className="text-muted-foreground font-mono text-sm text-center py-4">Loading...</p>
            ) : tokens.length === 0 ? (
              <p className="text-muted-foreground font-mono text-sm text-center py-4">
                No share links yet. Create one above.
              </p>
            ) : (
              <AnimatePresence>
                {tokens.map((t) => {
                  const expired = isExpired(t.expires_at);
                  const inactive = !t.is_active;
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-3 rounded-lg border ${
                        expired || inactive
                          ? "border-border/50 opacity-60"
                          : "border-primary/20 bg-card/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Link2 size={14} className="text-primary shrink-0" />
                            <span className="font-display font-bold text-sm truncate">
                              {t.label}
                            </span>
                            {expired && (
                              <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                                EXPIRED
                              </Badge>
                            )}
                            {inactive && !expired && (
                              <Badge variant="destructive" className="text-[10px] font-mono shrink-0">
                                REVOKED
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {expired
                                ? "Expired"
                                : `Expires ${new Date(t.expires_at).toLocaleDateString()}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye size={10} />
                              {t.view_count} views
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!expired && !inactive && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyLink(t.token)}
                              >
                                {copied === t.token ? (
                                  <CheckCircle2 size={14} className="text-secure-green" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => revokeToken(t.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground font-mono">
              🔒 Shared profiles show your trust score and verification audit reports only. Landlords cannot access your raw documents.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareVaultButton;
