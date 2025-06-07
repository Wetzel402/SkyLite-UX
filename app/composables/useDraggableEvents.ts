import type { CalendarEvent } from "~/utils/calendarTypes";

export function useDraggableEvents() {
  const draggedEvent = ref<CalendarEvent | null>(null);
  const isDragging = ref(false);

  function handleDragStart(event: CalendarEvent) {
    draggedEvent.value = event;
    isDragging.value = true;
  }

  function handleDragEnd() {
    draggedEvent.value = null;
    isDragging.value = false;
  }

  function handleDrop(targetDate: Date, targetTime?: number) {
    if (!draggedEvent.value)
      return;

    const newEvent = { ...draggedEvent.value };
    const newStart = new Date(targetDate);

    if (targetTime !== undefined) {
      // For week/day views where we have a specific time
      newStart.setHours(Math.floor(targetTime));
      newStart.setMinutes(Math.round((targetTime - Math.floor(targetTime)) * 60));
    }

    const duration = new Date(draggedEvent.value.end).getTime() - new Date(draggedEvent.value.start).getTime();
    const newEnd = new Date(newStart.getTime() + duration);

    newEvent.start = newStart;
    newEvent.end = newEnd;

    handleDragEnd();
    return newEvent;
  }

  return {
    draggedEvent,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDrop,
  };
}
