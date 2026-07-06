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
import { Icon } from "@/components/ui";
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
      {/* Тъч цели ≥44px: drag дръжка и иконните действия са h-11/w-11 на
          мобилно, свиват се на десктоп (по-плътен ред при мишка). */}
      <button
        type="button"
        aria-label="Премести секцията"
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-ink-500 active:cursor-grabbing sm:size-8"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip-vertical" size={18} />
      </button>
      <Icon name={def.icon} size={18} className="hidden shrink-0 text-ink-500 sm:block" />
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink-900 hover:text-brand-600"
      >
        {def.label}
      </button>
      <button
        type="button"
        aria-label={section.enabled ? "Скрий секцията" : "Покажи секцията"}
        title={section.enabled ? "Скрий" : "Покажи"}
        onClick={onToggle}
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-700 transition-colors hover:bg-surface-100 sm:size-9"
      >
        <Icon name={section.enabled ? "eye" : "eye-off"} size={16} />
      </button>
      <button
        type="button"
        aria-label="Редактирай"
        onClick={onEdit}
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-700 transition-colors hover:bg-surface-100 sm:size-9"
      >
        <Icon name="pencil" size={16} />
      </button>
      <button
        type="button"
        aria-label="Премахни"
        onClick={onRemove}
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-700 transition-colors hover:bg-surface-100 sm:size-9"
      >
        <Icon name="x" size={16} />
      </button>
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
