"use client";

import { useState, useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent SSR hydration mismatch with localStorage-backed Zustand store
  if (!mounted) return null;

  return <>{children}</>;
}
