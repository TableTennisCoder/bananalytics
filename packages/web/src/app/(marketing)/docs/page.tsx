"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import { LOGIN_URL } from "@/lib/dashboard-url";
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
  MapPin,
  Cloud,
  Wrench,
  Gauge,
  Lock,
  AlertTriangle,
} from "lucide-react";

type DocsPath = "cloud" | "self-host";

const cloudSidebar = [
  { id: "cloud-start", label: "Get Your Keys", icon: Key },
  { id: "ai-setup", label: "AI Setup", icon: Sparkles },
  { id: "sdk", label: "React Native SDK", icon: Smartphone },
  { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
  { id: "event-strategy", label: "Event Strategy", icon: Target },
  { id: "api", label: "API Reference", icon: Server },
  { id: "privacy", label: "Privacy", icon: Shield },
];

const selfHostSidebar = [
  { id: "quick-start", label: "Quick Start", icon: Terminal },
  { id: "server-setup", label: "Server Setup", icon: Lock },
  { id: "hosting", label: "Production Deploy", icon: Globe },
  { id: "capacity", label: "Capacity & Scaling", icon: Gauge },
  { id: "geoip", label: "GeoIP Setup", icon: MapPin },
  { id: "config", label: "Configuration", icon: Key },
  { id: "ai-setup", label: "AI Setup", icon: Sparkles },
  { id: "sdk", label: "React Native SDK", icon: Smartphone },
  { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
  { id: "event-strategy", label: "Event Strategy", icon: Target },
  { id: "api", label: "API Reference", icon: Server },
  { id: "privacy", label: "Privacy", icon: Shield },
];

export default function DocsPage() {
  const [path, setPath] = useState<DocsPath>("self-host");
  const [activeSection, setActiveSection] = useState("quick-start");

  // Restore the user's last choice from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bananalytics-docs-path");
    if (saved === "cloud" || saved === "self-host") {
      setPath(saved);
      setActiveSection(saved === "cloud" ? "cloud-start" : "quick-start");
    }
  }, []);

  const handlePathChange = (newPath: DocsPath) => {
    setPath(newPath);
    setActiveSection(newPath === "cloud" ? "cloud-start" : "quick-start");
    localStorage.setItem("bananalytics-docs-path", newPath);
    // Scroll to top so the user sees their first step
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sidebarItems = path === "cloud" ? cloudSidebar : selfHostSidebar;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <a href={LOGIN_URL}>
            <Button size="sm">Dashboard</Button>
          </a>
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

            {/* Current path indicator + switch */}
            <div className="mt-8 rounded-md border border-border bg-card/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Viewing
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                {path === "cloud" ? (
                  <Cloud className="h-3 w-3 text-primary" />
                ) : (
                  <Wrench className="h-3 w-3 text-primary" />
                )}
                {path === "cloud" ? "Cloud" : "Self-Host"} setup
              </p>
              <button
                onClick={() =>
                  handlePathChange(path === "cloud" ? "self-host" : "cloud")
                }
                className="mt-2 text-[11px] text-muted-foreground/70 hover:text-primary transition-colors cursor-pointer"
              >
                Switch to {path === "cloud" ? "Self-Host" : "Cloud"} →
              </button>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="mx-auto max-w-4xl flex-1 px-6 py-16 lg:px-12">
          <div className="mb-10">
            <h1 className="text-4xl font-bold">Documentation</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Everything you need to set up and use Bananalytics Analytics
            </p>
          </div>

          {/* Path selector — choose your setup style */}
          <div className="mb-12">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              How are you running Bananalytics?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <PathCard
                active={path === "cloud"}
                onClick={() => handlePathChange("cloud")}
                icon={<Cloud className="h-5 w-5" />}
                title="Bananalytics Cloud"
                description="Sign up, get keys, integrate the SDK. We handle the infra."
              />
              <PathCard
                active={path === "self-host"}
                onClick={() => handlePathChange("self-host")}
                icon={<Wrench className="h-5 w-5" />}
                title="Self-Host"
                description="Deploy with Docker on your own VPS. Full control, no fees."
              />
            </div>
          </div>

          <div className="space-y-16">
          {/* Cloud Quick Start — only visible in cloud path */}
          {path === "cloud" && (
          <DocSection
            icon={<Cloud className="h-5 w-5" />}
            title="Get Your Keys"
            id="cloud-start"
          >
            <p>
              You&apos;re three clicks away from tracking events. The infra is
              already running for you — just grab your keys and drop them into
              your app.
            </p>

            <p className="text-sm pt-2">
              <strong>1. Create your account.</strong> Head to{" "}
              <a
                href="https://app.bananalytics.xyz/signup"
                className="text-primary hover:underline"
              >
                app.bananalytics.xyz/signup
              </a>{" "}
              and register. Email + password, takes 30 seconds.
            </p>

            <p className="text-sm pt-2">
              <strong>2. Create your first project.</strong> After signup
              you&apos;re dropped into the dashboard. Click{" "}
              <strong>&quot;New Project&quot;</strong>, give it a name, and
              submit. You&apos;ll immediately see two keys:
            </p>
            <ul className="space-y-1.5 text-sm pl-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <code className="text-primary font-mono text-xs">rk_…</code>{" "}
                  — <strong>write key</strong>. Goes into your React Native app
                  (the SDK&apos;s <code className="font-mono text-xs">apiKey</code>{" "}
                  option). Used for ingesting events. Safe to ship in the bundle.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <code className="text-primary font-mono text-xs">sk_…</code>{" "}
                  — <strong>secret key</strong>. Used for querying your data via
                  the API. The dashboard uses it server-side — never expose it
                  in client code.
                </span>
              </li>
            </ul>
            <p className="text-sm">
              Copy both with the buttons in the modal. You can always re-view
              and rotate them later from{" "}
              <strong>Settings → API Keys</strong> on any project.
            </p>

            <p className="text-sm pt-2">
              <strong>3. Drop the write key into your app.</strong> Continue to{" "}
              <a href="#sdk" className="text-primary hover:underline">
                React Native SDK
              </a>{" "}
              below — install the package, paste your{" "}
              <code className="font-mono text-xs">rk_…</code> key, and you&apos;re
              tracking events. Your endpoint URL is{" "}
              <code className="font-mono text-xs">
                https://app.bananalytics.xyz
              </code>
              .
            </p>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm">
                <strong>Looking for the infra docs?</strong> Cloud users
                don&apos;t need to think about Postgres, Docker, or GeoIP —
                that&apos;s all managed for you. Switch to the{" "}
                <button
                  onClick={() => handlePathChange("self-host")}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Self-Host
                </button>{" "}
                tab above if you ever decide to run your own instance.
              </p>
            </div>
          </DocSection>
          )}

          {/* Self-Host Quick Start — only visible in self-host path */}
          {path === "self-host" && (
          <DocSection
            icon={<Terminal className="h-5 w-5" />}
            title="Quick Start"
            id="quick-start"
          >
            <p>Get Bananalytics running in 5 minutes with Docker.</p>
            <CodeBlock title="1. Clone & start the backend">{`git clone https://github.com/bananalytics-analytics/bananalytics.git
cd bananalytics/server
docker-compose up -d`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              That&apos;s it for the backend. Postgres + the Go server start
              together, and database migrations are applied automatically on
              startup — no manual SQL needed. Verify with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                docker-compose logs bananalytics
              </code>{" "}
              — you should see{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                migrations: applied successfully
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                server starting port=8080
              </code>
              .
            </p>

            <p className="text-sm pt-2">
              <strong>2. Create your admin account.</strong> Open{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                http://localhost:3000
              </code>{" "}
              in your browser. The first time you visit, you&apos;ll be
              redirected to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                /setup
              </code>{" "}
              to register the first admin user (name, email, password). This
              page is one-time only — once an admin exists, it returns 410 Gone
              and everyone has to sign in via{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                /login
              </code>
              .
            </p>

            <p className="text-sm pt-2">
              <strong>3. Create your first project.</strong> After signup
              you&apos;re dropped into the dashboard. Click{" "}
              <strong>&quot;New Project&quot;</strong> (or use the project
              switcher in the topbar), give it a name, and submit. You&apos;ll
              immediately see two keys:
            </p>
            <ul className="space-y-1.5 text-sm pl-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <code className="text-primary font-mono text-xs">rk_…</code>{" "}
                  — <strong>write key</strong>. Goes into your React Native app
                  (the SDK&apos;s <code className="font-mono text-xs">apiKey</code>{" "}
                  option). Used for ingesting events. Safe to ship in the bundle.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <code className="text-primary font-mono text-xs">sk_…</code>{" "}
                  — <strong>secret key</strong>. Used for querying your data via
                  the API (e.g. <code className="font-mono text-xs">/v1/query/events</code>
                  ). The dashboard stores it server-side per session — never
                  expose it in client code.
                </span>
              </li>
            </ul>
            <p className="text-sm">
              Copy both with the buttons in the modal. You can always re-view
              and rotate them later from{" "}
              <strong>Settings → API Keys</strong> on any project.
            </p>

            <p className="text-sm pt-2">
              <strong>4. Drop the write key into your app.</strong> Jump to the{" "}
              <a href="#sdk" className="text-primary hover:underline">
                React Native SDK
              </a>{" "}
              section below — install the package, paste your{" "}
              <code className="font-mono text-xs">rk_…</code> key, and you&apos;re
              tracking events.
            </p>
          </DocSection>
          )}

          {/* Self-Host infrastructure — only visible in self-host path */}
          {path === "self-host" && (
          <>
          {/* Server Setup — Ubuntu hardening before installing Bananalytics */}
          <DocSection
            icon={<Lock className="h-5 w-5" />}
            title="Server Setup"
            id="server-setup"
          >
            <p>
              Before installing Bananalytics on a fresh VPS, harden Ubuntu so
              you&apos;re not running production on root with a wide-open
              firewall. If your server is already locked down (non-root sudo
              user, key-only SSH, UFW, fail2ban), skip ahead to{" "}
              <a href="#hosting" className="text-primary hover:underline">
                Production Deploy
              </a>
              .
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              1. First login + system update
            </h4>
            <CodeBlock>{`ssh root@your-new-vps-ip
apt update && apt upgrade -y
apt autoremove -y`}</CodeBlock>

            <h4 className="text-base font-semibold mt-6 mb-3">
              2. Create a non-root sudo user
            </h4>
            <p className="text-sm text-muted-foreground">
              Don&apos;t use root for daily work. Replace{" "}
              <code className="font-mono text-xs">max</code> with whatever
              username you want.
            </p>
            <CodeBlock>{`adduser max          # set a password when prompted (used for sudo)
usermod -aG sudo max`}</CodeBlock>

            <h4 className="text-base font-semibold mt-6 mb-3">
              3. Copy your SSH key to the new user
            </h4>
            <CodeBlock>{`mkdir -p /home/max/.ssh
cp /root/.ssh/authorized_keys /home/max/.ssh/authorized_keys
chown -R max:max /home/max/.ssh
chmod 700 /home/max/.ssh
chmod 600 /home/max/.ssh/authorized_keys`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              Test from your laptop in a <strong>new terminal</strong> (keep
              the root session open as a fallback):{" "}
              <code className="font-mono text-xs">ssh max@your-vps-ip</code>
            </p>

            <h4 className="text-base font-semibold mt-6 mb-3">
              4. Lock down SSH (disable root + password auth)
            </h4>
            <p className="text-sm text-muted-foreground">
              Add a drop-in config (cleanest — won&apos;t be overwritten by
              cloud-init updates):
            </p>
            <CodeBlock>{`sudo tee /etc/ssh/sshd_config.d/00-hardening.conf > /dev/null <<EOF
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
EOF

sudo sshd -t                # must print nothing
sudo systemctl reload ssh`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              From a <strong>new terminal</strong>:{" "}
              <code className="font-mono text-xs">ssh root@your-vps-ip</code>{" "}
              must fail with &ldquo;Permission denied&rdquo;;{" "}
              <code className="font-mono text-xs">ssh max@your-vps-ip</code>{" "}
              must succeed. Only then close the existing root session.
            </p>

            <h4 className="text-base font-semibold mt-6 mb-3">
              5. Firewall (UFW)
            </h4>
            <CodeBlock>{`sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (Caddy needs for Let's Encrypt)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw --force enable
sudo ufw status verbose`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              Don&apos;t open 5432, 8080, or 3000 — Bananalytics binds those
              to the internal Docker network only. They should never be
              publicly reachable.
            </p>

            <h4 className="text-base font-semibold mt-6 mb-3">
              6. Fail2ban (brute-force protection)
            </h4>
            <CodeBlock>{`sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd  # see banned IPs anytime`}</CodeBlock>

            <h4 className="text-base font-semibold mt-6 mb-3">
              7. Automatic security updates
            </h4>
            <CodeBlock>{`sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# Press ENTER when asked "Automatically install stable updates? Yes"`}</CodeBlock>

            <h4 className="text-base font-semibold mt-6 mb-3">
              8. Timezone, hostname, swap
            </h4>
            <CodeBlock>{`# Set your timezone (affects log timestamps)
sudo timedatectl set-timezone Europe/Berlin

# Memorable hostname
sudo hostnamectl set-hostname bananalytics-prod

# 2 GB swap file — safety net for the 4 GB box
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p`}</CodeBlock>

            <h4 className="text-base font-semibold mt-6 mb-3">
              9. Useful tools + reboot
            </h4>
            <CodeBlock>{`sudo apt install -y htop ncdu git curl wget tmux jq
sudo reboot`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              Wait ~30 seconds, SSH back in as your new user. The box is now
              ready for the Bananalytics install. Continue to{" "}
              <a href="#hosting" className="text-primary hover:underline">
                Production Deploy
              </a>
              .
            </p>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm">
                <strong>Realistic time:</strong> ~10 minutes if you copy-paste
                straight through. Once you&apos;ve done it once, it&apos;s a
                5-minute ritual for any new box.
              </p>
            </div>
          </DocSection>

          {/* Production Deploy — install Bananalytics on the prepared VPS */}
          <DocSection
            icon={<Globe className="h-5 w-5" />}
            title="Production Deploy"
            id="hosting"
          >
            <p>
              Deploy Bananalytics on any Ubuntu VPS with Docker. Recommended:
              Hetzner CX22 (2 vCPU, 4 GB, 40 GB) at €4.75/month.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>This guide assumes a hardened VPS</strong> — non-root
              sudo user, key-only SSH, UFW with ports 22/80/443 open. If your
              server isn&apos;t set up yet, follow{" "}
              <a href="#server-setup" className="text-primary hover:underline">
                Server Setup
              </a>{" "}
              first.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              What you&apos;re deploying
            </h4>
            <p className="text-sm text-muted-foreground">
              Four containers, all on one VPS. Caddy is the only thing exposed
              to the internet — everything else lives on the internal Docker
              network.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">Service</th>
                    <th className="px-4 py-2 text-left font-medium">Port</th>
                    <th className="px-4 py-2 text-left font-medium">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">caddy</td>
                    <td className="px-4 py-2 text-muted-foreground">80, 443 (public)</td>
                    <td className="px-4 py-2 text-muted-foreground">HTTPS reverse proxy. Routes /v1/*, /health to the backend; everything else to the dashboard. Auto-provisions Let&apos;s Encrypt certificates.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">dashboard</td>
                    <td className="px-4 py-2 text-muted-foreground">3000 (internal)</td>
                    <td className="px-4 py-2 text-muted-foreground">Next.js admin UI. Login, project management, charts, retention, geography, settings.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">bananalytics</td>
                    <td className="px-4 py-2 text-muted-foreground">8080 (internal)</td>
                    <td className="px-4 py-2 text-muted-foreground">Go API server. Event ingestion (/v1/ingest), queries (/v1/query/*), auth (/v1/auth/*), GeoIP enrichment, rate limiting.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">postgres</td>
                    <td className="px-4 py-2 text-muted-foreground">5432 (internal)</td>
                    <td className="px-4 py-2 text-muted-foreground">PostgreSQL 16. Stores users, projects, sessions, and the partitioned events table. Migrations apply automatically on backend startup.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-base font-semibold mt-8 mb-3">
              1. Add a DNS A record
            </h4>
            <p className="text-sm text-muted-foreground">
              In your DNS provider, point the subdomain you want (e.g.{" "}
              <code className="font-mono text-xs">analytics.yourdomain.com</code>
              ) at your VPS IP. Verify after ~1 minute:
            </p>
            <CodeBlock>{`dig analytics.yourdomain.com +short
# should print your VPS IP`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              Critical: Caddy can&apos;t fetch a Let&apos;s Encrypt cert until
              DNS resolves correctly.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              2. Install Docker
            </h4>
            <CodeBlock>{`curl -fsSL https://get.docker.com | sh

# Let your sudo user run docker without sudo
sudo usermod -aG docker $USER
exit  # then SSH back in for group membership to take effect`}</CodeBlock>

            <h4 className="text-base font-semibold mt-8 mb-3">
              3. Clone the repo
            </h4>
            <CodeBlock>{`sudo mkdir -p /opt/bananalytics
sudo chown $USER:$USER /opt/bananalytics
cd /opt/bananalytics
git clone https://github.com/TableTennisCoder/bananalytics.git .`}</CodeBlock>

            <h4 className="text-base font-semibold mt-8 mb-3">
              4. Configure env vars
            </h4>
            <p className="text-sm text-muted-foreground">
              Create{" "}
              <code className="font-mono text-xs">
                /opt/bananalytics/server/.env
              </code>
              :
            </p>
            <CodeBlock>{`# Caddy uses this for the SSL cert hostname
BANANA_DOMAIN=analytics.yourdomain.com

# Origins allowed to call the API (your dashboard + marketing site)
BANANA_CORS_ORIGINS=https://analytics.yourdomain.com,https://yourdomain.com

BANANA_LOG_LEVEL=info`}</CodeBlock>

            <h4 className="text-base font-semibold mt-8 mb-3">
              5. (Optional) Copy GeoIP database
            </h4>
            <p className="text-sm text-muted-foreground">
              Without this, country/city features show empty data. From your
              local machine:
            </p>
            <CodeBlock>{`scp ./server/geoip/GeoLite2-City.mmdb \\
    user@your-vps-ip:/opt/bananalytics/server/geoip/`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              See <a href="#geoip" className="text-primary hover:underline">GeoIP Setup</a> for how to download the database.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              6. Build and start
            </h4>
            <CodeBlock>{`cd /opt/bananalytics/server
docker compose up -d --build`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              First build takes ~3-4 minutes. Then check:
            </p>
            <CodeBlock>{`docker compose ps           # all 4 services should be "healthy"
docker compose logs --tail 50

# Look for:
#   bananalytics  → "migrations: applied successfully"
#   bananalytics  → "server starting port=8080"
#   dashboard     → "Ready in Xms"
#   caddy         → "certificate obtained successfully"`}</CodeBlock>

            <h4 className="text-base font-semibold mt-8 mb-3">
              7. Claim your instance — DO THIS IMMEDIATELY
            </h4>
            <p className="text-sm">
              The{" "}
              <code className="font-mono text-xs">/setup</code> endpoint is{" "}
              <strong>publicly reachable until the first admin is created</strong>
              . If anyone else hits it before you, they own the instance.
            </p>
            <p className="text-sm">
              Open in your browser <strong>right now</strong>:
            </p>
            <CodeBlock>{`https://analytics.yourdomain.com/setup`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              Register your admin user. From then on,{" "}
              <code className="font-mono text-xs">/setup</code> returns 410
              Gone forever.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              8. Daily Postgres backup
            </h4>
            <p className="text-sm text-muted-foreground">
              Add to root&apos;s crontab (
              <code className="font-mono text-xs">sudo crontab -e</code>):
            </p>
            <CodeBlock>{`0 3 * * * docker exec server-postgres-1 pg_dump -U bananalytics bananalytics | gzip > /opt/backups/bananalytics-$(date +\\%F).sql.gz && find /opt/backups -name "bananalytics-*.sql.gz" -mtime +14 -delete`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              Daily backup at 3 AM, keeps 14 days of history. Don&apos;t
              forget <code className="font-mono text-xs">sudo mkdir -p /opt/backups</code>{" "}
              first.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              How to deploy updates
            </h4>
            <CodeBlock>{`cd /opt/bananalytics
git pull
cd server
docker compose up -d --build`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              ~30 seconds for code-only changes (cached layers), ~3 minutes for
              dependency changes.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm">
                <strong>Realistic time for the full deploy:</strong> ~20
                minutes (mostly DNS propagation + first Docker build). The
                whole flow is one git pull + one docker command — no manual
                database creation, no migration scripts, no SSL certs to
                renew. Caddy + the Go backend&apos;s auto-migrations handle
                it all.
              </p>
            </div>
          </DocSection>

          {/* Capacity & Scaling */}
          <DocSection
            icon={<Gauge className="h-5 w-5" />}
            title="Capacity & Scaling"
            id="capacity"
          >
            <p>
              Bananalytics is designed to run lean. The Go backend is a single
              static binary, Postgres uses a partitioned events table, and the
              SDK batches events to keep network traffic minimal. The result:
              you can run the entire stack &mdash; including your Next.js
              dashboard &mdash; on a $5 server for a long time before you need
              to scale up.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">What&apos;s actually using your RAM</h4>
            <p>
              On a typical Hetzner CX22 (2 vCPU, 4 GB RAM) running everything
              co-located, here&apos;s the memory budget at idle vs. modest
              load:
            </p>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">Service</th>
                    <th className="px-4 py-2 text-left font-medium">Idle</th>
                    <th className="px-4 py-2 text-left font-medium">Under load</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="px-4 py-2 font-mono text-xs">Ubuntu base + sshd</td><td className="px-4 py-2 text-muted-foreground">~300 MB</td><td className="px-4 py-2 text-muted-foreground">~300 MB</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs">Docker daemon</td><td className="px-4 py-2 text-muted-foreground">~100 MB</td><td className="px-4 py-2 text-muted-foreground">~100 MB</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs">PostgreSQL 16</td><td className="px-4 py-2 text-muted-foreground">~150 MB</td><td className="px-4 py-2 text-muted-foreground">~400&ndash;600 MB</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs">bananalytics (Go)</td><td className="px-4 py-2 text-muted-foreground">~30 MB</td><td className="px-4 py-2 text-muted-foreground">~80&ndash;150 MB</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs">Next.js dashboard</td><td className="px-4 py-2 text-muted-foreground">~250 MB</td><td className="px-4 py-2 text-muted-foreground">~400&ndash;500 MB</td></tr>
                  <tr className="bg-primary/[0.04]"><td className="px-4 py-2 font-semibold">Total</td><td className="px-4 py-2 font-semibold">~830 MB</td><td className="px-4 py-2 font-semibold">~1.3&ndash;1.7 GB</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground">
              You&apos;ll sit at ~25% RAM idle, ~40% under normal use. Plenty
              of headroom on a 4 GB box.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">Event throughput</h4>
            <p>
              The Go server is never the bottleneck &mdash; Postgres is. With
              the default config on 2 vCPU + 4 GB:
            </p>
            <ul className="space-y-1.5 text-sm pl-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Sustained ingest:</strong> ~500&ndash;1,000 events/second</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Peak burst:</strong> ~2,000 events/second (batched)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Per day sustained:</strong> ~40&ndash;80 million events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Per month theoretical max:</strong> ~1&ndash;2 billion events</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              For comparison, Mixpanel charges ~$2,800/month for 1B events
              (at $0.28/1K).
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">Disk is the real limit</h4>
            <p>
              Each event row is ~300&ndash;700 bytes in Postgres (event name,
              properties JSON, IDs, timestamps, geo, indexes). Including
              index overhead and WAL:
            </p>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">Events stored</th>
                    <th className="px-4 py-2 text-left font-medium">Approx disk used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="px-4 py-2">1 million</td><td className="px-4 py-2 text-muted-foreground">~1 GB</td></tr>
                  <tr><td className="px-4 py-2">10 million</td><td className="px-4 py-2 text-muted-foreground">~8&ndash;12 GB</td></tr>
                  <tr><td className="px-4 py-2">30 million</td><td className="px-4 py-2 text-muted-foreground">~25&ndash;30 GB</td></tr>
                  <tr><td className="px-4 py-2">50 million</td><td className="px-4 py-2 text-destructive">~40 GB &mdash; disk full</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm">
              <strong>Practical capacity of a CX22:</strong> ~30&ndash;40
              million events stored. If you average 50 events per active user
              per day:
            </p>
            <ul className="space-y-1.5 text-sm pl-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>1K MAU</strong> &rarr; ~50K events/day &rarr; <strong>years of headroom</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>10K MAU</strong> &rarr; ~500K events/day &rarr; <strong>~2 months on disk</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>100K MAU</strong> &rarr; ~5M events/day &rarr; <strong>~6 days on disk</strong> &mdash; needs upgrade</span>
              </li>
            </ul>

            <h4 className="text-base font-semibold mt-8 mb-3">Recommended specs by app stage</h4>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-2 text-left font-medium">App stage</th>
                    <th className="px-4 py-2 text-left font-medium">Hetzner box</th>
                    <th className="px-4 py-2 text-left font-medium">Cost / mo</th>
                    <th className="px-4 py-2 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-primary/[0.04]">
                    <td className="px-4 py-2 font-medium">MVP &mdash; first 1K users</td>
                    <td className="px-4 py-2 font-mono text-xs">CX22 &middot; 2/4/40</td>
                    <td className="px-4 py-2 font-bold text-primary">€4.75</td>
                    <td className="px-4 py-2 text-muted-foreground">6+ months runway</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">10K&ndash;50K MAU</td>
                    <td className="px-4 py-2 font-mono text-xs">CX32 &middot; 4/8/80</td>
                    <td className="px-4 py-2">~€7</td>
                    <td className="px-4 py-2 text-muted-foreground">More disk runway, smoother queries</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">50K&ndash;200K MAU</td>
                    <td className="px-4 py-2 font-mono text-xs">CX42 &middot; 8/16/160</td>
                    <td className="px-4 py-2">~€15</td>
                    <td className="px-4 py-2 text-muted-foreground">Better Postgres caching, big-query headroom</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">200K+ MAU</td>
                    <td className="px-4 py-2 font-mono text-xs">Dedicated DB box</td>
                    <td className="px-4 py-2">~€30+</td>
                    <td className="px-4 py-2 text-muted-foreground">Split Postgres onto its own VM via private network</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-base font-semibold mt-8 mb-3">When to upgrade</h4>
            <p>Watch for these signals:</p>
            <ul className="space-y-1.5 text-sm pl-2">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Disk &gt; 70% full</strong> &rarr; attach a Hetzner Volume (€0.044/GB/mo, separate block storage) and mount it on{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/var/lib/docker/volumes/server_pgdata</code>
                  . Cheaper than upgrading the whole VM.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Postgres queries &gt; 2s</strong> on the dashboard &rarr; bump to CX32 (more shared_buffers cache hits).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Ingest p99 latency &gt; 100ms</strong> &rarr; add CPU; or move ratelimit/auth caches to Postgres-backed store and load-balance two backends behind your reverse proxy.</span>
              </li>
            </ul>

            <h4 className="text-base font-semibold mt-8 mb-3">Monitoring commands</h4>
            <CodeBlock title="Quick health check">{`# Container resource usage (run on the server)
docker stats

# Disk usage
df -h
docker exec server-postgres-1 psql -U bananalytics -d bananalytics \\
  -c "SELECT pg_size_pretty(pg_database_size('bananalytics'));"

# Slow queries (last 24h)
docker-compose logs bananalytics --since 24h | grep -i "duration_ms.*[0-9]\\{4,\\}"`}</CodeBlock>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm">
                <strong>Tip:</strong> Hetzner lets you resize the VM with the
                data volume intact &mdash; ~30 seconds of downtime. No reason
                to over-provision now. Start small, grow as needed.
              </p>
            </div>
          </DocSection>

          {/* GeoIP Setup */}
          <DocSection
            icon={<MapPin className="h-5 w-5" />}
            title="GeoIP Setup"
            id="geoip"
          >
            <p>
              Bananalytics uses MaxMind&apos;s free GeoLite2 database to map
              user IP addresses to countries and cities. This powers the 3D
              globe, the geography dashboard, and the &quot;Top Country&quot;
              KPI on your overview.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Without this setup, all geo features will be empty.</strong>
              {" "}The server runs fine — it just won&apos;t enrich events with
              location data. Lookups happen locally on your server, so no IP
              data ever leaves your infrastructure.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              1. Get a free MaxMind license key
            </h4>
            <p>
              Sign up at{" "}
              <a
                href="https://www.maxmind.com/en/geolite2/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                maxmind.com/en/geolite2/signup
              </a>{" "}
              (free, takes 30 seconds). After confirming your email, go to
              &quot;My License Key&quot; → &quot;Generate new license key&quot;.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              2. Download the database
            </h4>
            <p>
              The repository ships with a download script. Run it in the{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                server/
              </code>{" "}
              directory:
            </p>
            <CodeBlock title="macOS / Linux">{`export MAXMIND_LICENSE_KEY=your_key_here
./scripts/download-geoip.sh`}</CodeBlock>
            <CodeBlock title="Windows (PowerShell)">{`$env:MAXMIND_LICENSE_KEY = "your_key_here"
.\\scripts\\download-geoip.ps1`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              The script downloads ~70 MB to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                ./geoip/GeoLite2-City.mmdb
              </code>
              . That directory is already mounted into the Docker container
              and gitignored.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              3. Restart the server
            </h4>
            <CodeBlock>{`docker-compose restart bananalytics`}</CodeBlock>
            <p>
              You should see{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                GeoIP database loaded
              </code>{" "}
              in the logs (instead of{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                GeoIP disabled
              </code>
              ). All new events will now be enriched with country, city, and
              coordinates.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              4. Keep it fresh (optional)
            </h4>
            <p>
              MaxMind updates the database weekly. To stay current, re-run the
              script monthly — or add a cron job:
            </p>
            <CodeBlock title="Cron — first Sunday of every month, 3 AM">{`0 3 1-7 * 0 cd /path/to/bananalytics/server && \\
  MAXMIND_LICENSE_KEY=xxx ./scripts/download-geoip.sh && \\
  docker-compose restart bananalytics`}</CodeBlock>

            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm">
                <strong>Privacy note:</strong> The lookup happens entirely
                on your server. The MaxMind database is local — no IP
                addresses are ever sent to MaxMind or any third party. Only
                the resolved country / city are stored alongside the event.
              </p>
            </div>
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
                  <ConfigRow option="BANANA_PORT" default="8080" desc="HTTP server port" />
                  <ConfigRow option="BANANA_DB_DSN" default="required" desc="PostgreSQL connection string" />
                  <ConfigRow option="BANANA_LOG_LEVEL" default="info" desc="debug, info, warn, error" />
                  <ConfigRow option="BANANA_RATE_LIMIT_RPM" default="1000" desc="Requests/min per API key" />
                  <ConfigRow option="BANANA_IP_RATE_LIMIT_RPM" default="300" desc="Requests/min per IP" />
                  <ConfigRow option="BANANA_CORS_ORIGINS" default="*" desc="Allowed origins" />
                  <ConfigRow option="BANANA_DB_MAX_CONNS" default="25" desc="Max DB connections" />
                  <ConfigRow option="BANANA_GEOIP_DB" default="" desc="Path to GeoLite2-City.mmdb" />
                  <ConfigRow option="BANANA_DOMAIN" default="localhost" desc="Domain for Caddy HTTPS" />
                </tbody>
              </table>
            </div>
          </DocSection>
          </>
          )}

          {/* AI Setup */}
          <DocSection
            icon={<Sparkles className="h-5 w-5" />}
            title="AI Setup"
            id="ai-setup"
          >
            <p>
              Copy the prompt below and paste it into Claude Code, Cursor, Copilot, or any AI coding agent. It will integrate Bananalytics into your React Native app in one run.
            </p>

            <AiPromptCard>{`Integrate Bananalytics analytics into this React Native / Expo app. Bananalytics is a self-hosted, privacy-first product analytics tool. Follow these steps exactly:

## 1. Install dependencies

npm install @bananalytics/react-native @react-native-async-storage/async-storage react-native-get-random-values

The "react-native-get-random-values" package is REQUIRED. Bananalytics uses uuid internally,
which calls crypto.getRandomValues() — that API is not available in React Native without
this polyfill. Without it, Bananalytics.init() will hard-crash the app.

## 2. Add the polyfill as the FIRST line of the app entry

File: src/app/_layout.tsx (Expo Router) OR App.tsx (bare RN if no expo-router)

The polyfill import MUST be the very first line of the file — before ALL other imports,
including CSS resets, third-party libraries, or your own modules. Order matters: uuid is
loaded by Bananalytics on import, so the polyfill has to register globalThis.crypto first.

Example result:

import "react-native-get-random-values"; // must be first — polyfills crypto.getRandomValues() for uuid
import "@/global.css";
import { useEffect } from "react";
import { Bananalytics } from "@bananalytics/react-native";
// ...rest of imports

## 3. Initialize the SDK (static API only — do NOT use the Provider)

Initialize Bananalytics ONCE at module scope in the entry file. Use the static
Bananalytics.init() approach. Do NOT wrap the tree with <BananalyticsProvider> —
it is not needed and the hook-based useBananalytics() must never be called.

import { Bananalytics } from '@bananalytics/react-native';

Bananalytics.init({
  apiKey: 'YOUR_WRITE_KEY',          // Replace with your rk_... write key
  endpoint: 'YOUR_ENDPOINT',         // Replace with your server URL (e.g. https://analytics.yourapp.com)
  flushInterval: 30000,              // Send events every 30s
  flushAt: 20,                       // Or when 20 events are queued
  trackAppLifecycle: true,           // Auto-track app foreground/background
  debug: false,                      // Set true during development
});

## 4. Identify users

After the user logs in or you have a user ID, call identify:

Bananalytics.identify('USER_ID', {
  email: user.email,          // optional traits
  plan: user.plan,
  created_at: user.createdAt,
});

## 5. Track screen views (static only)

For every screen/page in the app, track the screen view. Use ONLY the static call —
do NOT import useTrackScreen from @bananalytics/react-native (that hook requires the
Provider, which we are not using).

If you want a hook-shaped helper, define your own in src/lib/analytics.ts:

import { useEffect } from 'react';
import { Bananalytics } from '@bananalytics/react-native';

export function useTrackScreen(name: string, props?: Record<string, string | number | boolean>): void {
  useEffect(() => {
    Bananalytics.screen(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}

Then call it inside each screen component:

useTrackScreen('HomeScreen');

Or call the static API directly:

Bananalytics.screen('HomeScreen');

## 6. Track events

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

## Rules
- Polyfill import MUST be the first line of the entry file
- Use the static Bananalytics.* API only — do NOT add BananalyticsProvider
- Do NOT import useTrackScreen or useBananalytics from @bananalytics/react-native
- Use snake_case for all event names (e.g. purchase_completed not purchaseCompleted)
- Keep event properties flat (no nested objects)
- Call identify() as early as possible after login
- Call screen() on every screen mount
- Do NOT track sensitive data (passwords, credit card numbers, SSN)
- The SDK handles offline queuing, batching, and retries automatically

## Verify
After the changes, the app should start with no Bananalytics errors in the console
and no crypto.getRandomValues() crash.

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
npm install @react-native-async-storage/async-storage
npm install react-native-get-random-values`}</CodeBlock>
            <p className="text-sm text-muted-foreground">
              <code className="text-primary font-mono text-xs">react-native-get-random-values</code> polyfills{" "}
              <code className="text-primary font-mono text-xs">crypto.getRandomValues()</code> for the{" "}
              <code className="text-primary font-mono text-xs">uuid</code> dependency. Without it,{" "}
              <code className="text-primary font-mono text-xs">Bananalytics.init()</code> crashes on first run. See{" "}
              <a href="#troubleshooting" className="text-primary underline underline-offset-2 hover:text-primary/80">Troubleshooting</a> for details.
            </p>
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

          {/* Troubleshooting */}
          <DocSection
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Troubleshooting"
            id="troubleshooting"
          >
            <p>
              Common issues integrating Bananalytics into a React Native or Expo app, and how to fix them.
            </p>

            <h4 className="text-base font-semibold mt-8 mb-3">
              <code className="font-mono text-[15px] text-destructive">crypto.getRandomValues() is not supported</code>
            </h4>
            <p>
              Bananalytics uses <code className="text-primary font-mono text-xs">uuid</code> internally, which calls{" "}
              <code className="text-primary font-mono text-xs">crypto.getRandomValues()</code>. That API is not available in React Native by default — without a polyfill,{" "}
              <code className="text-primary font-mono text-xs">Bananalytics.init()</code> hard-crashes the app.
            </p>

            <h5 className="text-sm font-semibold mt-6 mb-2">1. Install the polyfill</h5>
            <CodeBlock title="Install" lang="bash">{`npm install react-native-get-random-values`}</CodeBlock>

            <h5 className="text-sm font-semibold mt-6 mb-2">2. Import it as the FIRST line of your entry file</h5>
            <p>
              The polyfill must run before <code className="text-primary font-mono text-xs">@bananalytics/react-native</code> is loaded — otherwise{" "}
              <code className="text-primary font-mono text-xs">uuid</code> resolves before{" "}
              <code className="text-primary font-mono text-xs">globalThis.crypto</code> is patched. Add it as the very first line of your app entry —{" "}
              <code className="text-primary font-mono text-xs">src/app/_layout.tsx</code> (Expo Router) or{" "}
              <code className="text-primary font-mono text-xs">App.tsx</code> (bare RN), before all other imports including CSS.
            </p>
            <CodeBlock title="src/app/_layout.tsx" lang="typescript">{`import "react-native-get-random-values"; // must be first — polyfills crypto.getRandomValues() for uuid
import "@/global.css";
import { useEffect } from "react";
import { Bananalytics } from "@bananalytics/react-native";

Bananalytics.init({
  apiKey: 'rk_...',
  endpoint: 'https://your-server.com',
});`}</CodeBlock>

            <h4 className="text-base font-semibold mt-10 mb-3">
              <code className="font-mono text-[15px] text-destructive">useTrackScreen / useBananalytics throws</code>
            </h4>
            <p>
              The hook-based <code className="text-primary font-mono text-xs">useTrackScreen()</code> and{" "}
              <code className="text-primary font-mono text-xs">useBananalytics()</code> exports require{" "}
              <code className="text-primary font-mono text-xs">&lt;BananalyticsProvider&gt;</code> wrapping the tree. If you use the static{" "}
              <code className="text-primary font-mono text-xs">Bananalytics.init()</code> approach (recommended), do <strong>not</strong> import these hooks — calling them without the provider throws.
            </p>
            <p className="mt-3">
              Instead, define a tiny local hook that wraps <code className="text-primary font-mono text-xs">Bananalytics.screen()</code>:
            </p>
            <CodeBlock title="src/lib/analytics.ts" lang="typescript">{`import { useEffect } from "react";
import { Bananalytics } from "@bananalytics/react-native";

export function useTrackScreen(
  name: string,
  props?: Record<string, string | number | boolean>,
): void {
  useEffect(() => {
    Bananalytics.screen(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}`}</CodeBlock>
            <p className="mt-3 text-sm text-muted-foreground">
              Then use it in any screen: <code className="text-primary font-mono text-xs">useTrackScreen(&apos;HomeScreen&apos;)</code>. No provider required.
            </p>

            <h4 className="text-base font-semibold mt-10 mb-3">Static API vs Provider — pick one</h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Static (recommended for Expo Router):</strong> call <code className="text-primary font-mono text-xs">Bananalytics.init()</code> once at module scope. Use <code className="text-primary font-mono text-xs">Bananalytics.track / screen / identify</code> directly. No provider, no hooks from the SDK.</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span><strong>Provider:</strong> wrap your tree with <code className="text-primary font-mono text-xs">&lt;BananalyticsProvider&gt;</code> and use <code className="text-primary font-mono text-xs">useBananalytics()</code> / <code className="text-primary font-mono text-xs">useTrackScreen()</code>. Mixing both styles in the same app is what causes most setup bugs — pick one and stick with it.</span>
              </li>
            </ul>
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

            <EndpointDoc method="POST" path="/v1/projects" auth="Session" description="Create a new project. Requires a logged-in user (sets owner = current user). The new project's write_key and secret_key are returned once and only once — store them immediately."
              bodyExample={`{ "name": "My App" }`}
              responseExample={`{ "id": "uuid", "name": "My App", "write_key": "rk_...", "secret_key": "sk_..." }`}
              errorCodes={[
                { code: 401, desc: "Not signed in (no banana_user_session cookie)" },
                { code: 429, desc: "Project-creation rate limit exceeded (5/min/IP)" },
              ]}
            />

            <EndpointDoc method="GET" path="/v1/projects" auth="Session" description="List all projects the current user belongs to."
              responseExample={`{ "projects": [{ "id": "uuid", "name": "My App", "role": "owner" }] }`}
            />

            <EndpointDoc method="POST" path="/v1/projects/{id}/keys/rotate" auth="Session (owner)" description="Generate new write_key and secret_key for the project. The old keys stop working immediately — update your app before rotating in production."
              responseExample={`{ "write_key": "rk_new...", "secret_key": "sk_new..." }`}
              errorCodes={[
                { code: 401, desc: "Not signed in" },
                { code: 403, desc: "Signed in but not the owner of this project" },
              ]}
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

function PathCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all cursor-pointer",
        active
          ? "border-primary bg-primary/[0.06] shadow-[0_0_0_1px_rgba(255,214,10,0.4)]"
          : "border-border bg-card/30 hover:border-primary/40 hover:bg-card/60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:text-foreground",
        )}
      >
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {active && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Selected
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </button>
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
