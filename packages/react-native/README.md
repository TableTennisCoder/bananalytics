# @rochade/react-native

Self-hosted analytics SDK for React Native apps. Track events, identify users, and auto-capture lifecycle data.

## Installation

```bash
npm install @rochade/react-native uuid
npm install @react-native-async-storage/async-storage
```

## Quick Start

### Imperative API

```typescript
import { Rochade } from '@rochade/react-native';

Rochade.init({
  apiKey: 'rk_your_write_key',
  endpoint: 'https://your-server.com',
});

Rochade.track('button_clicked', { button: 'signup' });
Rochade.identify('user-123', { plan: 'pro' });
Rochade.screen('HomeScreen');
```

### React Provider

```tsx
import { RochadeProvider, useRochade, useTrackScreen } from '@rochade/react-native';

function App() {
  return (
    <RochadeProvider config={{ apiKey: 'rk_...', endpoint: 'https://...' }}>
      <HomeScreen />
    </RochadeProvider>
  );
}

function HomeScreen() {
  useTrackScreen('HomeScreen');
  const rochade = useRochade();

  return (
    <Button onPress={() => rochade.track('button_clicked')} title="Click me" />
  );
}
```

## Configuration

```typescript
interface RochadeConfig {
  apiKey: string;           // Write-only public key (required)
  endpoint: string;         // Ingestion API URL (required)
  flushInterval?: number;   // ms between auto-flushes (default: 30000)
  flushAt?: number;         // Events before auto-flush (default: 20)
  maxQueueSize?: number;    // Max events in memory (default: 1000)
  maxRetries?: number;      // Retry attempts (default: 3)
  debug?: boolean;          // Enable console logging (default: false)
  trackAppLifecycle?: boolean; // Auto-track foreground/background (default: true)
  trackScreens?: boolean;   // Auto-track screen views (default: false)
  sessionTimeout?: number;  // Session timeout in ms (default: 1800000)
}
```

## API

| Method | Description |
|---|---|
| `Rochade.init(config)` | Initialize the SDK |
| `Rochade.track(event, properties?)` | Track a custom event |
| `Rochade.screen(name, properties?)` | Track a screen view |
| `Rochade.identify(userId, traits?)` | Identify the current user |
| `Rochade.reset()` | Clear identity and generate new anonymous ID |
| `Rochade.optIn()` | Resume tracking |
| `Rochade.optOut()` | Stop all tracking |
| `Rochade.flush()` | Manually flush queued events |

## Features

- Automatic event batching and flushing
- Offline persistence with AsyncStorage
- Exponential backoff retry on network failures
- Session tracking with configurable timeout
- Privacy controls (opt-in/opt-out)
- Zero uncaught exceptions (host app stability is sacred)

## License

MIT
