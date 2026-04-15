"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Cloud, Zap, Shield, Headphones, Globe, Database } from "lucide-react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // In production this would POST to an API
    setSubmitted(true);
  };

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
      <div className="pointer-events-none absolute left-1/2 top-[20%] -z-10 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/[0.06] blur-[150px]" />

      <main className="flex-1">
        <div className="mx-auto max-w-[560px] px-4 py-24 sm:py-32">
          {!submitted ? (
            <>
              {/* Badge */}
              <div className="flex justify-center mb-8">
                <span className="inline-flex items-center gap-2 border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-primary">
                  <Cloud className="h-3.5 w-3.5" />
                  Coming Soon
                </span>
              </div>

              <h1 className="text-center text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight tracking-tight text-balance">
                Bananalytics Cloud
              </h1>
              <p className="mx-auto mt-4 max-w-[440px] text-center text-[15px] leading-relaxed text-muted-foreground text-balance">
                All the power of Bananalytics without managing infrastructure. We handle the servers, backups, and scaling — you focus on building your app.
              </p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-10 flex gap-3">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 h-10"
                />
                <Button type="submit" className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90">
                  Join Waitlist
                </Button>
              </form>

              <p className="mt-3 text-center text-[12px] text-muted-foreground/40">
                No spam. We only email when Cloud is ready to launch.
              </p>

              {/* What you get */}
              <div className="mt-16 space-y-4">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">
                  What&apos;s included
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Feature icon={<Database className="h-4 w-4" />} title="Managed Postgres" description="Auto-scaled, daily backups, zero config" />
                  <Feature icon={<Globe className="h-4 w-4" />} title="Custom domain + SSL" description="analytics.yourapp.com with auto HTTPS" />
                  <Feature icon={<Zap className="h-4 w-4" />} title="Unlimited events" description="No per-event fees, flat monthly pricing" />
                  <Feature icon={<Shield className="h-4 w-4" />} title="GDPR compliant" description="EU hosting option, data processing agreement" />
                  <Feature icon={<Headphones className="h-4 w-4" />} title="Priority support" description="Direct access to the team, same-day responses" />
                  <Feature icon={<Cloud className="h-4 w-4" />} title="99.9% SLA" description="High availability with automatic failover" />
                </div>
              </div>

              {/* Server locations */}
              <div className="mt-10 space-y-4">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">
                  Choose your region
                </p>
                <p className="text-center text-[13px] text-muted-foreground/60">
                  Pick the server closest to your users. Powered by Hetzner Cloud.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Location country="germany" city="Nuremberg" region="EU Central" />
                  <Location country="germany" city="Falkenstein" region="EU Central" />
                  <Location country="finland" city="Helsinki" region="EU North" />
                  <Location country="united-states-of-america" city="Ashburn, VA" region="US East" />
                  <Location country="united-states-of-america" city="Hillsboro, OR" region="US West" />
                  <Location country="singapore" city="Singapore" region="Asia Pacific" />
                </div>
              </div>

              {/* Pricing preview */}
              <div className="mt-16 border border-border bg-card p-6 text-center">
                <p className="text-[12px] text-muted-foreground/50 mb-2">Starting at</p>
                <p className="text-[40px] font-bold tracking-tight leading-none">
                  $29<span className="text-sm font-normal text-muted-foreground/50 ml-1">/mo</span>
                </p>
                <p className="text-[13px] text-muted-foreground/50 mt-2">Up to 1M events. No surprises.</p>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-primary/10">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold">You&apos;re on the list!</h1>
              <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed max-w-[380px] mx-auto">
                We&apos;ll notify <strong className="text-foreground">{email}</strong> as soon as Bananalytics Cloud is ready. In the meantime, you can self-host for free.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/docs#quick-start">
                  <Button className="h-10 bg-primary px-6 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90">
                    Start Self-Hosting
                  </Button>
                </Link>
                <Link href="/demo/dashboard">
                  <Button variant="outline" className="h-10 border-white/[0.08] bg-white/[0.03] px-6 text-[14px] hover:bg-white/[0.06]">
                    Try the Demo
                  </Button>
                </Link>
              </div>
            </div>
          )}
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

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border border-border bg-card p-3.5">
      <div className="flex h-8 w-8 items-center justify-center bg-primary/[0.08] text-primary shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Location({ country, city, region }: { country: string; city: string; region: string }) {
  return (
    <div className="flex items-center gap-2.5 border border-border bg-card px-3 py-2.5">
      <img
        src={`https://cdn.countryflags.com/thumbs/${country}/flag-round-250.png`}
        alt={city}
        className="h-6 w-6 rounded-full object-cover shrink-0"
      />
      <div>
        <p className="text-[12px] font-medium">{city}</p>
        <p className="text-[10px] text-muted-foreground/50">{region}</p>
      </div>
    </div>
  );
}
