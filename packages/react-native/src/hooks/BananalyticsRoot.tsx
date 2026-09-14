import React from 'react';
import { Bananalytics } from '../index';

interface Props {
  children: React.ReactNode;
}

/**
 * Wrap your app in this to record where people tap.
 *
 * ```tsx
 * // app/_layout.tsx (Expo Router)
 * <BananalyticsRoot>
 *   <Stack />
 * </BananalyticsRoot>
 * ```
 *
 * React Native decides who handles a touch by walking the view tree from the
 * root down, asking each view whether it wants it, before walking back up. This
 * component sits at the root and always answers no — so it sees every touch
 * first and then lets it continue, untouched, to whatever was actually tapped.
 *
 * Doing nothing at all unless `trackTaps` is on, which it is not by default.
 * Safe to leave in place either way.
 *
 * Known gap: React Native renders a Modal into its own host view, so touches
 * inside one may never reach this root. Verified only on a device, not in tests.
 */
export function BananalyticsRoot({ children }: Props) {
  // Required at runtime rather than imported, so this file stays usable in a
  // plain Node test environment the way the rest of the SDK does.
  let View: React.ComponentType<Record<string, unknown>>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- Runtime require for RN module
    View = require('react-native').View;
  } catch {
    return <>{children}</>;
  }

  return React.createElement(
    View,
    {
      style: { flex: 1 },
      // Returning false is the point: "I saw it, I do not want it."
      onStartShouldSetResponderCapture: (event: {
        nativeEvent: { pageX: number; pageY: number };
      }) => {
        Bananalytics.__recordTouchStart(
          event.nativeEvent.pageX,
          event.nativeEvent.pageY,
        );
        return false;
      },
      onMoveShouldSetResponderCapture: () => {
        Bananalytics.__recordTouchMove();
        return false;
      },
    },
    children,
  );
}
