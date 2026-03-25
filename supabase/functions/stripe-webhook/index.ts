import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    // In production, verify the webhook signature with your Stripe webhook secret
    // For now, parse the event directly
    const event = JSON.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerEmail = subscription.customer_email || subscription.metadata?.email;

        if (customerEmail) {
          // Notify user about subscription change
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .single();

          if (profile) {
            const isActive = subscription.status === "active";
            await supabase.from("notifications").insert({
              user_id: profile.user_id,
              title: isActive ? "Subscription Updated" : "Subscription Ended",
              message: isActive
                ? "Your Premium Vault subscription has been updated successfully."
                : "Your Premium Vault subscription has ended. You are now on the free tier with a 3-document limit.",
              type: isActive ? "info" : "warning",
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerEmail = invoice.customer_email;

        if (customerEmail) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .single();

          if (profile) {
            await supabase.from("notifications").insert({
              user_id: profile.user_id,
              title: "Payment Failed",
              message: "Your latest payment could not be processed. Please update your payment method to keep Premium access.",
              type: "warning",
            });
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        const customerEmail = session.customer_email;

        if (customerEmail) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .single();

          if (profile) {
            await supabase.from("notifications").insert({
              user_id: profile.user_id,
              title: "Premium Activated!",
              message: "Welcome to Premium Vault. You now have unlimited document storage and advanced features.",
              type: "success",
            });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
