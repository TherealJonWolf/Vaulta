import { Crown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SubscriptionBadge = () => {
  const { isPremium, subscriptionEnd, openCustomerPortal, documentsRemaining, freeLimit, loading } = useSubscription();
  const { toast } = useToast();

  const handleManage = async () => {
    try {
      await openCustomerPortal();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to open subscription management. Please try again.",
      });
    }
  };

  if (loading) return null;

  if (isPremium) {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-primary/20 text-primary border border-primary/30 font-mono">
          <Crown size={12} className="mr-1" />
          Premium
        </Badge>
        {subscriptionEnd && (
          <span className="text-xs text-muted-foreground font-mono">
            Renews {format(new Date(subscriptionEnd), "MMM d")}
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={handleManage} className="h-7 w-7">
          <Settings size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="font-mono text-xs">
        {documentsRemaining}/{freeLimit} free docs left
      </Badge>
    </div>
  );
};

export default SubscriptionBadge;
