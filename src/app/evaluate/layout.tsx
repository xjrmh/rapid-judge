import type { ReactNode } from "react";
import { EvaluateSubnav } from "@/components/evaluate-subnav";

export default function EvaluateLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <EvaluateSubnav />
      {children}
    </div>
  );
}
