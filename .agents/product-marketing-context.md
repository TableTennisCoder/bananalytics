# Product marketing context — Bananalytics

Read this before writing any marketing copy, docs intro, or positioning. It is
the source of truth for who we talk to and how. Update it when the product or
the customer changes; do not let copy drift away from it.

Last revised: 2026-09-15

---

## What Bananalytics is

Product analytics for React Native apps that make money. Funnels built around
the paywall, revenue as a first-class number (ARPU, paying share, cohort value
at day 30), every metric with its delta against the previous period, and a
breakdown by platform, app version, country and device on everything.

Self-hosted on a €4 server with one command, or (coming) managed cloud. MIT.

**What it is for:** finding where an app loses users before they pay, and
whether the last release made it worse.

**What it is not:** a data platform. No SQL console for end users, no session
replay, no feature flags, no A/B testing. Fewer views, each one built around a
question a founder actually asks.

---

## Who it is for — the ICP

**The solo founder (or two-person team) of a consumer app with a paywall.**

Concretely, the archetype is the founder of Hairu: an AI hairstyle try-on app,
Expo + React Native, iOS and Android, ~50k new users a month, subscription
paywall after the first result. The person who built Bananalytics *is* this
person, and every analysis in the audit came from what they actually ran on
PostHog: paywall funnel by platform and country, onboarding funnel by step,
preset usage, release comparison, geo × device matrix, repeat-tap analysis.

| | |
|---|---|
| **Role** | Founder who also ships the code. There is no analyst; the founder is the analyst, at 11 pm, between a support ticket and the next release |
| **Stack** | Expo / React Native. Technical enough to ship an app, not a data engineer |
| **Monetisation** | Subscription or IAP behind a paywall. Revenue is a funnel step, not an afterthought |
| **Scale** | 10k–100k MAU, a few thousand to a few tens of thousands in MRR — enough that a two-point conversion change is real money, not enough for a data team |
| **Current tool** | PostHog free tier, Mixpanel/Amplitude starter, or Firebase + the RevenueCat dashboard |
| **Analytics ritual** | In bursts. Opens the dashboard after a release or when revenue dips. Rebuilds the same funnel each time. Gives up on half the questions because the query builder fights back |
| **Time budget** | An hour a week, if that |

**What they are trying to do:** make more money from the app they already have,
by finding the two or three places where users leave before paying and fixing
those — not by adding features, not by buying more traffic.

**What they fear:**
- Shipping a release that quietly tanks conversion and finding out two weeks later from the revenue chart
- Paying an analytics bill that grows with success
- A tool with forty features of which they use three, and still no answer

**What they do not care much about:** data sovereignty for its own sake, open
source as ideology, GDPR as a headline. Those are *reasons to trust*, not
reasons to buy. They matter once the person is already interested.

**Decision trigger:** a revenue dip they cannot explain; a "why does Android
convert worse" moment; a competitor's price increase; or a founder-friend
saying "I found my leak with this in an afternoon".

---

## The language they use

Copy should sound like this — it is how the founder talks about their own app:

- *paywall, checkout, trial-to-paid, conversion, drop-off, churn*
- *"where do they bail"*, *"what's the leak"*, *"which screen is costing me subscribers"*
- *"did 2.4.0 break something"*, *"the update hurt"*
- *"why does Android convert worse"*
- *MRR, ARPU, cohort, "what's a user worth"*
- *"turn a few dials"* / *"kleine Stellschrauben"* — small changes, measurable effect
- *"I don't need more charts, I need to know what to fix"*

Avoid: "empower", "unlock insights", "data-driven", "leverage", "enterprise-grade",
"seamless". Avoid leading with "privacy-first" or "self-hosted" — those go in the
trust line under the CTA, not in the headline.

Tone: direct, specific, a little dry. Numbers over adjectives. Say what it does,
not what it enables.

---

## Positioning

**For** founders of React Native apps with a paywall
**who** need to know where users leave before paying and whether the last release made it worse,
**Bananalytics is** product analytics built around the paywall funnel
**that** shows drop-off, revenue and cohort value split by platform, version and country, in views you will actually open —
**unlike** Mixpanel, Amplitude and PostHog, which give you a query builder and a bill that scales with your users.

**Headline value:** find where your app loses money.
**Supporting:** in minutes, not in a query builder; free at any scale; your data stays yours.

Ordering matters. Revenue outcome first, simplicity second, cost third, ownership
fourth. The old page had this exactly reversed.

---

## Proof points — what may go on the page

Only measured numbers. Everything here has a source; nothing is estimated.

| Claim | Source | Status |
|---|---|---|
| Dashboard load 273 ms at 4.2M events | perf run, DECISIONS.md | measured |
| 2,650 events/s ingested on 2 cores | perf run | measured |
| 32M events on 40 GB | perf run | measured |
| ~62 bytes per event in a backup | backup run, DECISIONS.md | measured |
| One-command install, ~5 minutes | verified on a fresh VPS | measured |
| Funnel drop-off per step, median time between steps, breakdown by any dimension | shipped | true |
| ARPU, ARPPU, paying share, cohort LTV at day 0/7/14/30/60/90 | shipped | true |
| Every KPI with delta vs. previous period | shipped | true |
| Tap and dwell recording | SDK 0.3.0 | **not published yet — do not claim until it is on npm** |
| SDK size | measured 17 kB gzipped (dist only, without uuid) | **the page says 12 kB — wrong, fix it** |

**Do not use as a real result:** "Android 10% vs iOS 24.8% paywall conversion".
That figure came from *synthetic* data seeded during the feature audit. It is
fine as an illustrative example clearly framed as one. It is not a case study.

**The strongest social proof available** is the founder's own app: a real
finding from Hairu, with real numbers, in the founder's words. Get that on the
page as soon as there is one.

---

## Objections and answers

| Objection | Answer |
|---|---|
| "I already have PostHog / Mixpanel" | You have forty features and you use three. You rebuild the same paywall funnel every time. Here it is the home screen |
| "Self-hosting is work" | One command on a €4 server. Backups scheduled for you. Cloud is coming if you want none of it |
| "Do I have to re-instrument?" | Same `track` / `identify` / `screen` API. Dual-track for a week, then switch |
| "Will it slow my app?" | 17 kB gzipped, events batched off the render path, offline-first |
| "Is it mature?" | Honest answer: new. Small surface, every query verified against real data, and the founder runs it on their own app |
| "What about GDPR?" | Your data never leaves your server, no third party in the path. This is the trust line, not the pitch |

---

## Competitors, honestly

Mixpanel, Amplitude and PostHog all have funnels, revenue analytics and cohorts.
Do not claim they lack features they have. The honest differences:

- **Focus** — built around the paywall funnel, not a general-purpose query builder
- **React Native first** — lifecycle, sessions, offline queue, taps; not a web tool with a mobile SDK
- **Cost at scale** — a fixed server bill instead of a per-event one
- **Setup** — one command, versus PostHog self-hosted needing real DevOps
- **Ownership** — your server, no DPA to sign

RevenueCat's dashboard is the other thing the ICP looks at. It knows *what* was
paid; it does not know *which screen* lost the people who did not pay. That is
the gap.
