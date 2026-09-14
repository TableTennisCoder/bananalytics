# @bananalytics/react-native

Self-hosted analytics SDK for React Native apps. Track events, identify users, and auto-capture lifecycle data.

## Installation

```bash
npm install @bananalytics/react-native uuid
npm install @react-native-async-storage/async-storage
```

## Quick Start

### Imperative API

```typescript
import { Bananalytics } from '@bananalytics/react-native';

Bananalytics.init({
  apiKey: 'rk_your_write_key',
  endpoint: 'https://your-server.com',
});

Bananalytics.track('button_clicked', { button: 'signup' });
Bananalytics.identify('user-123', { plan: 'pro' });
Bananalytics.screen('HomeScreen');
```

### React Provider

```tsx
import { BananalyticsProvider, useBananalytics, useTrackScreen } from '@bananalytics/react-native';

function App() {
  return (
    <BananalyticsProvider config={{ apiKey: 'rk_...', endpoint: 'https://...' }}>
      <HomeScreen />
    </BananalyticsProvider>
  );
}

function HomeScreen() {
  useTrackScreen('HomeScreen');
  const bananalytics = useBananalytics();

  return (
    <Button onPress={() => bananalytics.track('button_clicked')} title="Click me" />
  );
}
```

## Configuration

```typescript
interface BananalyticsConfig {
  apiKey: string;           // Write-only public key (required)
  endpoint: string;         // Ingestion API URL (required)
  flushInterval?: number;   // ms between auto-flushes (default: 30000)
  flushAt?: number;         // Events before auto-flush (default: 20)
  maxQueueSize?: number;    // Max events in memory (default: 1000)
  maxRetries?: number;      // Retry attempts (default: 3)
  debug?: boolean;          // Enable console logging (default: false)
  trackAppLifecycle?: boolean; // Auto-track app open + foreground/background (default: true)
  trackScreens?: boolean;   // Auto-track screen views (default: false)
  trackTaps?: boolean;      // Record where people tap (default: false)
  tapSampleRate?: number;   // Share of sessions that record taps (default: 1)
  sessionTimeout?: number;  // Session timeout in ms (default: 1800000)
}
```

## API

| Method | Description |
|---|---|
| `Bananalytics.init(config)` | Initialize the SDK |
| `Bananalytics.track(event, properties?)` | Track a custom event |
| `Bananalytics.screen(name, properties?)` | Track a screen view |
| `Bananalytics.trackRevenue(amount, currency?, properties?, event?)` | Track a purchase. Adds `revenue` and `currency` to the properties, which the server reads into its own columns |
| `Bananalytics.identify(userId, traits?)` | Identify the current user. Events sent before this are attributed to the same person afterwards |
| `Bananalytics.reset()` | Clear identity and generate new anonymous ID |
| `Bananalytics.optIn()` | Resume tracking |
| `Bananalytics.optOut()` | Stop tracking and discard anything still queued |
| `Bananalytics.flush()` | Manually flush queued events |

Any event can carry revenue — adding `revenue` and `currency` to the properties
of your own purchase event does the same thing as `trackRevenue`.

## Recording taps

Off by default: taps roughly double an app's event volume. Turning them on also
turns on screen tracking, because a coordinate without a screen name says
nothing.

```tsx
Bananalytics.init({ apiKey: 'rk_...', endpoint: '...', trackTaps: true });
```

```tsx
// app/_layout.tsx — wrap the app so touches can be seen
import { BananalyticsRoot } from '@bananalytics/react-native';

<BananalyticsRoot>
  <Stack />
</BananalyticsRoot>
```

Each touch becomes a `$tap` carrying `screen`, `x`, `y`, `screen_w` and
`screen_h` — five numbers, nothing about what was on the screen. Coordinates are
in density-independent pixels and the screen size travels with them, so the same
tap is comparable across devices and survives rotation.

A touch that turns into a drag is not recorded. A scroll and a tap look
identical when a finger lands, and a recorded scroll would look exactly like a
tap that led nowhere — the one signal this is for.

`tapSampleRate` is decided **once per session**, not per touch. A half-recorded
session is worse than none: a tap with no event after it means a broken button,
so dropping the follow-up event would report one that works perfectly.

## Automatically captured

With `trackAppLifecycle` on (the default):

| Event | When |
|---|---|
| `$app_opened` | The app starts. A cold start is not a foreground transition, so it needs its own event |
| `$app_foreground` | The app returns from the background |
| `$app_background` | The app goes to the background. The queue is persisted and flushed here |
| `$session_start` / `$session_end` | A session begins or times out (`sessionTimeout`, default 30 min) |
| `$screen_leave` | A screen is left, with `dwell_ms` — how long it was actually in front of someone. Backgrounding the app ends the count |
| `$tap` | Only with `trackTaps`, see above |

## Features

- Automatic event batching and flushing, split into requests the server accepts
- Offline persistence with AsyncStorage, order preserved across restarts
- Exponential backoff retry on network failures
- Session tracking with configurable timeout
- Privacy controls (opt-in/opt-out), and no requests to anyone but your server
- Zero uncaught exceptions (host app stability is sacred)

## License

MIT
