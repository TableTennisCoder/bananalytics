import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Globe, Lock, Zap, GitBranch, Users, Radio, Server,
  ArrowRight, Check, X, GitFork, Shield, ChevronRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground overflow-x-hidden">

      {/* Floating Navbar */}
      <div className="sticky top-4 z-50 mx-auto w-full max-w-[1120px] px-4">
        <nav className="flex h-14 items-center justify-between border border-white/[0.06] bg-background/60 px-5 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-xl">&#x1F34C;</span>
            <span className="text-[14px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-brand)' }}>Bananalytics</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <NL href="#features">Features</NL><NL href="#compare">Compare</NL><NL href="#pricing">Pricing</NL><NL href="/docs">Docs</NL><NL href="/about">About</NL>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:block">Log in</Link>
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

        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 pb-24 pt-28 sm:pt-36 lg:pb-32 lg:pt-44">
          <div className="mx-auto max-w-[740px] text-center">
            <div className="mb-8 flex justify-center">
              <Link href="/docs" className="group inline-flex items-center gap-2 border border-primary/[0.15] bg-primary/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-all hover:border-primary/[0.3] hover:bg-primary/[0.08]">
                <span className="h-1.5 w-1.5 bg-primary" />Built for React Native<ChevronRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <h1 className="text-balance text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-[1.1] tracking-[-0.025em]">
              The analytics your React Native app{" "}<span className="text-primary">deserves</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-[16px] leading-[1.7] text-muted-foreground text-balance">
              Self-hosted product analytics built for React Native. Same insights as Mixpanel — runs on your $4/month server. Your users&apos; data never leaves your infrastructure.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/docs#quick-start"><Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 gap-2">Deploy in 5 minutes <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/demo/dashboard"><Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] font-medium hover:bg-white/[0.06] shadow-md">Live Demo</Button></Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[12px] text-muted-foreground/50 font-medium">
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />GDPR compliant</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Your server, your data</span>
              <span className="flex items-center gap-1.5"><GitFork className="h-3.5 w-3.5" />MIT License</span>
            </div>
          </div>
          <div className="mx-auto mt-20 max-w-[620px]">
            <div className="overflow-hidden border border-white/[0.08] bg-[#0A0B0F]/90 shadow-2xl shadow-primary/5">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
                <div className="h-2.5 w-2.5 bg-primary/30" /><div className="h-2.5 w-2.5 bg-white/10" /><div className="h-2.5 w-2.5 bg-white/10" />
                <span className="ml-3 text-[11px] text-white/20 font-mono">App.tsx</span>
              </div>
              <pre className="p-5 font-mono text-[13px] leading-[1.9] overflow-x-auto"><code>
                <span className="text-white/20">{"// 3 lines. That's it."}</span>{"\n"}
                <span className="text-primary">import</span><span className="text-white/60">{" { Bananalytics } "}</span><span className="text-primary">from</span>{" "}<span className="text-[#22C55E]">{`'@bananalytics/react-native'`}</span>{";\n\n"}
                <span className="text-white/60">{"Bananalytics."}</span><span className="text-primary">init</span><span className="text-white/30">{"({ "}</span><span className="text-white/45">apiKey</span><span className="text-white/30">{": "}</span><span className="text-[#22C55E]">{`'rk_...'`}</span><span className="text-white/30">{", "}</span><span className="text-white/45">endpoint</span><span className="text-white/30">{": "}</span><span className="text-[#22C55E]">{`'https://analytics.yourapp.com'`}</span><span className="text-white/30">{" });"}</span>{"\n"}
                <span className="text-white/60">{"Bananalytics."}</span><span className="text-primary">track</span><span className="text-white/30">{"("}</span><span className="text-[#22C55E]">{`'purchase_complete'`}</span><span className="text-white/30">{", { "}</span><span className="text-white/45">amount</span><span className="text-white/30">{": 49.99 });"}</span>
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
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-24 sm:py-32">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-24">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive/70">The problem</p>
              <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">Analytics shouldn&apos;t cost your users&apos; trust</h2>
              <ul className="mt-8 space-y-4">
                <PI t="Mixpanel charges $0.28/1K events — that's $2,500+/mo at scale" />
                <PI t="Your app's behavioral data sits on someone else's servers" />
                <PI t="Most analytics SDKs add 200KB+ to your bundle" />
                <PI t="GDPR becomes a nightmare with third-party vendors" />
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">The solution</p>
              <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">Own your analytics stack completely</h2>
              <ul className="mt-8 space-y-4">
                <SI t="Purpose-built React Native SDK with auto-tracking" />
                <SI t="Deploy on a $4/month VPS — unlimited events, forever" />
                <SI t="Data never leaves your infrastructure" />
                <SI t="Lightweight, offline-first, batched, zero crashes" />
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
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-24 sm:py-32">
          <SH l="Features" t="Enterprise analytics, indie pricing" />
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <GC i={<Zap className="h-5 w-5" />} t="React Native SDK" d="Auto-captures lifecycle, screens, sessions. Expo & bare RN." />
            <GC i={<GitBranch className="h-5 w-5" />} t="Conversion Funnels" d="See where users drop off. Multi-step funnels in seconds." />
            <GC i={<Users className="h-5 w-5" />} t="Retention Cohorts" d="Day 1, 7, 30 retention. Color-coded heatmaps." />
            <GC i={<Globe className="h-5 w-5" />} t="Interactive Globe" d="3D globe with live user locations. Countries & cities." />
            <GC i={<Radio className="h-5 w-5" />} t="Live Dashboard" d="Real-time events, active users. Updates every 5 seconds." />
            <GC i={<Lock className="h-5 w-5" />} t="Offline-First" d="Queue offline. Auto-sync. Backoff with jitter. Zero crashes." />
          </div>
        </div>
      </section>

      {/* Setup */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-24 sm:py-32">
          <SH l="Setup" t="Zero to tracking in 5 minutes" s="No account. No credit card. No sales call." />
          <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
            <SC n="1" t="Deploy" d="Docker boots the server + Postgres." c="docker-compose up -d" />
            <SC n="2" t="Install" d="Add the SDK. Expo & bare RN." c="npm i @bananalytics/react-native" />
            <SC n="3" t="Ship" d="Track events. See them live." c="Bananalytics.track('signup')" />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-24 sm:py-32">
          <SH l="Comparison" t="How Bananalytics stacks up" s="Same features. Fraction of the cost." />
          <div className="mt-16 overflow-x-auto border border-white/[0.06] bg-white/[0.015]">
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
                <CR f="Self-hosted" r={true} m={false} a={false} p={true} g={false} />
                <CR f="Open source" r={true} m={false} a={false} p={true} g={false} />
                <CR f="Built for React Native" r={true} m={false} a={false} p={false} g={false} />
                <CR f="Event tracking" r={true} m={true} a={true} p={true} g={true} />
                <CR f="Funnels" r={true} m={true} a={true} p={true} g={true} />
                <CR f="Retention" r={true} m={true} a={true} p={true} g={false} />
                <CR f="Real-time" r={true} m={true} a={false} p={true} g={true} />
                <CR f="Offline queue" r={true} m={false} a={true} p={false} g={false} />
                <CR f="3D Globe" r={true} m={false} a={false} p={false} g={false} />
                <CR f="Cookieless" r={true} m={false} a={false} p={true} g={false} />
                <CR f="Your server only" r={true} m={false} a={false} p="self" g={false} />
                <CR f="Unlimited events" r={true} m={false} a={false} p={false} g={true} />
                <tr className="bg-white/[0.02]"><td className="px-5 py-3.5 font-semibold">Price at 10M events</td><td className="px-5 py-3.5 text-center font-bold text-primary">$4/mo</td><td className="px-5 py-3.5 text-center text-muted-foreground/50">~$2,520/mo</td><td className="px-5 py-3.5 text-center text-muted-foreground/50">Custom</td><td className="px-5 py-3.5 text-center text-muted-foreground/50">~$450</td><td className="px-5 py-3.5 text-center text-muted-foreground/50 hidden lg:table-cell">Free*</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground/30">* GA4 is free but monetizes your data. PostHog self-hosted requires significant DevOps.</p>
        </div>
      </section>

      {/* Quote */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[720px] px-4 py-24 sm:py-32 text-center">
          <blockquote className="text-[22px] font-medium leading-relaxed tracking-tight text-balance sm:text-[28px]">&ldquo;Your React Native app collects sensitive behavioral data. It should stay on <span className="text-primary">your</span> server.&rdquo;</blockquote>
          <p className="mt-6 text-[14px] text-muted-foreground/50">Your users trust you. Bananalytics keeps that trust.</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="mx-auto max-w-[1120px] px-4 lg:px-12 py-24 sm:py-32">
          <SH l="Pricing" t="No per-event fees. Ever." s="Self-host for free, or let us run it." />
          <div className="mx-auto mt-16 grid max-w-[840px] grid-cols-1 gap-5 md:grid-cols-2">
            <div className="border border-white/[0.06] bg-white/[0.02] p-7 transition-colors hover:border-white/[0.1]">
              <div className="flex items-center gap-2 mb-1"><Server className="h-4 w-4 text-muted-foreground/50" /><h3 className="text-[15px] font-semibold">Self-Hosted</h3></div>
              <p className="text-[12px] text-muted-foreground/50 mb-5">Your server. Your data. Your rules.</p>
              <p className="text-[36px] font-bold tracking-tight leading-none">$0</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1 mb-7">+ ~$4/mo for a VPS</p>
              <ul className="space-y-2.5 mb-7"><PF t="Unlimited events" /><PF t="All features" /><PF t="Full source (MIT)" /><PF t="Deploy in 5 min" /><PF t="Community support" /></ul>
              <Link href="/docs#quick-start"><Button variant="outline" className="w-full h-9 border-white/[0.08] bg-white/[0.03] text-[13px] hover:bg-white/[0.06]">Start Self-Hosting</Button></Link>
            </div>
            <div className="relative border border-primary/30 bg-white/[0.02] p-7 shadow-[0_0_60px_-15px] shadow-primary/10">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2"><span className="bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-md shadow-primary/20">Coming Soon</span></div>
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

      {/* Final CTA */}
      <section className="relative border-t border-white/[0.04]">
        <div className="pointer-events-none absolute inset-y-0 left-4 right-4 mx-auto max-w-[1120px] hidden lg:block">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.04]" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.04]" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] rounded-full bg-primary/[0.04] blur-[100px]" />
        <div className="mx-auto max-w-[600px] px-4 py-24 sm:py-32 text-center">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-balance sm:text-[36px]">Ready to own your analytics?</h2>
          <p className="mx-auto mt-4 max-w-[400px] text-[15px] text-muted-foreground/60">Deploy in 5 minutes. No account, no credit card, no lock-in.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/docs#quick-start"><Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 gap-2">Deploy Now <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link href="/docs"><Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] hover:bg-white/[0.06]">Read the Docs</Button></Link>
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
          <div className="flex items-center gap-7 text-[12px] text-muted-foreground/40"><Link href="/docs" className="transition-colors hover:text-foreground">Docs</Link><Link href="/login" className="transition-colors hover:text-foreground">Dashboard</Link><Link href="/about" className="transition-colors hover:text-foreground">About</Link><a href="https://github.com" className="transition-colors hover:text-foreground">GitHub</a></div>
          <p className="text-[11px] text-muted-foreground/25">MIT License</p>
        </div>
      </footer>
    </div>
  );
}

