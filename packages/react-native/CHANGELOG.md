# Changelog

## 0.3.0

Records where people tap and how long they stay — the questions session
replays get watched for, answered from events instead of video.

### Added

- **`trackTaps`** turns on tap recording, and **`BananalyticsRoot`** is the
  component to wrap your app in so touches can be seen. Each touch becomes a
  `$tap` carrying `screen`, `x`, `y`, `screen_w` and `screen_h` — five numbers,
  nothing about what was on the screen.

  Off by default: taps roughly double an app's event volume, and that is not a
  cost to impose without asking. Turning it on also turns on screen tracking,
  because a coordinate without a screen name says nothing.

  A touch that turns into a drag is not recorded. A scroll and a tap look
  identical at the moment a finger lands, and a recorded scroll would look
  exactly like a tap that led nowhere — which is the one signal this exists to
  find.

- **`tapSampleRate`** limits how many sessions record taps. Rolled once per
  session, never per touch: a tap with no event after it means a broken button,
  so dropping the follow-up event would report one that works perfectly.

- **`Bananalytics.recordTouchStart` / `recordTouchMove`** for views the root
  component cannot see. React Native renders a Modal into its own host view, so
  touches inside one may not reach the app root.

### Changed

- **`$screen_leave` is now sent on every screen change**, carrying `dwell_ms`.
  This happens whenever you call `screen()`, with or without `trackTaps` — so
  expect one extra event per screen change. It is sent rather than derived from
  the gaps between `$screen` events because the last screen of a session has no
  successor to measure against, and that is often the screen somebody gave up
  on. Backgrounding the app ends the count, so a phone in a pocket overnight
  does not report a fourteen hour dwell.

### Fixed

- A circular import between the package entry point and the root component. It
  resolved correctly under CommonJS because the reference was only read inside
  an event handler — but it resolved by luck, and Metro is not Node.

## 0.2.0

A bug-fix release, but the minor version moves because two of the fixes change
what the SDK sends. Upgrading is strongly recommended: 0.1.x can lose events.

### Fixed

- **A long offline queue was discarded instead of sent.** `flush()` put the
  whole queue in one request. The queue holds up to 1000 events by default and
  the server accepts 500, rejecting anything larger with a `400` — which is
  treated as non-retryable and dropped. A device offline long enough to queue
  more than 500 events lost all of them on reconnect, silently, and could not
  recover: the persisted queue reloaded on restart and failed the same way.
  Events are now sent in chunks of 500, oldest first and sequentially, so their
  order survives. A failing chunk re-queues from itself onward.

- **Events the server rejected were reported as success.** A `200` does not mean
  every event was stored — each one is validated and the rest are named in the
  response body. That body was discarded, so an app could lose part of one event
  type to a malformed name with nothing anywhere saying so. Rejections are now
  logged with the server's reason.

- **No event was recorded when the app cold-started.** Lifecycle tracking only
  ever saw `AppState` transitions, which a fresh launch does not produce — so
  the first event of a launch was whatever the person happened to tap, and the
  top of every funnel was short by everyone who opened the app and left.

- **The SDK sent a request to Google on every flush.** Without
  `@react-native-community/netinfo` installed, the connectivity check fetched a
  Google endpoint — and returned "online" whether that succeeded or failed, so
  it decided nothing. Removed; a failed send was already handled by the retry
  and the queue.

### Changed

- `$app_opened` is emitted once per launch when `trackAppLifecycle` is on. If
  you count events per session, expect one more.
- `optOut()` now discards anything still queued, in memory and on disk. It
  previously only stopped new collection, so already-collected events went out
  on the next flush — which is exactly the data somebody opting out means.

## 0.1.1

- Initial published release.
