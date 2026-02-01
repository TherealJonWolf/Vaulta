import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface SubscriptionStatus {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  isPremium: boolean;
  loading: boolean;
  error: string | null;
}

const FREE_DOCUMENT_LIMIT = 3;

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
    isPremium: false,
    loading: true,
    error: null,
  });
  const [documentCount, setDocumentCount] = useState(0);

  const checkSubscription = useCallback(async () => {
    if (!user || !session) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) throw error;

      setStatus({
        subscribed: data.subscribed || false,
        productId: data.product_id || null,
        subscriptionEnd: data.subscription_end || null,
        isPremium: data.is_premium || false,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Error checking subscription:", err);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to check subscription",
      }));
    }
  }, [user, session]);

  const fetchDocumentCount = useCallback(async (): Promise<number> => {
    if (!user) return 0;

    const { count, error } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    const docCount = (!error && count !== null) ? count : 0;
    setDocumentCount(docCount);
    return docCount;
  }, [user]);

  // Check upload eligibility with fresh data
  const checkCanUpload = useCallback(async (): Promise<boolean> => {
    if (status.isPremium) return true;
    
    const count = await fetchDocumentCount();
    return count < FREE_DOCUMENT_LIMIT;
  }, [status.isPremium, fetchDocumentCount]);

  const createCheckout = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
      throw err;
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening customer portal:", err);
      throw err;
    }
  };

  // Check if user can upload more documents
  const canUpload = status.isPremium || documentCount < FREE_DOCUMENT_LIMIT;
  const documentsRemaining = Math.max(0, FREE_DOCUMENT_LIMIT - documentCount);

  useEffect(() => {
    if (user && session) {
      checkSubscription();
      fetchDocumentCount();
    }
  }, [user, session, checkSubscription, fetchDocumentCount]);

  // Refresh subscription status periodically
  useEffect(() => {
    if (!user || !session) return;

    const interval = setInterval(checkSubscription, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user, session, checkSubscription]);

  return {
    ...status,
    documentCount,
    canUpload,
    documentsRemaining,
    freeLimit: FREE_DOCUMENT_LIMIT,
    checkSubscription,
    fetchDocumentCount,
    checkCanUpload,
    createCheckout,
    openCustomerPortal,
  };
};
