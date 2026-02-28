import { NextResponse } from "next/server";
import type { Provider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const availability: Record<Provider, boolean> = {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_API_KEY,
  };

  return NextResponse.json(availability, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
