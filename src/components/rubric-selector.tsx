"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUILT_IN_RUBRICS } from "@/lib/rubric-templates";
import { useStore } from "@/lib/store";

interface RubricSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function RubricSelector({ value, onValueChange }: RubricSelectorProps) {
  const { customRubrics } = useStore();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select rubric…" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Built-in Rubrics</SelectLabel>
          {BUILT_IN_RUBRICS.map((rubric) => (
            <SelectItem key={rubric.id} value={rubric.id}>
              <span>{rubric.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({rubric.criteria.length} criteria)
              </span>
            </SelectItem>
          ))}
        </SelectGroup>

        {customRubrics.length > 0 && (
          <SelectGroup>
            <SelectLabel>My Rubrics</SelectLabel>
            {customRubrics.map((rubric) => (
              <SelectItem key={rubric.id} value={rubric.id}>
                <span>{rubric.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({rubric.criteria.length} criteria)
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
