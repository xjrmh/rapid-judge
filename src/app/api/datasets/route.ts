import { NextResponse } from "next/server";
import { getServerMemory } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

export async function GET() {
  const memory = getServerMemory();

  const datasets = memory.datasets
    .map((dataset) => {
      const versions = memory.datasetVersions[dataset.id] ?? [];
      const latestVersion = versions[versions.length - 1];
      return {
        ...dataset,
        latestVersion: latestVersion
          ? {
              id: latestVersion.id,
              versionNumber: latestVersion.versionNumber,
              itemCount: latestVersion.itemCount,
              createdAt: latestVersion.createdAt,
              format: latestVersion.format,
              hash: latestVersion.hash,
            }
          : undefined,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ datasets }, { headers: { "Cache-Control": "no-store" } });
}
