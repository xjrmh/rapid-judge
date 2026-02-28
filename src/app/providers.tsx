"use client";

export function Providers({ children }: { children: React.ReactNode }) {
  // Prevent SSR hydration mismatch with localStorage-backed Zustand store
  if (typeof window === "undefined") return null;

  return <>{children}</>;
}
