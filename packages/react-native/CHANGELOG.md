# Changelog

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
