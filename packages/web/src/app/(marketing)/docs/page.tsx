"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Terminal,
  Smartphone,
  Server,
  Key,
  Globe,
  Shield,
  Target,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

const sidebarItems = [
  { id: "quick-start", label: "Quick Start", icon: Terminal },
  { id: "ai-setup", label: "AI Setup", icon: Sparkles },
  { id: "sdk", label: "React Native SDK", icon: Smartphone },
  { id: "event-strategy", label: "Event Strategy", icon: Target },
  { id: "api", label: "API Reference", icon: Server },
  { id: "hosting", label: "Self-Hosting", icon: Globe },
  { id: "config", label: "Configuration", icon: Key },
  { id: "privacy", label: "Privacy", icon: Shield },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("quick-start");

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const item of sidebarItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link href="/login">
            <Button size="sm">Dashboard</Button>
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — Launchbox style with numbered items and active bar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-48 shrink-0 overflow-y-auto lg:block">
          <nav className="py-8 pl-8 pr-2">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              On this page
            </p>
            <div className="relative">
              {/* Vertical track line */}
              <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-0">
                {sidebarItems.map((item, i) => {
                  const isActive = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={cn(
                        "relative block py-1.5 pl-4 text-[13px] transition-colors",
                        isActive
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground/70 hover:text-foreground",
                      )}
                    >
                      {/* Active bar — orange, covers the gray line */}
                      {isActive && (
                        <div className="absolute left-[-0.5px] top-0.5 bottom-0.5 w-[2px] rounded-full bg-primary" />
                      )}
                      {i + 1}. {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="mx-auto max-w-4xl flex-1 px-6 py-16 lg:px-12">
          <div className="mb-12">
            <h1 className="text-4xl font-bold">Documentation</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Everything you need to set up and use Bananalytics Analytics
            </p>
          </div>

          <div className="space-y-16">
          {/* Quick Start */}
          <DocSection
            icon={<Terminal className="h-5 w-5" />}
            title="Quick Start"
            id="quick-start"
          >
            <p>Get Bananalytics running in 5 minutes with Docker.</p>
            <CodeBlock title="1. Clone & start the backend">{`git clone https://github.com/bananalytics-analytics/bananalytics.git
cd bananalytics/server
docker-compose up -d`}</CodeBlock>
            <CodeBlock title="2. Run database migrations">{`docker exec -i server-postgres-1 psql -U bananalytics -d bananalytics \\
  < internal/storage/postgres/migrations/001_create_projects.up.sql
docker exec -i server-postgres-1 psql -U bananalytics -d bananalytics \\
  < internal/storage/postgres/migrations/002_create_events.up.sql
docker exec -i server-postgres-1 psql -U bananalytics -d bananalytics \\
  < internal/storage/postgres/migrations/003_add_key_hashes.up.sql
docker exec -i server-postgres-1 psql -U bananalytics -d bananalytics \\
  < internal/storage/postgres/migrations/004_add_geo.up.sql`}</CodeBlock>
            <CodeBlock title="3. Create a project">{`curl -X POST http://localhost:8080/v1/projects \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My App"}'

# Returns: { "write_key": "rk_...", "secret_key": "sk_..." }`}</CodeBlock>
          </DocSection>

          {/* AI Setup */}
          <DocSection
            icon={<Sparkles className="h-5 w-5" />}
            title="AI Setup"
            id="ai-setup"
          >
            <p>
              Copy the prompt below and paste it into Claude Code, Cursor, Copilot, or any AI coding agent. It will integrate Bananalytics into your React Native app in one run.
            </p>

            <AiPromptCard>{`Integrate Bananalytics analytics into this React Native app. Bananalytics is a self-hosted, privacy-first product analytics tool. Follow these steps exactly:

## 1. Install dependencies

npm install @bananalytics/react-native @react-native-async-storage/async-storage

## 2. Initialize the SDK

Create or update the analytics initialization. Add this to your app's entry point (App.tsx or _layout.tsx):

import { Bananalytics } from '@bananalytics/react-native';

Bananalytics.init({
  apiKey: 'YOUR_WRITE_KEY',          // Replace with your rk_... write key
  endpoint: 'YOUR_ENDPOINT',         // Replace with your server URL (e.g. https://analytics.yourapp.com)
  flushInterval: 30000,              // Send events every 30s
  flushAt: 20,                       // Or when 20 events are queued
  trackAppLifecycle: true,           // Auto-track app foreground/background
  debug: false,                      // Set true during development
});

## 3. Identify users

After the user logs in or you have a user ID, call identify:

Bananalytics.identify('USER_ID', {
  email: user.email,          // optional traits
  plan: user.plan,
  created_at: user.createdAt,
});

## 4. Track screen views

For every screen/page in the app, add screen tracking.
If using React Navigation, add this to the onStateChange handler:

Bananalytics.screen('ScreenName');

Or use the React hook:

import { useTrackScreen } from '@bananalytics/react-native';
// Inside your screen component:
useTrackScreen('HomeScreen');

## 5. Track events

Add event tracking for key user actions. Use snake_case event names.
Ask me what events I want to track, or use these recommended defaults:

- signup_started / signup_completed (auth flow)
- button_click (with { button: 'name' } property)
- search_performed (with { query, results_count })
- add_to_cart (with { product_id, price, quantity })
- purchase_completed (with { order_id, total, currency })
- error_occurred (with { error_code, screen, message })

Example:
Bananalytics.track('purchase_completed', {
  order_id: 'ord_123',
  total: 49.99,
  currency: 'USD',
});

## 6. Wrap with Provider (optional)

If you prefer React context, wrap your app:

import { BananalyticsProvider } from '@bananalytics/react-native';

<BananalyticsProvider config={{
  apiKey: 'YOUR_WRITE_KEY',
  endpoint: 'YOUR_ENDPOINT',
}}>
  <App />
</BananalyticsProvider>

Then use the hook in any component:
const analytics = useBananalytics();
analytics.track('event_name', { key: 'value' });

## Rules
- Use snake_case for all event names (e.g. purchase_completed not purchaseCompleted)
- Keep event properties flat (no nested objects)
- Call identify() as early as possible after login
- Call screen() on every screen mount
- Do NOT track sensitive data (passwords, credit card numbers, SSN)
- The SDK handles offline queuing, batching, and retries automatically

Before you start, ask me:
1. What are the main user actions in this app that I want to track?
2. What is my Bananalytics write key and endpoint URL?`}</AiPromptCard>

            <h4 className="text-base font-semibold mt-8 mb-3">How it works</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Copy</strong> the prompt above into Claude Code, Cursor, or any AI coding agent</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Replace</strong> YOUR_WRITE_KEY and YOUR_ENDPOINT with your actual values</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Answer</strong> the AI when it asks what events you want to track</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Done</strong> — the AI installs the SDK, adds tracking calls, and instruments your app</span>
              </li>
            </ul>
          </DocSection>

          {/* SDK Setup */}
          <DocSection
            icon={<Smartphone className="h-5 w-5" />}
            title="React Native SDK"
            id="sdk"
          >
            <p>Install the SDK in your React Native app.</p>
            <CodeBlock title="Install">{`npm install @bananalytics/react-native
npm install @react-native-async-storage/async-storage`}</CodeBlock>
            <CodeBlock title="Initialize" lang="typescript">{`import { Bananalytics } from '@bananalytics/react-native';

Bananalytics.init({
  apiKey: 'rk_your_write_key',
  endpoint: 'https://your-server.com',
  debug: true,
});`}</CodeBlock>
            <CodeBlock title="Track events" lang="typescript">{`// Track custom events
Bananalytics.track('button_clicked', { button: 'signup' });

// Track screen views
Bananalytics.screen('HomeScreen');

// Identify users
Bananalytics.identify('user-123', { plan: 'pro' });

// Flush events immediately
await Bananalytics.flush();`}</CodeBlock>

            <h4 className="text-base font-semibold mt-8 mb-3">React Provider</h4>
            <CodeBlock lang="tsx">{`import { BananalyticsProvider, useBananalytics, useTrackScreen } from '@bananalytics/react-native';

function App() {
  return (
    <BananalyticsProvider config={{ apiKey: 'rk_...', endpoint: '...' }}>
      <HomeScreen />
    </BananalyticsProvider>
  );
}

function HomeScreen() {
  useTrackScreen('HomeScreen');
  const bananalytics = useBananalytics();

  return (
    <Button onPress={() => bananalytics.track('tapped')} title="Tap" />
  );
}`}</CodeBlock>

            <h4 className="text-base font-semibold mt-8 mb-3">Configuration Options</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">Option</th>
                    <th className="px-4 py-2 text-left font-medium">Default</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ConfigRow option="apiKey" default="required" desc="Write-only API key" />
                  <ConfigRow option="endpoint" default="required" desc="Backend URL" />
                  <ConfigRow option="flushInterval" default="30000" desc="Auto-flush interval (ms)" />
                  <ConfigRow option="flushAt" default="20" desc="Events before auto-flush" />
                  <ConfigRow option="maxQueueSize" default="1000" desc="Max events in memory" />
                  <ConfigRow option="maxRetries" default="3" desc="Retry attempts" />
                  <ConfigRow option="debug" default="false" desc="Console logging" />
                  <ConfigRow option="trackAppLifecycle" default="true" desc="Auto-track foreground/background" />
                  <ConfigRow option="sessionTimeout" default="1800000" desc="Session timeout (ms)" />
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* Event Strategy */}
          <DocSection
            icon={<Target className="h-5 w-5" />}
            title="Event Strategy"
            id="event-strategy"
          >
            <p>
              A good event strategy is the difference between a dashboard full of noise and one that drives decisions. Here is how to instrument your app to get the most out of Bananalytics.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">Core Events You Should Track</h4>
            <p>These events power the dashboard features and give you a complete picture of user behavior.</p>

            <div className="mt-4 space-y-4">
              <EventCategory
                title="Onboarding & Activation"
                description="Measure how users get from install to value. Build funnels to find where they drop off."
                events={[
                  { name: "app_opened", props: "first_open: boolean", why: "Distinguish first launch from returning users" },
                  { name: "signup_started", props: "method: 'email' | 'google' | 'apple'", why: "See which auth methods convert best" },
                  { name: "signup_completed", props: "method, time_to_complete_ms", why: "Measure signup friction. Funnel: started \u2192 completed" },
                  { name: "onboarding_step_viewed", props: "step: number, step_name: string", why: "Find which onboarding step loses users" },
                  { name: "onboarding_completed", props: "steps_completed: number", why: "Track activation rate" },
                ]}
              />

              <EventCategory
                title="Core Product Usage"
                description="Track the actions that define your product's value. These power retention cohorts."
                events={[
                  { name: "feature_used", props: "feature: string", why: "See which features drive retention" },
                  { name: "content_viewed", props: "content_id, content_type, source", why: "Understand what users engage with" },
                  { name: "search_performed", props: "query, results_count", why: "Discover unmet needs (zero-result searches)" },
                  { name: "item_created", props: "item_type, item_id", why: "Measure creation activity as engagement signal" },
                  { name: "share_tapped", props: "content_type, share_method", why: "Track organic virality loops" },
                ]}
              />

              <EventCategory
                title="Revenue & Conversion"
                description="Track the money path. Build funnels from browse to purchase to optimize conversion."
                events={[
                  { name: "product_viewed", props: "product_id, price, category", why: "Top of the purchase funnel" },
                  { name: "add_to_cart", props: "product_id, quantity, price", why: "Mid-funnel intent signal" },
                  { name: "checkout_started", props: "cart_value, item_count", why: "High-intent moment — track abandonment" },
                  { name: "purchase_completed", props: "order_id, total, currency, items", why: "Revenue tracking. Compare to checkout_started for drop-off" },
                  { name: "subscription_started", props: "plan, price, trial: boolean", why: "SaaS conversion tracking" },
                  { name: "subscription_cancelled", props: "plan, reason, days_active", why: "Understand churn reasons" },
                ]}
              />

              <EventCategory
                title="Engagement & Retention Signals"
                description="These events feed your retention heatmap and help predict churn."
                events={[
                  { name: "session_started", props: "(auto-tracked)", why: "Session count per user = engagement health" },
                  { name: "notification_received", props: "type, campaign_id", why: "Measure push notification effectiveness" },
                  { name: "notification_tapped", props: "type, campaign_id", why: "Tap rate = notification quality signal" },
                  { name: "rating_prompted", props: "days_since_install", why: "Optimize when to ask for reviews" },
                  { name: "rating_submitted", props: "stars, days_since_install", why: "Track app store rating health" },
                ]}
              />

              <EventCategory
                title="Errors & Friction"
                description="Track where users hit walls. These often reveal the biggest conversion opportunities."
                events={[
                  { name: "error_occurred", props: "error_code, screen, message", why: "Surface bugs that affect real users" },
                  { name: "payment_failed", props: "error_type, retry_count", why: "Lost revenue you can recover" },
                  { name: "form_abandoned", props: "form_name, last_field_filled", why: "Find the field that kills your form" },
                  { name: "permission_denied", props: "permission_type", why: "Users refusing permissions = feature blockers" },
                ]}
              />
            </div>

            <h4 className="text-base font-semibold mt-10 mb-3">Using Events with Dashboard Features</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">Dashboard Feature</th>
                    <th className="px-4 py-2 text-left font-medium">Events to Track</th>
                    <th className="px-4 py-2 text-left font-medium">Insight You Get</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2 font-medium">Funnels</td>
                    <td className="px-4 py-2 text-muted-foreground">signup_started &rarr; signup_completed &rarr; first_purchase</td>
                    <td className="px-4 py-2 text-muted-foreground">Where users drop off in your conversion flow</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Retention</td>
                    <td className="px-4 py-2 text-muted-foreground">Any recurring action (session_started, feature_used)</td>
                    <td className="px-4 py-2 text-muted-foreground">How many users come back on day 1, 7, 30</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Live View</td>
                    <td className="px-4 py-2 text-muted-foreground">All events in real-time</td>
                    <td className="px-4 py-2 text-muted-foreground">Verify tracking works, monitor launches &amp; campaigns</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Geography</td>
                    <td className="px-4 py-2 text-muted-foreground">All events (geo is extracted from IP)</td>
                    <td className="px-4 py-2 text-muted-foreground">Where your users are, localization priorities</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Sessions</td>
                    <td className="px-4 py-2 text-muted-foreground">session_started + any user-identified events</td>
                    <td className="px-4 py-2 text-muted-foreground">Debug individual user journeys</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-base font-semibold mt-10 mb-3">Best Practices</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Use past tense for event names</strong> — <code className="text-primary font-mono text-xs">purchase_completed</code> not <code className="text-muted-foreground font-mono text-xs">purchase</code>. It is clear that the action happened.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Use snake_case consistently</strong> — Bananalytics groups events by name. Mixed casing creates duplicates.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Keep properties flat</strong> — <code className="text-primary font-mono text-xs">{`{ price: 49.99, currency: "USD" }`}</code> not <code className="text-muted-foreground font-mono text-xs">{`{ payment: { price: 49.99 } }`}</code>. Easier to query.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Call <code className="text-primary font-mono text-xs">identify()</code> early</strong> — As soon as the user logs in. This links anonymous events to a real user for session tracking.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Track screens with <code className="text-primary font-mono text-xs">screen()</code></strong> — It auto-creates <code className="text-primary font-mono text-xs">screen_view</code> events, which powers the top events dashboard and retention.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Start with 10-15 events max</strong> — You can always add more. Too many events early on create noise and make dashboards hard to read.</span>
              </li>
            </ul>

            <CodeBlock title="Complete example: e-commerce app" lang="typescript">{`// After user logs in
Bananalytics.identify('user-123', { plan: 'free' });

// Screen views (auto-tracked with useTrackScreen hook)
Bananalytics.screen('HomeScreen');
Bananalytics.screen('ProductScreen');

// Core conversion funnel
Bananalytics.track('product_viewed', {
  product_id: 'prod_abc', price: 49.99, category: 'shoes'
});
Bananalytics.track('add_to_cart', {
  product_id: 'prod_abc', quantity: 1, price: 49.99
});
Bananalytics.track('checkout_started', {
  cart_value: 49.99, item_count: 1
});
Bananalytics.track('purchase_completed', {
  order_id: 'ord_xyz', total: 49.99, currency: 'USD'
});

// Engagement signals
Bananalytics.track('search_performed', {
  query: 'running shoes', results_count: 24
});
Bananalytics.track('share_tapped', {
  content_type: 'product', share_method: 'instagram'
});

// Error tracking
Bananalytics.track('payment_failed', {
  error_type: 'card_declined', retry_count: 0
});`}</CodeBlock>
          </DocSection>

          {/* API Reference */}
          <DocSection
            icon={<Server className="h-5 w-5" />}
            title="API Reference"
            id="api"
          >
            <p>Include your API key in every request:</p>
            <CodeBlock lang="bash">{`curl -H "Authorization: Bearer sk_your_secret_key" http://localhost:8080/v1/query/events`}</CodeBlock>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span><code className="text-primary font-mono">rk_*</code> — Write Key (ingestion)</span>
              <span><code className="text-primary font-mono">sk_*</code> — Secret Key (queries)</span>
            </div>

            <EndpointDoc method="POST" path="/v1/ingest" auth="Write Key" description="Send a batch of analytics events (max 500 per batch, 5MB body limit)."
              params={[{ name: "batch", type: "Event[]", required: true, desc: "Array of event objects" }]}
              bodyExample={`{
  "batch": [{
    "event": "button_clicked",
    "type": "track",
    "messageId": "unique-id-123",
    "anonymousId": "anon-456",
    "userId": "user-789",
    "properties": { "button": "signup" },
    "context": { "session": { "id": "sess-1" } },
    "timestamp": "2026-04-14T12:00:00Z"
  }]
}`}
              responseExample={`{ "success": true, "accepted": 1, "rejected": 0 }`}
              errorCodes={[
                { code: 400, desc: "Invalid JSON or validation failed" },
                { code: 401, desc: "Missing or invalid write key" },
                { code: 413, desc: "Request body exceeds 5MB" },
                { code: 429, desc: "Rate limit exceeded" },
              ]}
            />

            <EndpointDoc method="GET" path="/v1/query/events" auth="Secret Key" description="List events with optional filters and pagination."
              params={[
                { name: "event", type: "string", required: false, desc: "Filter by event name" },
                { name: "user_id", type: "string", required: false, desc: "Filter by user or anonymous ID" },
                { name: "from", type: "ISO 8601", required: false, desc: "Start of time range" },
                { name: "to", type: "ISO 8601", required: false, desc: "End of time range" },
                { name: "limit", type: "number", required: false, desc: "Max results (default 100)" },
                { name: "offset", type: "number", required: false, desc: "Pagination offset" },
              ]}
              responseExample={`{
  "events": [{
    "id": "uuid", "event": "button_clicked", "type": "track",
    "properties": { "button": "signup" },
    "user_id": "user-789", "anonymous_id": "anon-456",
    "timestamp": "2026-04-14T12:00:00Z", "session_id": "sess-1"
  }]
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/stats" auth="Secret Key" description="Overview metrics for KPI cards."
              params={[
                { name: "from", type: "ISO 8601", required: false, desc: "Start (default: today 00:00)" },
                { name: "to", type: "ISO 8601", required: false, desc: "End (default: now)" },
              ]}
              responseExample={`{
  "total_events": 4250, "unique_users": 342,
  "active_sessions": 18, "events_per_minute": 12.5,
  "top_country": "Germany"
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/events/timeseries" auth="Secret Key" description="Event counts bucketed by time interval."
              params={[
                { name: "from", type: "ISO 8601", required: false, desc: "Start of range" },
                { name: "to", type: "ISO 8601", required: false, desc: "End of range" },
                { name: "interval", type: "string", required: false, desc: "minute | hour (default) | day" },
                { name: "event", type: "string", required: false, desc: "Filter by event name" },
              ]}
              responseExample={`{
  "timeseries": [
    { "bucket": "2026-04-14T10:00:00Z", "count": 142 },
    { "bucket": "2026-04-14T11:00:00Z", "count": 198 }
  ]
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/events/top" auth="Secret Key" description="Top events ranked by count."
              params={[
                { name: "from", type: "ISO 8601", required: false, desc: "Start of range" },
                { name: "to", type: "ISO 8601", required: false, desc: "End of range" },
                { name: "limit", type: "number", required: false, desc: "Number of results (default 10)" },
              ]}
              responseExample={`{ "events": [{ "event": "button_clicked", "count": 1523 }] }`}
            />

            <EndpointDoc method="GET" path="/v1/query/funnel" auth="Secret Key" description="Funnel conversion analysis."
              params={[
                { name: "steps", type: "string", required: true, desc: "Comma-separated event names" },
                { name: "from", type: "ISO 8601", required: false, desc: "Start of range" },
                { name: "to", type: "ISO 8601", required: false, desc: "End of range" },
              ]}
              responseExample={`{
  "funnel": [
    { "step": "signup_start", "count": 500 },
    { "step": "signup_complete", "count": 180 }
  ]
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/retention" auth="Secret Key" description="Cohort-based retention data."
              params={[
                { name: "from", type: "ISO 8601", required: false, desc: "Start of cohort range" },
                { name: "to", type: "ISO 8601", required: false, desc: "End of cohort range" },
              ]}
              responseExample={`{
  "retention": [
    { "cohort": "2026-04-07", "cohort_size": 100, "period": 0, "retained": 100 },
    { "cohort": "2026-04-07", "cohort_size": 100, "period": 1, "retained": 62 }
  ]
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/sessions" auth="Secret Key" description="List sessions for a user."
              params={[{ name: "user_id", type: "string", required: true, desc: "User ID or anonymous ID" }]}
              responseExample={`{
  "sessions": [{
    "session_id": "sess-abc", "user_id": "user-789",
    "started_at": "2026-04-14T10:00:00Z",
    "ended_at": "2026-04-14T10:25:00Z", "event_count": 12
  }]
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/geo" auth="Secret Key" description="Geographic breakdown of events."
              params={[
                { name: "from", type: "ISO 8601", required: false, desc: "Start of range" },
                { name: "to", type: "ISO 8601", required: false, desc: "End of range" },
                { name: "group_by", type: "string", required: false, desc: "country (default) or city" },
              ]}
              responseExample={`{
  "geo": [{
    "country": "Germany", "country_code": "DE",
    "count": 523, "unique_users": 89, "lat": 52.52, "lng": 13.40
  }]
}`}
            />

            <EndpointDoc method="GET" path="/v1/query/live" auth="Secret Key" description="Real-time activity snapshot."
              responseExample={`{ "active_users": 42, "events_last_minute": 128, "recent_events": [...] }`}
            />

            <EndpointDoc method="POST" path="/v1/projects" auth="None" description="Create a new project. Returns API keys."
              bodyExample={`{ "name": "My App" }`}
              responseExample={`{ "id": "uuid", "name": "My App", "write_key": "rk_...", "secret_key": "sk_..." }`}
            />

            {/* Error codes */}
            <h4 className="text-base font-semibold mt-10 mb-3">Error Codes</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium w-16">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Code</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ConfigRow option="400" default="BAD_REQUEST" desc="Invalid request body or parameters" />
                  <ConfigRow option="400" default="VALIDATION_FAILED" desc="Event validation failed" />
                  <ConfigRow option="401" default="UNAUTHORIZED" desc="Missing or invalid API key" />
                  <ConfigRow option="413" default="PAYLOAD_TOO_LARGE" desc="Request body exceeds 5MB" />
                  <ConfigRow option="429" default="RATE_LIMITED" desc="Too many requests" />
                  <ConfigRow option="500" default="INTERNAL_ERROR" desc="Server error" />
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* Self-Hosting */}
          <DocSection
            icon={<Globe className="h-5 w-5" />}
            title="Self-Hosting"
            id="hosting"
          >
            <p>Deploy on any VPS with Docker. Recommended: Hetzner CX22 (~$4/month).</p>
            <CodeBlock title="Production deployment">{`# SSH into your server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone and start
git clone https://github.com/bananalytics-analytics/bananalytics.git
cd bananalytics/server

# Set your domain (Caddy auto-provisions SSL)
echo "ROCHADE_DOMAIN=analytics.yourdomain.com" > .env
echo "ROCHADE_CORS_ORIGINS=https://yourdomain.com" >> .env

# Start everything (Postgres + Go server + Caddy HTTPS)
docker-compose up -d`}</CodeBlock>
            <p className="mt-4">
              Point your domain&apos;s DNS A-record to your server IP. Caddy
              handles SSL automatically via Let&apos;s Encrypt.
            </p>
          </DocSection>

          {/* Environment Variables */}
          <DocSection
            icon={<Key className="h-5 w-5" />}
            title="Configuration"
            id="config"
          >
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">Variable</th>
                    <th className="px-4 py-2 text-left font-medium">Default</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ConfigRow option="ROCHADE_PORT" default="8080" desc="HTTP server port" />
                  <ConfigRow option="ROCHADE_DB_DSN" default="required" desc="PostgreSQL connection string" />
                  <ConfigRow option="ROCHADE_LOG_LEVEL" default="info" desc="debug, info, warn, error" />
                  <ConfigRow option="ROCHADE_RATE_LIMIT_RPM" default="1000" desc="Requests/min per API key" />
                  <ConfigRow option="ROCHADE_IP_RATE_LIMIT_RPM" default="300" desc="Requests/min per IP" />
                  <ConfigRow option="ROCHADE_CORS_ORIGINS" default="*" desc="Allowed origins" />
                  <ConfigRow option="ROCHADE_DB_MAX_CONNS" default="25" desc="Max DB connections" />
                  <ConfigRow option="ROCHADE_GEOIP_DB" default="" desc="Path to GeoLite2-City.mmdb" />
                  <ConfigRow option="ROCHADE_DOMAIN" default="localhost" desc="Domain for Caddy HTTPS" />
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* Privacy */}
          <DocSection
            icon={<Shield className="h-5 w-5" />}
            title="Privacy & Compliance"
            id="privacy"
          >
            <p>
              Bananalytics is designed with privacy in mind. All data stays on your
              infrastructure — no third-party services, no data sharing.
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Self-hosted:</strong> Data never leaves your server</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Opt-out support:</strong> Built-in consent management in the SDK</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>PII sanitization:</strong> Auto-strips email, phone, SSN from auto-captured events</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>No cookies:</strong> Uses device storage, not browser cookies</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>GDPR-friendly:</strong> You control the data, you handle deletion requests</span>
              </li>
            </ul>
          </DocSection>
        </div>
      </main>
      </div>
    </div>
  );
}

function AiPromptCard({ children }: { children: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const code = children.trim();
  const previewLines = code.split("\n").slice(0, 3).join("\n") + "\n...";

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 rounded-lg border border-primary/20 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 bg-primary/[0.04] px-4 py-3 text-left transition-colors hover:bg-primary/[0.07] cursor-pointer"
      >
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-primary">AI Integration Prompt</span>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {open ? "Click to collapse" : "Click to expand \u2014 copy and paste into Claude Code, Cursor, or any AI agent"}
          </p>
        </div>
        <svg
          className={cn("h-4 w-4 text-primary/50 transition-transform shrink-0", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsed preview */}
      {!open && (
        <div className="bg-[#0A0B0F] px-4 py-3 border-t border-primary/10">
          <pre className="font-mono text-xs text-muted-foreground/50 leading-relaxed">{previewLines}</pre>
        </div>
      )}

      {/* Expanded content */}
      {open && (
        <div className="relative border-t border-primary/10">
          <pre className="bg-[#0A0B0F] p-4 overflow-x-auto max-h-[500px] overflow-y-auto">
            <code className="font-mono text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{code}</code>
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
          >
            {copied ? (
              <><Check className="h-3 w-3" /> Copied</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy prompt</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function DocSection({
  icon,
  title,
  id,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div className="prose-sm space-y-4 text-foreground [&_p]:text-muted-foreground [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function ConfigRow({
  option,
  default: def,
  desc,
}: {
  option: string;
  default: string;
  desc: string;
}) {
  return (
    <tr>
      <td className="px-4 py-2 font-mono text-xs text-primary">{option}</td>
      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{def}</td>
      <td className="px-4 py-2 text-muted-foreground">{desc}</td>
    </tr>
  );
}

interface EventCategoryEvent {
  name: string;
  props: string;
  why: string;
}

function EventCategory({
  title,
  description,
  events,
}: {
  title: string;
  description: string;
  events: EventCategoryEvent[];
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 bg-card/50">
        <h5 className="text-sm font-semibold">{title}</h5>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="divide-y divide-border">
        {events.map((e) => (
          <div key={e.name} className="px-4 py-2.5 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
            <code className="text-xs font-mono text-primary shrink-0 sm:w-52">{e.name}</code>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{e.why}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-mono">{e.props}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

interface ErrorCode {
  code: number;
  desc: string;
}

function EndpointDoc({
  method,
  path,
  auth,
  description,
  params,
  bodyExample,
  responseExample,
  errorCodes,
}: {
  method: string;
  path: string;
  auth: string;
  description: string;
  params?: EndpointParam[];
  bodyExample?: string;
  responseExample?: string;
  errorCodes?: ErrorCode[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-border overflow-hidden">
      {/* Clickable header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-card/60"
      >
        <span className={cn(
          "rounded px-2 py-0.5 font-mono text-xs font-bold shrink-0",
          method === "POST" ? "bg-[#27C93F]/10 text-[#27C93F]" : "bg-[#6B9BD2]/10 text-[#6B9BD2]",
        )}>
          {method}
        </span>
        <code className="font-mono text-sm font-medium flex-1">{path}</code>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">{auth}</span>
        <svg
          className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          {params && params.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                {method === "POST" ? "Body" : "Query Parameters"}
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[#1B1B1B]">
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Param</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {params.map((p) => (
                      <tr key={p.name}>
                        <td className="px-3 py-1.5">
                          <code className="font-mono text-xs text-primary">{p.name}</code>
                          {p.required && <span className="ml-1 text-[10px] text-destructive">*</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.type}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bodyExample && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Request Body</p>
              <CodeBlock lang="typescript">{bodyExample}</CodeBlock>
            </div>
          )}

          {responseExample && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Response</p>
              <CodeBlock lang="typescript">{responseExample}</CodeBlock>
            </div>
          )}

          {errorCodes && errorCodes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Errors</p>
              <div className="flex flex-wrap gap-2">
                {errorCodes.map((e) => (
                  <span key={e.code} className="rounded border border-border bg-[#1B1B1B] px-2.5 py-1 text-xs">
                    <span className="font-mono text-destructive">{e.code}</span>
                    <span className="text-muted-foreground ml-1.5">{e.desc}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
