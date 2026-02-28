"use client";

import { useState } from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Plus, Copy, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RubricBuilder } from "@/components/rubric-builder";
import { BUILT_IN_RUBRICS } from "@/lib/rubric-templates";
import { useStore } from "@/lib/store";
import type { Rubric } from "@/lib/types";

export default function RubricsPage() {
  const { customRubrics, addRubric, updateRubric, deleteRubric } = useStore();

  // Currently editing rubric
  const [editingId, setEditingId] = useState<string | null>(
    customRubrics[0]?.id ?? null
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<Rubric["criteria"]>([]);

  function loadRubric(rubric: Rubric) {
    setEditingId(rubric.id);
    setName(rubric.name);
    setDescription(rubric.description);
    setCriteria(rubric.criteria.map((c) => ({ ...c })));
  }

  function handleNew() {
    const newRubric: Rubric = {
      id: nanoid(),
      name: "New Rubric",
      description: "",
      criteria: [],
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    addRubric(newRubric);
    loadRubric(newRubric);
    toast.success("New rubric created.");
  }

  function handleClone(rubric: Rubric) {
    const cloned: Rubric = {
      ...rubric,
      id: nanoid(),
      name: `${rubric.name} (Copy)`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      criteria: rubric.criteria.map((c) => ({ ...c, id: nanoid() })),
    };
    addRubric(cloned);
    loadRubric(cloned);
    toast.success(`Cloned "${rubric.name}".`);
  }

  function handleSave() {
    if (!editingId) return;
    if (!name.trim()) {
      toast.error("Rubric name is required.");
      return;
    }
    if (criteria.length === 0) {
      toast.error("Add at least one criterion.");
      return;
    }

    // Normalize weights
    const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
    const normalizedCriteria =
      Math.abs(totalWeight - 1) > 0.01
        ? criteria.map((c) => ({ ...c, weight: c.weight / totalWeight }))
        : criteria;

    updateRubric(editingId, {
      name: name.trim(),
      description: description.trim(),
      criteria: normalizedCriteria,
    });
    toast.success("Rubric saved.");
  }

  function handleDelete(id: string) {
    deleteRubric(id);
    toast.success("Rubric deleted.");
    // If we deleted the one being edited, clear editor
    if (editingId === id) {
      setEditingId(null);
      setName("");
      setDescription("");
      setCriteria([]);
    }
  }

  const editing = customRubrics.find((r) => r.id === editingId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rubric Builder</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage custom evaluation rubrics with weighted criteria.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: rubric list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">My Rubrics</h2>
            <Button size="sm" onClick={handleNew} className="gap-1">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          {customRubrics.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No custom rubrics yet. Click New to create one.
            </p>
          )}

          {customRubrics.map((rubric) => (
            <Card
              key={rubric.id}
              className={`cursor-pointer transition-colors ${
                editingId === rubric.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => loadRubric(rubric)}
            >
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">{rubric.name}</CardTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClone(rubric);
                      }}
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="Clone"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(rubric.id);
                      }}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <Badge variant="outline" className="text-xs">
                  {rubric.criteria.length} criteria
                </Badge>
              </CardContent>
            </Card>
          ))}

          <Separator />

          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
              Built-in Rubrics
            </h2>
            {BUILT_IN_RUBRICS.map((rubric) => (
              <Card key={rubric.id} className="mb-2">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        {rubric.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5 line-clamp-2">
                        {rubric.description}
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => handleClone(rubric)}
                      className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
                      title="Clone to edit"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <Badge variant="outline" className="text-xs">
                    {rubric.criteria.length} criteria
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: editor */}
        <div className="lg:col-span-2">
          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit Rubric</CardTitle>
                <CardDescription>
                  Drag criteria to reorder. Weights should sum to 100%.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Rubric Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Code Review"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this rubric evaluate?"
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Criteria</Label>
                  <RubricBuilder criteria={criteria} onChange={setCriteria} />
                </div>

                <Button onClick={handleSave} className="w-full">
                  Save Rubric
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardContent className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center text-muted-foreground space-y-2">
                  <div className="text-4xl">📋</div>
                  <p className="font-medium">Select or create a rubric to edit</p>
                  <p className="text-sm">
                    Custom rubrics let you tailor the evaluation criteria to your
                    specific needs.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleNew}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create New Rubric
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
