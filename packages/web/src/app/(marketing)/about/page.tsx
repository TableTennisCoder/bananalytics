import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
              <p className="text-sm text-muted-foreground">23, software engineer from Germany</p>
            </div>
          </div>

          {/* Story */}
          <div className="space-y-6 text-[15px] leading-[1.8] text-muted-foreground">
            <p>
              So here&apos;s the thing. I was building a React Native app and needed analytics. You know the drill — you look at Mixpanel, Amplitude, all the big names. They&apos;re great tools. But then you see the pricing page. Mixpanel charges $0.28 per 1,000 events — sounds cheap until your app does 10 million events a month and you&apos;re looking at a $2,500 bill. For tracking button clicks. Come on.
            </p>

            <p>
              Then there&apos;s the privacy part. My app collects behavioral data from real users. Their screen views, their purchases, their search queries. And all of that sits on someone else&apos;s servers in some US data center? As a German dev, that gives me GDPR nightmares. I don&apos;t want to deal with DPAs and legal gray zones just to see how many people tapped &quot;Add to Cart&quot;.
            </p>

            <p>
              So I did what any developer would do — I built my own. <span className="text-foreground font-medium">Bananalytics</span> is what came out of that frustration. A self-hosted analytics tool that runs on a $4/month VPS, gives you funnels, retention, live events, a world map, the whole deal. And your data never leaves your server.
            </p>

            <p>
              The name? I was eating a banana while brainstorming names. &quot;Banana + Analytics&quot; sounded so stupid that it was perfect. Sometimes the best brand is the one that makes you smile.
            </p>

            <p>
              I built this for developers like me. People who want real product insights without selling their users&apos; data to big tech. People who&apos;d rather spend 5 minutes with Docker than 5 meetings with a sales team. If that sounds like you, I think you&apos;ll like what I built.
            </p>

            <p>
              It&apos;s fully open source, MIT licensed. Use it, fork it, break it, fix it. If you have ideas or find bugs, open an issue. I read every single one.
            </p>

            <p className="text-foreground">
              — Max
            </p>
          </div>

          {/* CTA */}
          <div className="mt-12 flex flex-col sm:flex-row items-center gap-3">
            <Link href="/docs#quick-start">
              <Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 gap-2">
                Try Bananalytics <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo/dashboard">
              <Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] hover:bg-white/[0.06]">
                See the Demo
              </Button>
            </Link>
          </div>

          {/* Links */}
          <div className="mt-8 flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              GitHub
            </a>
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              X
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
          <p className="text-[11px] text-muted-foreground/25">MIT License</p>
        </div>
      </footer>
    </div>
  );
}
