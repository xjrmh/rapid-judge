import { NextResponse } from "next/server";
import { getServerMemory } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

export async function GET() {
  const memory = getServerMemory();
  const runs = [...memory.experimentRuns].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return NextResponse.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