function NL({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground">{children}</Link>; }
function SH({ l, t, s }: { l: string; t: string; s?: string }) { return <div className="mx-auto max-w-[540px] text-center"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">{l}</p><h2 className="text-[28px] font-semibold leading-tight tracking-tight text-balance sm:text-[36px]">{t}</h2>{s && <p className="mt-3 text-[15px] text-muted-foreground/60">{s}</p>}</div>; }
function GC({ i, t, d }: { i: React.ReactNode; t: string; d: string }) { return <div className="group border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-200 hover:border-primary/20 hover:bg-primary/[0.03]"><div className="mb-4 flex h-9 w-9 items-center justify-center bg-primary/[0.1] text-primary transition-colors group-hover:bg-primary/[0.18]">{i}</div><h3 className="mb-1.5 text-[14px] font-semibold">{t}</h3><p className="text-[13px] leading-relaxed text-muted-foreground/50">{d}</p></div>; }
function SC({ n, t, d, c }: { n: string; t: string; d: string; c: string }) { return <div className="border border-white/[0.06] bg-white/[0.02] p-6 text-center transition-colors hover:border-white/[0.1]"><div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center bg-primary text-[13px] font-bold text-primary-foreground">{n}</div><h3 className="mb-1.5 text-[14px] font-semibold">{t}</h3><p className="mb-4 text-[13px] text-muted-foreground/50">{d}</p><code className="inline-block bg-[#0A0B0F] border border-white/[0.06] px-3.5 py-1.5 font-mono text-[12px] text-primary">{c}</code></div>; }
function PF({ t }: { t: string }) { return <li className="flex items-center gap-2 text-[13px]"><Check className="h-3.5 w-3.5 text-primary shrink-0" /><span className="text-muted-foreground/70">{t}</span></li>; }
function PI({ t }: { t: string }) { return <li className="flex items-start gap-3 text-[13px]"><X className="mt-0.5 h-4 w-4 text-destructive/50 shrink-0" /><span className="text-muted-foreground/60">{t}</span></li>; }
function SI({ t }: { t: string }) { return <li className="flex items-start gap-3 text-[13px]"><Check className="mt-0.5 h-4 w-4 text-primary/80 shrink-0" /><span className="text-muted-foreground/80">{t}</span></li>; }
function CR({ f, r, m, a, p, g }: { f: string; r: boolean; m: boolean; a: boolean; p: boolean | "self"; g: boolean }) { return <tr className="transition-colors hover:bg-white/[0.015]"><td className="px-5 py-3 font-medium">{f}</td><td className="px-5 py-3 text-center"><CI v={r} hl /></td><td className="px-5 py-3 text-center"><CI v={m} /></td><td className="px-5 py-3 text-center"><CI v={a} /></td><td className="px-5 py-3 text-center"><CI v={p} /></td><td className="px-5 py-3 text-center hidden lg:table-cell"><CI v={g} /></td></tr>; }
function CI({ v, hl }: { v: boolean | "self"; hl?: boolean }) { if (v === "self") return <span className="text-[10px] text-muted-foreground/30">self-host</span>; if (v) return <Check className={`h-3.5 w-3.5 mx-auto ${hl ? "text-primary" : "text-muted-foreground/30"}`} />; return <X className="h-3.5 w-3.5 mx-auto text-muted-foreground/10" />; }
