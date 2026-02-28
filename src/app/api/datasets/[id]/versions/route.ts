import { NextRequest, NextResponse } from "next/server";
import { getServerMemory } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const includeItems = req.nextUrl.searchParams.get("includeItems") === "1";
  const memory = getServerMemory();
  const dataset = memory.datasets.find((d) => d.id === id);

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const versions = (memory.datasetVersions[id] ?? [])
    .map((version) => ({
      id: version.id,
      datasetId: version.datasetId,
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      format: version.format,
      hash: version.hash,
      itemCount: version.itemCount,
      slices: version.slices,
      items: includeItems ? version.items : undefined,
    }))
    .sort((a, b) => b.versionNumber - a.versionNumber);

  return NextResponse.json(
    {
      dataset: {
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        latestVersionId: dataset.latestVersionId,
      },
      versions,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
