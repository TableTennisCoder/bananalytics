"use client";

import { useEffect } from "react";
import { setDemoMode } from "@/lib/demo-mode";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  // Set synchronously before first render of children
  setDemoMode(true);

  useEffect(() => {
    return () => setDemoMode(false);
  }, []);

  return <>{children}</>;
}
