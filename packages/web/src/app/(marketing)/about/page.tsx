import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DEMO_URL } from "@/lib/dashboard-url";

export default function AboutPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 lg:px-12">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg">&#x1F34C;</span>
            <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-brand)" }}>Bananalytics</span>
          </Link>
        </div>
      </header>

      {/* Glow */}
      <div className="pointer-events-none absolute left-1/2 top-[15%] -z-10 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/[0.04] blur-[150px]" />

      <main className="flex-1">
        <div className="mx-auto max-w-[640px] px-4 py-24 sm:py-32">
          {/* Greeting */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl">
              &#x1F44B;
            </div>
            <div>
              <h1 className="text-xl font-semibold">Hey, I&apos;m Max</h1>
              <p className="text-sm text-muted-foreground">23, software engineer from Germany. I build Hairu — and Bananalytics because of it.</p>
            </div>
          </div>

          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">Why this exists</p>

          {/* Story */}
          <div className="space-y-6 text-[15px] leading-[1.8] text-muted-foreground">
            <p>
              I&apos;m building <span className="text-foreground font-medium">Hairu</span>, an AI hairstyle try-on app — React Native, iOS and Android. It grew to around fifty thousand new users a month, and somewhere in there analytics stopped being a nice-to-have. I needed to know where people were dropping off before the paywall, whether the onboarding was losing them, and whether the last release had quietly made things worse.
            </p>

            <p>
              So I used PostHog. It&apos;s an excellent product. It&apos;s also enormous — session replay, feature flags, experiments, surveys, a SQL console, dozens of things I never opened — and the bill grows with your events, which means it grows with your success. I was paying for a platform and using three views of it.
            </p>

            <p>
              And even those three fought back. I rebuilt the same paywall funnel every time I opened the tool. Properties I had registered silently never arrived, and nobody noticed for weeks. An event existed in my code and never once in the data. Half the questions I actually had couldn&apos;t be asked without an afternoon in the query builder — and I&apos;m the whole team, so the afternoon didn&apos;t exist.
            </p>

            <p>
              What I wanted was simple to say and apparently hard to buy: a tool that opens to the answer. Where do users leave before they pay? Which screen? On which platform, in which version? What is that costing me? And nothing else on the screen unless I ask for it.
            </p>

            <p>
              <span className="text-foreground font-medium">Bananalytics</span> is that tool. Funnels built around the paywall, with the revenue right next to the drop-off. Every number with its change since last period, so a release that hurts shows up as a red arrow the next day instead of a mystery the next quarter. Split anything by platform, version, country or device. It runs on a &euro;4 server with one command — and because it&apos;s my own server, I never had to think about where the data goes.
            </p>

            <p>
              It&apos;s what I use for Hairu every day, and what I learn there goes straight back into the product. It&apos;s also deliberately small. No session replay, no feature flags, no SQL console for end users. If you need the platform, PostHog is right there. If you need to find the leak by Tuesday, this is for you.
            </p>

            <p>
              The name? I was eating a banana while brainstorming names. &quot;Banana + Analytics&quot; sounded so stupid that it was perfect. Sometimes the best brand is the one that makes you smile.
            </p>

            <p>
              It&apos;s fully open source, MIT licensed. Use it, fork it, break it, fix it. If you find something wrong, open an issue — I read every single one.
            </p>

            <p className="text-foreground">
              — Max
            </p>
          </div>

          {/* CTA */}
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-3">
            <a href={DEMO_URL}>
              <Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 gap-2">
                See the live demo <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link href="/docs#quick-start">
              <Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] hover:bg-white/[0.06]">
                Self-host in 5 minutes
              </Button>
            </Link>
          </div>

          {/* Links */}
          <div className="mt-8 flex items-center gap-4">
            <a href="https://github.com/TableTennisCoder/bananalytics" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              GitHub
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 lg:px-12 py-6">
          <div className="flex items-center gap-2">
            <span className="text-sm">&#x1F34C;</span>
            <span className="text-[12px] font-bold text-muted-foreground/60" style={{ fontFamily: "var(--font-brand)" }}>Bananalytics</span>
          </div>
          <p className="text-[11px] text-muted-foreground/25">Built by an app founder, for app founders &middot; MIT License</p>
        </div>
      </footer>
    </div>
  );
}
