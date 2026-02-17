import type { CalendarEvent } from "~/types/calendar";

import prisma from "~/lib/prisma";

type ShiftsSettings = {
  eventColor?: string;
  user?: string[];
  useUserColors?: boolean;
};

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match)
    return 0;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  return hours * 60 + minutes;
}

function slotTimesToUtc(
  utcDate: Date,
  startTime: string,
  endTime: string,
): { start: Date; end: Date; allDay: boolean } {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const allDay = startMin === 0 && endMin === 24 * 60;
  const y = utcDate.getUTCFullYear();
  const m = utcDate.getUTCMonth();
  const d = utcDate.getUTCDate();
  if (allDay) {
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    return { start, end, allDay: true };
  }
  const start = new Date(Date.UTC(y, m, d, Math.floor(startMin / 60), startMin % 60, 0, 0));
  const end = new Date(Date.UTC(y, m, d, Math.floor(endMin / 60), endMin % 60, 0, 0));
  return { start, end, allDay: false };
}

export async function expandShiftsToEvents(
  integrationId: string,
  settings: ShiftsSettings | null,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const rotations = await prisma.shiftRotation.findMany({
    where: { integrationId },
    include: {
      slots: { orderBy: { order: "asc" } },
      assignments: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true, color: true },
          },
        },
      },
    },
    orderBy: { order: "asc" },
  });

  const eventColor = settings?.eventColor ?? "#06b6d4";
  const userIds = settings?.user;
  const useUserColors = settings?.useUserColors ?? false;

  const events: CalendarEvent[] = [];
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (const rotation of rotations) {
    const { cycleWeeks } = rotation;
    for (const assignment of rotation.assignments) {
      const assignmentStart = new Date(assignment.startDate).getTime();
      const assignmentEnd = assignment.endDate
        ? new Date(assignment.endDate).getTime()
        : Number.POSITIVE_INFINITY;

      for (let t = startDate.getTime(); t <= endDate.getTime(); t += oneDayMs) {
        const d = new Date(t);
        if (t < assignmentStart || t > assignmentEnd)
          continue;

        const weeksSinceStart = Math.floor((t - assignmentStart) / (7 * oneDayMs));
        const weekIndex = ((weeksSinceStart % cycleWeeks) + cycleWeeks) % cycleWeeks;
        const dayOfWeek = d.getUTCDay();

        const slotsForDay = rotation.slots.filter(
          s => s.weekIndex === weekIndex && s.dayOfWeek === dayOfWeek,
        );

        for (const slot of slotsForDay) {
          const { start, end, allDay } = slotTimesToUtc(
            d,
            slot.startTime,
            slot.endTime,
          );
          const title = slot.label?.trim() || rotation.name;
          const user = assignment.user;
          const users = useUserColors && user
            ? [{ id: user.id, name: user.name, avatar: user.avatar, color: user.color }]
            : undefined;
          const color = useUserColors && user?.color
            ? user.color
            : (rotation.color ?? eventColor);

          events.push({
            id: `shift-${assignment.id}-${slot.id}-${d.getTime()}`,
            title,
            start,
            end,
            allDay,
            color: color ?? eventColor,
            integrationId,
            users,
          });
        }
      }
    }
  }

  if (userIds?.length && !useUserColors) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true, color: true },
    });
    for (const ev of events) {
      ev.users = users.map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        color: u.color,
      }));
    }
  }

  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
