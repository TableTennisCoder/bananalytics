import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LOGIN_URL, DEMO_URL } from "@/lib/dashboard-url";
import {
  BarChart3, Lock, GitBranch, Users, Server, Wallet, TrendingDown, Smartphone, Pointer,
  ArrowRight, Check, X, GitFork, ChevronRight, ChevronDown,
} from "lucide-react";

/**
 * The one finding this page should carry, once there is a real one.
 *
 * Until the founder's own numbers from Hairu are in, the card shows what a
 * finding looks like — and says so, in a label the visitor can see. `isExample`
 * drives that label and the section heading. Flip it to false only when every
 * number below came out of a real dashboard; nothing synthetic ships as a case
 * study, and these figures are synthetic (they come from seeded audit data).
 */
const FINDING = {
  isExample: true,
  app: "Example app",
  funnel: "Paywall → Checkout → Purchase",
  range: "Last 30 days · split by platform",
  steps: ["Saw paywall", "Started checkout", "Purchased"],
  segments: [
    { name: "iOS", counts: [600, 308, 149] },
    { name: "Android", counts: [300, 119, 30] },
  ],
  takeaway:
    "Android reaches the paywall as often as iOS and buys a third as often. The drop is between checkout and purchase — that is the screen to open first.",
};

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-x-clip">

      {/* Floating Navbar — sticky + frosted glass */}
      <div className="sticky top-4 z-50 mx-auto w-full max-w-[1120px] px-4">
        <nav className="flex h-14 items-center justify-between rounded-2xl border border-white/[0.08] bg-background/40 px-5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/30">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-xl">&#x1F34C;</span>
            <span className="text-[14px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-brand)' }}>Bananalytics</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <NL href="#features">Features</NL><NL href="#compare">Compare</NL><NL href="#pricing">Pricing</NL><NL href="#faq">FAQ</NL><NL href="/docs">Docs</NL><NL href="/about">About</NL>
          </div>
          <div className="flex items-center gap-3">
            <a href={LOGIN_URL} className="hidden text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:block">Log in</a>
            <Link href="/docs#quick-start"><Button size="sm" className="h-8 bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">Get Started</Button></Link>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-primary/[0.06] blur-[150px]" />

        {/* Blueprint grid */}
        <div className="pointer-events-none absolute inset-0 -z-[5] overflow-hidden hidden lg:block">
          <div className="absolute left-1/2 top-0 bottom-0 w-full max-w-[1152px] -translate-x-1/2">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/[0.06]" />
            <div className="absolute right-0 top-0 bottom-0 w-px bg-primary/[0.06]" />
          </div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/[0.02]" />
          <div className="absolute left-0 right-0 top-[22%] h-px bg-primary/[0.04]" />
          <div className="absolute left-0 right-0 top-[68%] h-px bg-primary/[0.03]" />
          {/* Corner brackets */}
          <div className="absolute left-[8%] top-[22%] h-6 w-6"><div className="absolute left-0 top-0 h-full w-px bg-primary/[0.12]" /><div className="absolute left-0 top-0 h-px w-full bg-primary/[0.12]" /></div>
          <div className="absolute right-[8%] top-[22%] h-6 w-6"><div className="absolute right-0 top-0 h-full w-px bg-primary/[0.12]" /><div className="absolute right-0 top-0 h-px w-full bg-primary/[0.12]" /></div>
          <div className="absolute left-[8%] top-[68%] h-6 w-6"><div className="absolute left-0 bottom-0 h-full w-px bg-primary/[0.12]" /><div className="absolute left-0 bottom-0 h-px w-full bg-primary/[0.12]" /></div>
          <div className="absolute right-[8%] top-[68%] h-6 w-6"><div className="absolute right-0 bottom-0 h-full w-px bg-primary/[0.12]" /><div className="absolute right-0 bottom-0 h-px w-full bg-primary/[0.12]" /></div>
          {/* Decorative diamonds */}
          <div className="absolute left-[25%] top-[22%] h-3 w-3 border border-primary/[0.1] rotate-45" />
          <div className="absolute right-[25%] top-[68%] h-2.5 w-2.5 border border-primary/[0.08] rotate-45" />
        </div>

        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 pb-16 pt-28 sm:pt-36 lg:pb-20 lg:pt-44">
          <div className="mx-auto max-w-[740px] text-center">
            <div className="mb-8 flex justify-center">
              <Link href="/docs" className="group inline-flex items-center gap-2 rounded-full border border-primary/[0.15] bg-primary/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-all hover:border-primary/[0.3] hover:bg-primary/[0.08]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />Product analytics for React Native<ChevronRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <h1 className="text-balance text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-[1.1] tracking-[-0.025em]">
              Find where your app{" "}<span className="text-primary">loses money</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-[16px] leading-[1.7] text-muted-foreground text-balance">
              Product analytics for React Native apps with a paywall. See where users drop off before they pay &mdash; which screen, which segment, and what it costs you.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={DEMO_URL}><Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 gap-2">See the live demo <ArrowRight className="h-4 w-4" /></Button></a>
              <Link href="/docs#quick-start"><Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] font-medium hover:bg-white/[0.06] shadow-md">Self-host in 5 minutes</Button></Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[12px] text-muted-foreground/50 font-medium">
              <span className="flex items-center gap-1.5"><GitFork className="h-3.5 w-3.5" />Free &amp; MIT</span>
              <span className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" />Runs on a &euro;4 server</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Your data stays on your server</span>
            </div>
          </div>
          <div className="mx-auto mt-20 max-w-[620px]">
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0B0F]/90 shadow-2xl shadow-primary/5">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary/30" /><div className="h-2.5 w-2.5 rounded-full bg-white/10" /><div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <span className="ml-3 text-[11px] text-white/20 font-mono">App.tsx</span>
              </div>
              <pre className="p-5 font-mono text-[13px] leading-[1.9] overflow-x-auto"><code>
                <span className="text-white/20">{"// Three lines. Revenue is a number, not a plugin."}</span>{"\n"}
                <span className="text-primary">import</span><span className="text-white/60">{" { Bananalytics } "}</span><span className="text-primary">from</span>{" "}<span className="text-[#22C55E]">{`'@bananalytics/react-native'`}</span>{";\n\n"}
                <span className="text-white/60">{"Bananalytics."}</span><span className="text-primary">init</span><span className="text-white/30">{"({ "}</span><span className="text-white/45">apiKey</span><span className="text-white/30">{": "}</span><span className="text-[#22C55E]">{`'rk_...'`}</span><span className="text-white/30">{", "}</span><span className="text-white/45">endpoint</span><span className="text-white/30">{": "}</span><span className="text-[#22C55E]">{`'https://analytics.yourapp.com'`}</span><span className="text-white/30">{" });"}</span>{"\n"}
                <span className="text-white/60">{"Bananalytics."}</span><span className="text-primary">trackRevenue</span><span className="text-white/30">{"("}</span><span className="text-white/60">9.99</span><span className="text-white/30">{", "}</span><span className="text-[#22C55E]">{`'EUR'`}</span><span className="text-white/30">{", { "}</span><span className="text-white/45">product</span><span className="text-white/30">{": "}</span><span className="text-[#22C55E]">{`'pro_monthly'`}</span><span className="text-white/30">{" });"}</span>
              </code></pre>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Problem / Solution */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-24">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive/70">The problem</p>
              <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">You know users leave. You don&apos;t know where, or what it costs you.</h2>
              <ul className="mt-8 space-y-4">
                <PI t="Your analytics tool has forty features. You use three, and you rebuild the same paywall funnel every time." />
                <PI t="A release ships. Conversion drops. You find out two weeks later, from the revenue chart." />
                <PI t="You suspect Android converts worse than iOS. Proving it means an afternoon in a query builder." />
                <PI t="The bill grows with your users. Success gets more expensive." />
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">The solution</p>
              <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">See the leak. Fix it. Watch the number move.</h2>
              <ul className="mt-8 space-y-4">
                <SI t="Funnels built around the paywall: drop-off per step, median time between steps, split by platform, version or country in one click." />
                <SI t="Revenue is a first-class number — ARPU, paying share, and what each week's cohort is worth at day 30." />
                <SI t="Every metric shows its change against the previous period. A release that hurts is a red arrow, not a hunch." />
                <SI t="Runs on a €4 server with one command. Unlimited events. Your data never leaves it." />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH l="Features" t="Six questions. Answered." s="The views a paid app needs — and not thirty others." />
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <GC i={<GitBranch className="h-5 w-5" />} t="Where do they bail?" d="Funnels with drop-off per step and the median time between them. Filter every step to a segment." />
            <GC i={<Wallet className="h-5 w-5" />} t="What is a user worth?" d="ARPU, paying share, average order — and each week's cohort tracked to day 30, 60 and 90." />
            <GC i={<TrendingDown className="h-5 w-5" />} t="Did the release hurt?" d="Every number against the previous period. Break anything down by app version." />
            <GC i={<Smartphone className="h-5 w-5" />} t="Who converts, who doesn't?" d="Split any view by platform, country, device, OS version or your own properties." />
            <GC i={<Users className="h-5 w-5" />} t="Are they coming back?" d="Retention cohorts, DAU/WAU/MAU, stickiness. People, not event volume." />
            <GC i={<Pointer className="h-5 w-5" />} t="Where do they tap?" d="Taps and time-on-screen as events. Rage taps and dead buttons, without recording a single screen." />
          </div>
        </div>
      </section>

      {/* Setup */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH l="Setup" t="Zero to your first funnel in 5 minutes" s="No account. No credit card. No sales call." />
          <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
            <SC n="1" t="Deploy" d="One command on any €4 server. Docker, Postgres, HTTPS, backups." c="curl -fsSL bananalytics.xyz/install.sh | sudo bash" />
            <SC n="2" t="Install" d="Add the SDK. Expo & bare RN." c="npm i @bananalytics/react-native" />
            <SC n="3" t="Ship" d="Track a purchase. Watch the funnel fill in." c="Bananalytics.trackRevenue(9.99, 'EUR')" />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH l="Comparison" t="How Bananalytics stacks up" s="The rows that matter when you are the whole team." />
          <div className="mt-16 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/[0.05]">
                <th className="px-5 py-4 text-left font-medium text-muted-foreground/50 w-[180px]" />
                <th className="px-5 py-4 text-center"><div className="flex flex-col items-center gap-1"><span className="text-base">&#x1F34C;</span><span className="font-semibold text-foreground">Bananalytics</span></div></th>
                <th className="px-5 py-4 text-center font-medium text-muted-foreground/50">Mixpanel</th>
                <th className="px-5 py-4 text-center font-medium text-muted-foreground/50">Amplitude</th>
                <th className="px-5 py-4 text-center font-medium text-muted-foreground/50">PostHog</th>
                <th className="px-5 py-4 text-center font-medium text-muted-foreground/50 hidden lg:table-cell">GA4</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                <CR f="Built for React Native" r={true} m={false} a={false} p={false} g={false} />
                <CR f="Built around the paywall funnel" r={true} m={false} a={false} p={false} g={false} />
                <CR f="Self-hosted with one command" r={true} m={false} a={false} p={false} g={false} />
                <CR f="Offline queue" r={true} m={false} a={true} p={false} g={false} />
                <CR f="Open source" r={true} m={false} a={false} p={true} g={false} />
                <CR f="Your server only" r={true} m={false} a={false} p="self" g={false} />
                <CR f="Unlimited events, fixed price" r={true} m={false} a={false} p={false} g={true} />
                <tr className="bg-white/[0.02]"><td className="px-5 py-3.5 font-semibold">Price at 10M events</td><td className="px-5 py-3.5 text-center font-bold text-primary">$4/mo</td><td className="px-5 py-3.5 text-center text-muted-foreground/50">~$2,520/mo</td><td className="px-5 py-3.5 text-center text-muted-foreground/50">Custom</td><td className="px-5 py-3.5 text-center text-muted-foreground/50">~$450</td><td className="px-5 py-3.5 text-center text-muted-foreground/50 hidden lg:table-cell">Free*</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground/30">* GA4 is free but monetizes your data. PostHog self-hosted requires significant DevOps.</p>
        </div>
      </section>

      {/* Scale & Performance */}
      <section id="scale" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH
            l="Performance"
            t="Grows with you. The bill doesn't."
            s="Backend, Postgres and the dashboard on one €4 box. Measured, not estimated."
          />

          {/* Hero stat cards */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat value="273 ms" label="dashboard load" sub="measured at 4.2M events" />
            <Stat value="32M" label="events on 40 GB" sub="before the disk fills up" />
            <Stat value="2,650/s" label="events ingested" sub="measured on 2 cores" />
          </div>

          {/* Scale table */}
          <div className="mx-auto mt-10 max-w-[760px]">
            <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">
              Pick a server by app stage
            </p>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground/50">App stage</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground/50">Hetzner box</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground/50">Cost / mo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  <tr className="bg-primary/[0.03]">
                    <td className="px-5 py-3 font-medium">MVP &mdash; first 1K users</td>
                    <td className="px-5 py-3 text-muted-foreground/70">CX22 &middot; 2 vCPU &middot; 4 GB &middot; 40 GB</td>
                    <td className="px-5 py-3 text-right font-bold text-primary">€4.75</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium">10K&ndash;50K MAU</td>
                    <td className="px-5 py-3 text-muted-foreground/70">CX32 &middot; 4 vCPU &middot; 8 GB &middot; 80 GB</td>
                    <td className="px-5 py-3 text-right text-muted-foreground/70">~€7</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium">50K&ndash;200K MAU</td>
                    <td className="px-5 py-3 text-muted-foreground/70">CX42 &middot; 8 vCPU &middot; 16 GB &middot; 160 GB</td>
                    <td className="px-5 py-3 text-right text-muted-foreground/70">~€15</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-medium">200K+ MAU</td>
                    <td className="px-5 py-3 text-muted-foreground/70">Dedicated DB box, private network</td>
                    <td className="px-5 py-3 text-right text-muted-foreground/70">~€30+</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-muted-foreground/50">
            Full capacity math + monitoring playbook in the{" "}
            <Link href="/docs#capacity" className="text-primary/80 underline-offset-4 hover:underline">
              capacity docs
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Quote */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH
            l={FINDING.isExample ? "What a finding looks like" : "From the founder's own app"}
            t="You don't need more charts. You need to know which screen is costing you subscribers."
          />
          <Finding />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH l="Pricing" t="No per-event fees. Ever." s="Self-host for free, or let us run it." />
          <div className="mx-auto mt-16 grid max-w-[840px] grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-colors hover:border-white/[0.1]">
              <div className="flex items-center gap-2 mb-1"><Server className="h-4 w-4 text-muted-foreground/50" /><h3 className="text-[15px] font-semibold">Self-Hosted</h3></div>
              <p className="text-[12px] text-muted-foreground/50 mb-5">Free at any scale. One command to install.</p>
              <p className="text-[36px] font-bold tracking-tight leading-none">$0</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1 mb-7">+ ~$4/mo for a VPS</p>
              <ul className="space-y-2.5 mb-7"><PF t="Unlimited events" /><PF t="All features" /><PF t="Full source (MIT)" /><PF t="Deploy in 5 min" /><PF t="Community support" /></ul>
              <Link href="/docs#quick-start"><Button variant="outline" className="w-full h-9 border-white/[0.08] bg-white/[0.03] text-[13px] hover:bg-white/[0.06]">Start Self-Hosting</Button></Link>
            </div>
            <div className="relative rounded-2xl border border-primary/30 bg-white/[0.02] p-7 shadow-[0_0_60px_-15px] shadow-primary/10">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2"><span className="rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-md shadow-primary/20">Coming Soon</span></div>
              <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="text-[15px] font-semibold">Bananalytics Cloud</h3></div>
              <p className="text-[12px] text-muted-foreground/50 mb-5">Zero maintenance. We handle everything.</p>
              <p className="text-[36px] font-bold tracking-tight leading-none">$29<span className="text-sm font-normal text-muted-foreground/50 ml-0.5">/mo</span></p>
              <p className="text-[12px] text-muted-foreground/50 mt-1 mb-7">up to 1M events</p>
              <ul className="space-y-2.5 mb-7"><PF t="Managed infra" /><PF t="Auto backups" /><PF t="Custom domain + SSL" /><PF t="99.9% SLA" /><PF t="Priority support" /></ul>
              <Link href="/waitlist"><Button className="w-full h-9 bg-primary text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/15">Join Waitlist</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-14 sm:py-20">
          <SH l="FAQ" t="Questions, answered" s="Everything you need to know before you ship." />
          <div className="mx-auto mt-12 max-w-[760px] space-y-3">
            <FAQ
              q="I'm already on PostHog or Mixpanel. Why switch?"
              a="Because you have forty features and use three, and you rebuild the same paywall funnel every time you open it. Here that funnel is the home screen, with revenue on it and the change since last period next to every number. Fewer views, each one built around a question a paid app actually asks. If you need session replay, feature flags or a SQL console, stay where you are — that is not what this is."
            />
            <FAQ
              q="What does it tell me that RevenueCat's dashboard can't?"
              a="RevenueCat knows what was paid. It does not know which screen lost the people who did not pay. Bananalytics sees the whole path — paywall viewed, checkout started, purchase completed — split by platform, app version and country, so the drop-off has a place and a segment, not just a total."
            />
            <FAQ
              q="Do I have to re-instrument my app?"
              a="No. The SDK uses the same track / identify / screen calls you already have, so switching call sites is mostly a find-and-replace. The practical path is to dual-track for a week — send to both tools — then cut the old one once the numbers agree. Historical import is not there yet."
            />
            <FAQ
              q="Will it slow down my app or bloat my bundle?"
              a="The SDK is 17 kB gzipped. Events are batched and sent in the background (every 30 seconds, or when 20 queue up), off your render path. Tap recording is off by default because it roughly doubles event volume; when you turn it on, a touch is recorded 150 ms later, never in the touch handler itself."
            />
            <FAQ
              q="How long does setup actually take?"
              a="One command on a fresh server installs Docker, asks for your domain, obtains a certificate, offers to schedule nightly backups and starts everything — about five minutes. The SDK is three lines: install, init() with your key, track. You will see your first event before the coffee is cold. Prefer to run it on your laptop first? docker compose up works too."
            />
            <FAQ
              q="Does it work with Expo, or only bare React Native?"
              a="Both. Expo managed, EAS, Dev Client and bare React Native. The SDK is pure TypeScript — the only native dependency is AsyncStorage for the offline queue, which is already in most apps. No config plugin, no pod install, and Expo Go keeps working."
            />
            <FAQ
              q="What happens to events if my server goes down?"
              a="They wait. The SDK keeps events on the device and retries with backoff once the server is back, in order, in batches the server accepts. A two-hour outage costs you nothing but a two-hour delay on the dashboard."
            />
            <FAQ
              q="Is it GDPR compliant?"
              a="Your data never leaves your server, so there is no processor to sign an agreement with — there is no us in the data path. No cookies, no third-party requests, opt-out built into the SDK, and tap recording captures coordinates, never screens. You still need your own privacy policy and consent flow; we cannot write those for you."
            />
            <FAQ
              q="Why not just self-host PostHog?"
              a="You can, and it is a good product. It is also a web-first platform with a mobile SDK on the side, and self-hosting it means running ClickHouse, Kafka and a dozen services. Bananalytics is React Native first — lifecycle, sessions, offline queue, taps — and it runs on one €4 box with one command. If you want the platform, take PostHog. If you want the paywall funnel by Tuesday, take this."
            />
            <FAQ
              q="When will Bananalytics Cloud launch?"
              a="Soon — we're targeting Q3 2026 for managed Cloud with custom domains, SSL, and 99.9% SLA. Self-hosted is fully production-ready today. If you want early access to Cloud, join the waitlist and you'll get a discount at launch."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] rounded-full bg-primary/[0.04] blur-[100px]" />
        <div className="mx-auto max-w-[600px] px-4 py-14 sm:py-20 text-center">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-balance sm:text-[36px]">Find your first leak this week.</h2>
          <p className="mx-auto mt-4 max-w-[400px] text-[15px] text-muted-foreground/60">Self-host in 5 minutes. No account, no card, no lock-in.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/docs#quick-start"><Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 gap-2">Self-host now <ArrowRight className="h-4 w-4" /></Button></Link>
            <a href={DEMO_URL}><Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] hover:bg-white/[0.06]">See the live demo</Button></a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-6 px-4 lg:px-12 py-8 sm:flex-row">
          <div className="flex items-center gap-2"><span className="text-sm">&#x1F34C;</span><span className="text-[12px] font-bold text-muted-foreground/60" style={{ fontFamily: 'var(--font-brand)' }}>Bananalytics</span></div>
          <div className="flex items-center gap-7 text-[12px] text-muted-foreground/40"><Link href="/docs" className="transition-colors hover:text-foreground">Docs</Link><Link href="/#faq" className="transition-colors hover:text-foreground">FAQ</Link><a href={LOGIN_URL} className="transition-colors hover:text-foreground">Dashboard</a><Link href="/about" className="transition-colors hover:text-foreground">About</Link><a href="https://github.com/TableTennisCoder/bananalytics" className="transition-colors hover:text-foreground">GitHub</a></div>
          <p className="text-[11px] text-muted-foreground/25">Built by an app founder, for app founders &middot; MIT License</p>
        </div>
      </footer>
    </div>
  );
}

