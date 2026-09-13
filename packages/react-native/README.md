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

## Automatically captured

With `trackAppLifecycle` on (the default):

| Event | When |
|---|---|
| `$app_opened` | The app starts. A cold start is not a foreground transition, so it needs its own event |
| `$app_foreground` | The app returns from the background |
| `$app_background` | The app goes to the background. The queue is persisted and flushed here |
| `$session_start` / `$session_end` | A session begins or times out (`sessionTimeout`, default 30 min) |

## Features

- Automatic event batching and flushing, split into requests the server accepts
- Offline persistence with AsyncStorage, order preserved across restarts
- Exponential backoff retry on network failures
- Session tracking with configurable timeout
- Privacy controls (opt-in/opt-out), and no requests to anyone but your server
- Zero uncaught exceptions (host app stability is sacred)

## License

MIT
