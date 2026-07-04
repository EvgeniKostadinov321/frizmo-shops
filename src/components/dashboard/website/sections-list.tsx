"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Icon } from "@/components/ui";
import { SECTION_DEFS } from "@/lib/sections";
import type { Section } from "@/schemas/site-settings";

interface SectionsListProps {
  sections: Section[];
  onChange: (sections: Section[]) => void;
  onEdit: (section: Section) => void;
  onRemove: (id: string) => void;
}

function SortableRow({
  section,
  onEdit,
  onRemove,
  onToggle,
}: {
  section: Section;
  onEdit: () => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const def = SECTION_DEFS[section.type];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-control border border-surface-200 bg-surface-0 px-2 py-1.5 ${
        isDragging ? "z-10 shadow-lg" : ""
      } ${section.enabled ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        aria-label="Премести секцията"
        className="cursor-grab touch-none px-1 text-ink-500 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip-vertical" size={18} />
      </button>
      <Icon name={def.icon} size={18} className="shrink-0 text-ink-500" />
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink-900 hover:text-brand-600"
      >
        {def.label}
      </button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={section.enabled ? "Скрий секцията" : "Покажи секцията"}
        title={section.enabled ? "Скрий" : "Покажи"}
        onClick={onToggle}
      >
        <Icon name={section.enabled ? "eye" : "eye-off"} size={16} />
      </Button>
      <Button variant="ghost" size="sm" aria-label="Редактирай" onClick={onEdit}>
        <Icon name="pencil" size={16} />
      </Button>
      <Button variant="ghost" size="sm" aria-label="Премахни" onClick={onRemove}>
        <Icon name="x" size={16} />
      </Button>
    </div>
  );
}

export function SectionsList({ sections, onChange, onEdit, onRemove }: SectionsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    onChange(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {sections.map((section) => (
            <SortableRow
              key={section.id}
              section={section}
              onEdit={() => onEdit(section)}
              onRemove={() => onRemove(section.id)}
              onToggle={() =>
                onChange(
                  sections.map((s) =>
                    s.id === section.id ? { ...s, enabled: !s.enabled } : s,
                  ),
                )
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
