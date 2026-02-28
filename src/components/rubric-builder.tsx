"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RubricCriterion, ScoreRange } from "@/lib/types";

// ── Sortable criterion row ────────────────────────────────────────────────────

function CriterionRow({
  criterion,
  onChange,
  onDelete,
}: {
  criterion: RubricCriterion;
  onChange: (updated: RubricCriterion) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: criterion.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const weightPct = Math.round(criterion.weight * 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-3 rounded-lg border bg-card p-3"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1 flex-shrink-0"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Criterion Name</Label>
            <Input
              value={criterion.name}
              onChange={(e) =>
                onChange({ ...criterion, name: e.target.value })
              }
              placeholder="e.g. Accuracy"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Weight</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={weightPct}
                  onChange={(e) =>
                    onChange({
                      ...criterion,
                      weight: Math.max(1, Math.min(100, Number(e.target.value))) / 100,
                    })
                  }
                  className="h-8 text-sm pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scale</Label>
              <Select
                value={String(criterion.scoreRange)}
                onValueChange={(v) =>
                  onChange({ ...criterion, scoreRange: Number(v) as ScoreRange })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">1 – 5</SelectItem>
                  <SelectItem value="10">1 – 10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={criterion.description}
            onChange={(e) =>
              onChange({ ...criterion, description: e.target.value })
            }
            placeholder="What does this criterion evaluate?"
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      </div>

      <button
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive transition-colors mt-1 flex-shrink-0"
        title="Delete criterion"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Rubric builder ────────────────────────────────────────────────────────────

interface RubricBuilderProps {
  criteria: RubricCriterion[];
  onChange: (criteria: RubricCriterion[]) => void;
}

export function RubricBuilder({ criteria, onChange }: RubricBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = criteria.findIndex((c) => c.id === active.id);
    const newIndex = criteria.findIndex((c) => c.id === over.id);
    onChange(arrayMove(criteria, oldIndex, newIndex));
  }

  function handleChange(id: string, updated: RubricCriterion) {
    onChange(criteria.map((c) => (c.id === id ? updated : c)));
  }

  function handleDelete(id: string) {
    onChange(criteria.filter((c) => c.id !== id));
  }

  function handleAdd() {
    const newCriterion: RubricCriterion = {
      id: nanoid(),
      name: "",
      description: "",
      weight: 0.25,
      scoreRange: 5,
    };
    onChange([...criteria, newCriterion]);
  }

  function normalizeWeights() {
    if (criteria.length === 0) return;
    const total = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (total === 0) return;
    onChange(criteria.map((c) => ({ ...c, weight: c.weight / total })));
  }

  const weightOk = Math.abs(totalWeight - 1.0) < 0.01;

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={criteria.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {criteria.map((c) => (
            <CriterionRow
              key={c.id}
              criterion={c}
              onChange={(updated) => handleChange(c.id, updated)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {criteria.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No criteria yet. Add your first criterion below.
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Criterion
        </Button>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              weightOk ? "text-green-600" : "text-yellow-600"
            }`}
          >
            Total weight: {Math.round(totalWeight * 100)}%
            {!weightOk && " (should be 100%)"}
          </span>
          {!weightOk && criteria.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={normalizeWeights}
              className="text-xs h-6"
            >
              Normalize
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
