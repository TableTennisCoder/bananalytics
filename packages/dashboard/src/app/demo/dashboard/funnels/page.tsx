import { FunnelBuilder } from "@/components/dashboard/funnel-builder";

/**
 * Demo funnel with a realistic e-commerce sequence, split by platform so the
 * segment comparison is visible without having to configure anything first.
 */
export default function DemoFunnelsPage() {
  return (
    <FunnelBuilder
      initialSteps={[
        "screen_view",
        "signup_started",
        "signup_completed",
        "add_to_cart",
        "purchase_complete",
      ]}
      initialBreakdown="platform"
    />
  );
}