function NL({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground">{children}</Link>; }
function SH({ l, t, s }: { l: string; t: string; s?: string }) { return <div className="mx-auto max-w-[540px] text-center"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">{l}</p><h2 className="text-[28px] font-semibold leading-tight tracking-tight text-balance sm:text-[36px]">{t}</h2>{s && <p className="mt-3 text-[15px] text-muted-foreground/60">{s}</p>}</div>; }
function GC({ i, t, d }: { i: React.ReactNode; t: string; d: string }) { return <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-200 hover:border-primary/20 hover:bg-primary/[0.03]"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/[0.1] text-primary transition-colors group-hover:bg-primary/[0.18]">{i}</div><h3 className="mb-1.5 text-[14px] font-semibold">{t}</h3><p className="text-[13px] leading-relaxed text-muted-foreground/50">{d}</p></div>; }
function SC({ n, t, d, c }: { n: string; t: string; d: string; c: string }) { return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-colors hover:border-white/[0.1]"><div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{n}</div><h3 className="mb-1.5 text-[14px] font-semibold">{t}</h3><p className="mb-4 text-[13px] text-muted-foreground/50">{d}</p><code className="inline-block rounded-md bg-[#0A0B0F] border border-white/[0.06] px-3.5 py-1.5 font-mono text-[12px] text-primary">{c}</code></div>; }
function PF({ t }: { t: string }) { return <li className="flex items-center gap-2 text-[13px]"><Check className="h-3.5 w-3.5 text-primary shrink-0" /><span className="text-muted-foreground/70">{t}</span></li>; }
function PI({ t }: { t: string }) { return <li className="flex items-start gap-3 text-[13px]"><X className="mt-0.5 h-4 w-4 text-destructive/50 shrink-0" /><span className="text-muted-foreground/60">{t}</span></li>; }
function SI({ t }: { t: string }) { return <li className="flex items-start gap-3 text-[13px]"><Check className="mt-0.5 h-4 w-4 text-primary/80 shrink-0" /><span className="text-muted-foreground/80">{t}</span></li>; }
function CR({ f, r, m, a, p, g }: { f: string; r: boolean; m: boolean; a: boolean; p: boolean | "self"; g: boolean }) { return <tr className="transition-colors hover:bg-white/[0.015]"><td className="px-5 py-3 font-medium">{f}</td><td className="px-5 py-3 text-center"><CI v={r} hl /></td><td className="px-5 py-3 text-center"><CI v={m} /></td><td className="px-5 py-3 text-center"><CI v={a} /></td><td className="px-5 py-3 text-center"><CI v={p} /></td><td className="px-5 py-3 text-center hidden lg:table-cell"><CI v={g} /></td></tr>; }
function CI({ v, hl }: { v: boolean | "self"; hl?: boolean }) { if (v === "self") return <span className="text-[10px] text-muted-foreground/30">self-host</span>; if (v) return <Check className={`h-3.5 w-3.5 mx-auto ${hl ? "text-primary" : "text-muted-foreground/30"}`} />; return <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/10" />; }

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 text-center transition-colors hover:border-primary/20 hover:bg-primary/[0.02]">
      <p className="text-[40px] font-bold tracking-tight leading-none text-primary sm:text-[44px]">{value}</p>
      <p className="mt-3 text-[14px] font-semibold">{label}</p>
      <p className="mt-1 text-[12px] text-muted-foreground/50">{sub}</p>
    </div>
  );
}

/**
 * A segmented funnel, the way the dashboard shows one — the product's core view
 * rendered in the page's own style so a visitor sees the answer, not a screenshot.
 *
 * Reads FINDING. While `isExample` is true the card carries a visible "Example
 * data" label; the numbers are illustrative and must not be read as a result.
 */
function Finding() {
  const first = Math.max(...FINDING.segments.map((s) => s.counts[0]));
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : 0);

  return (
    <div className="mx-auto mt-12 max-w-[760px]">
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-4">
          <div>
            <p className="text-[14px] font-semibold">{FINDING.funnel}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground/50">{FINDING.range}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
              FINDING.isExample
                ? "border border-white/[0.08] text-muted-foreground/60"
                : "bg-primary/10 text-primary"
            }`}
          >
            {FINDING.isExample ? "Example data" : `${FINDING.app} · live data`}
          </span>
        </div>

        <div className="divide-y divide-white/[0.03]">
          {FINDING.segments.map((seg) => (
            <div key={seg.name} className="px-5 py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">{seg.name}</span>
                <span className="text-[12px] text-muted-foreground/50">
                  {pct(seg.counts[seg.counts.length - 1], seg.counts[0])}% reach purchase
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {FINDING.steps.map((step, i) => (
                  <div key={step}>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-primary/60" : "bg-primary"}`}
                        style={{ width: `${(seg.counts[i] / first) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[12px] font-medium tabular-nums">{seg.counts[i].toLocaleString("en-US")}</p>
                    <p className="text-[11px] text-muted-foreground/50">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="border-t border-white/[0.05] px-5 py-4 text-[13px] leading-relaxed text-muted-foreground/80">
          {FINDING.takeaway}
        </p>
      </div>
      {FINDING.isExample && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground/30">
          Illustrative numbers. This is the view; a real finding from the founder&apos;s own app is coming.
        </p>
      )}
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors open:border-white/[0.1] hover:border-white/[0.1]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.04] px-5 py-4 text-[13px] leading-[1.7] text-muted-foreground/80">
        {a}
      </div>
    </details>
  );
}
