import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import type { Dataset, DatasetItem, DatasetSlice, DatasetVersion } from "@/lib/types";
import { getServerMemory, hashString, slugify } from "@/lib/server-memory";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  format: z.enum(["csv", "jsonl"]),
  content: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
});

const RESERVED_KEYS = new Set([
  "prompt",
  "response",
  "responseA",
  "responseB",
  "response_a",
  "response_b",
  "context",
  "mode",
  "tags",
  "gold_score",
  "gold_verdict",
]);

function getString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const s = String(value).trim();
    if (s.length > 0) return s;
  }
  return "";
}

function parseRows(
  format: "csv" | "jsonl",
  content: string
): { rows: Record<string, unknown>[]; issues: string[] } {
  if (format === "jsonl") {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const rows: Record<string, unknown>[] = [];
    const issues: string[] = [];

    lines.forEach((line, idx) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          issues.push(`Line ${idx + 1}: JSON object required.`);
          return;
        }
        rows.push(parsed as Record<string, unknown>);
      } catch {
        issues.push(`Line ${idx + 1}: invalid JSON.`);
      }
    });

    return { rows, issues };
  }

  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  const issues = parsed.errors.map((err) => {
    const row = typeof err.row === "number" ? err.row + 1 : "unknown";
    return `Row ${row}: ${err.message}`;
  });

  return { rows: parsed.data, issues };
}

function extractSlices(items: DatasetItem[]): DatasetSlice[] {
  const sliceCounts = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.tags) {
      if (!tag.includes(":")) continue;
      const [label, value] = tag.split(":");
      const key = `${label}:${value}`;
      sliceCounts.set(key, (sliceCounts.get(key) ?? 0) + 1);
    }
  }

  return [...sliceCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([entry, itemCount]) => {
      const [label, value] = entry.split(":");
      return {
        id: entry,
        label,
        value,
        itemCount,
      };
    });
}

function parseDatasetItems(
  rows: Record<string, unknown>[]
): { items: DatasetItem[]; issues: string[] } {
  const issues: string[] = [];
  const items: DatasetItem[] = [];

  rows.forEach((row, index) => {
    const prompt = getString(row, "prompt");
    const response = getString(row, "response");
    const responseA = getString(row, "responseA", "response_a");
    const responseB = getString(row, "responseB", "response_b");
    const context = getString(row, "context") || undefined;
    const explicitMode = getString(row, "mode").toLowerCase();

    if (!prompt) {
      issues.push(`Row ${index + 1}: missing required "prompt".`);
      return;
    }

    let mode: "single" | "pairwise" = "single";
    if (explicitMode === "single" || explicitMode === "pairwise") {
      mode = explicitMode;
    } else if (responseA || responseB) {
      mode = "pairwise";
    } else {
      mode = "single";
    }

    if (mode === "single" && !response) {
      issues.push(`Row ${index + 1}: single mode requires "response".`);
      return;
    }
    if (mode === "pairwise" && (!responseA || !responseB)) {
      issues.push(
        `Row ${index + 1}: pairwise mode requires both "responseA" and "responseB".`
      );
      return;
    }

    const tags = new Set<string>();
    const inlineTags = getString(row, "tags");
    if (inlineTags) {
      inlineTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tags.add(t));
    }

    ["task_type", "difficulty", "language", "safety", "domain"].forEach((key) => {
      const value = getString(row, key);
      if (value) tags.add(`${key}:${value}`);
    });

    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (RESERVED_KEYS.has(key)) continue;
      if (value === null || value === undefined) continue;
      const s = String(value).trim();
      if (!s) continue;
      metadata[key] = s;
    }

    const goldScoreRaw = getString(row, "gold_score");
    const goldScore = goldScoreRaw ? Number(goldScoreRaw) : undefined;
    const goldVerdictRaw = getString(row, "gold_verdict").toLowerCase();
    const goldVerdict =
      goldVerdictRaw === "a"
        ? "A"
        : goldVerdictRaw === "b"
          ? "B"
          : goldVerdictRaw === "tie"
            ? "tie"
            : undefined;

    items.push({
      id: `item-${index + 1}-${hashString(`${prompt}-${index}`).slice(0, 6)}`,
      mode,
      prompt,
      response: mode === "single" ? response : undefined,
      responseA: mode === "pairwise" ? responseA : undefined,
      responseB: mode === "pairwise" ? responseB : undefined,
      context,
      tags: [...tags],
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      goldScore: Number.isFinite(goldScore) ? goldScore : undefined,
      goldVerdict,
    });
  });

  return { items, issues };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid dataset import request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, format, content, tags = [] } = parsed.data;
    const { rows, issues: parseIssues } = parseRows(format, content);
    const { items, issues: validationIssues } = parseDatasetItems(rows);
    const allIssues = [...parseIssues, ...validationIssues];

    if (items.length === 0) {
      return NextResponse.json(
        {
          error: "Dataset import failed validation",
          issues: allIssues.length > 0 ? allIssues : ["No valid rows found."],
        },
        { status: 400 }
      );
    }

    if (allIssues.length > 0) {
      return NextResponse.json(
        {
          error: "Dataset import failed validation",
          issues: allIssues,
        },
        { status: 400 }
      );
    }

    const memory = getServerMemory();
    const now = new Date().toISOString();
    const existing = memory.datasets.find(
      (dataset) => dataset.name.toLowerCase() === name.trim().toLowerCase()
    );

    const datasetId =
      existing?.id ??
      `${slugify(name)}-${hashString(`${name}-${now}`).slice(0, 6)}`;
    const versions = memory.datasetVersions[datasetId] ?? [];
    const versionNumber = versions.length + 1;
    const versionId = `${datasetId}-v${versionNumber}`;
    const mergedTags = new Set<string>([...tags.map((t) => t.trim()), ...items.flatMap((item) => item.tags)]);

    const version: DatasetVersion = {
      id: versionId,
      datasetId,
      versionNumber,
      createdAt: now,
      format,
      hash: hashString(`${content}:${items.length}:${format}`),
      itemCount: items.length,
      items,
      slices: extractSlices(items),
    };

    memory.datasetVersions[datasetId] = [...versions, version];

    const dataset: Dataset = existing
      ? {
          ...existing,
          description: description ?? existing.description,
          updatedAt: now,
          latestVersionId: version.id,
          totalVersions: versionNumber,
          tags: [...mergedTags].filter(Boolean).sort(),
        }
      : {
          id: datasetId,
          name: name.trim(),
          description: description?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
          latestVersionId: version.id,
          totalVersions: 1,
          tags: [...mergedTags].filter(Boolean).sort(),
        };

    memory.datasets = [
      dataset,
      ...memory.datasets.filter((d) => d.id !== dataset.id),
    ];

    return NextResponse.json({
      dataset,
      version,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
