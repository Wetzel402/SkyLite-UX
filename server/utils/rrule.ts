import consola from "consola";
import ical from "ical.js";

import type { ICalEvent } from "../integrations/iCal/types";

export function parseRRuleString(rruleString: string): ICalEvent["rrule"] | undefined {
  if (!rruleString) {
    return undefined;
  }

  const cleanRRule = rruleString.replace(/^RRULE:/i, "").trim();

  if (!cleanRRule) {
    return undefined;
  }

  const parts = cleanRRule.split(";");
  const rruleObj: ICalEvent["rrule"] = {
    freq: "",
  };

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) {
      continue;
    }

    const upperKey = key.toUpperCase();

    switch (upperKey) {
      case "FREQ":
        rruleObj.freq = value.toUpperCase();
        break;

      case "INTERVAL":
        rruleObj.interval = Number.parseInt(value, 10);
        break;

      case "BYDAY":
        rruleObj.byday = value.split(",").map(day => day.toUpperCase());
        break;

      case "BYMONTH":
        rruleObj.bymonth = value.split(",").map(month => Number.parseInt(month, 10));
        break;

      case "COUNT":
        rruleObj.count = Number.parseInt(value, 10);
        break;

      case "UNTIL":
        rruleObj.until = value;
        break;
    }
  }

  if (!rruleObj.freq) {
    return undefined;
  }

  return rruleObj;
}

function parseUntilToDate(until: string | undefined): Date | null {
  if (!until) {
    return null;
  }
  try {
    return ical.Time.fromString(until, undefined).toJSDate();
  }
  catch {
    return null;
  }
}

export function expandRecurringEvents<T extends {
  id: string;
  start: Date;
  end: Date;
  ical_event?: ICalEvent;
}>(events: T[], startDate: Date, endDate: Date): T[] {
  const expandedEvents: T[] = [];

  for (const event of events) {
    if (!event.ical_event?.rrule) {
      expandedEvents.push(event);
      continue;
    }

    try {
      const vevent = new ical.Component(["vevent", [], []]);
      vevent.addPropertyWithValue("uid", event.ical_event.uid);
      vevent.addPropertyWithValue("summary", event.ical_event.summary);
      vevent.addPropertyWithValue("description", event.ical_event.description);
      vevent.addPropertyWithValue("location", event.ical_event.location);

      const dtstart = ical.Time.fromJSDate(new Date(event.start), true);
      vevent.addPropertyWithValue("dtstart", dtstart);
      const dtend = ical.Time.fromJSDate(new Date(event.end), true);
      vevent.addPropertyWithValue("dtend", dtend);

      const rrule = new ical.Property("rrule", vevent);
      rrule.setValue(event.ical_event.rrule);
      vevent.addProperty(rrule);

      const expansion = new ical.RecurExpansion({
        component: vevent,
        dtstart,
      });

      let count = 0;
      const maxInstances = 1000;

      while (count < maxInstances) {
        const currentTime = expansion.next();

        if (!currentTime) {
          break;
        }

        const currentDate = currentTime.toJSDate();

        if (currentDate > endDate) {
          break;
        }

        if (currentDate >= startDate) {
          const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
          const newEnd = new Date(currentDate.getTime() + duration);

          expandedEvents.push({
            ...event,
            id: `${event.id}-${currentTime.toICALString()}`,
            start: currentDate,
            end: newEnd,
            ical_event: {
              ...event.ical_event,
              dtstart: ical.Time.fromJSDate(currentDate, true).toString(),
              dtend: ical.Time.fromJSDate(newEnd, true).toString(),
            },
          });
        }
        count++;
      }
    }
    catch (error) {
      consola.warn("Failed to expand recurring event:", error);
      expandedEvents.push(event);
    }
  }

  return expandedEvents;
}

function advancePastDate(
  startDate: Date,
  dateToPass: Date,
  intervalDays: number,
): Date {
  if (intervalDays <= 0) {
    throw new Error("intervalDays must be positive");
  }
  let nextDate = new Date(startDate);

  while (nextDate <= dateToPass) {
    nextDate = new Date(nextDate);
    nextDate.setDate(nextDate.getDate() + intervalDays);
  }

  return nextDate;
}

function calculateFastPathApproximate(
  rrule: ICalEvent["rrule"],
  previousDueDate: Date | null,
  referenceDate: Date | null,
): Date {
  if (!rrule || !rrule.freq) {
    throw new Error("Invalid rrule: freq is required");
  }

  const untilDate = parseUntilToDate(rrule.until ?? undefined);
  const capAtUntil = (d: Date): Date => {
    if (untilDate && d > untilDate) {
      return untilDate;
    }
    return d;
  };

  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const baseDate = previousDueDate
    ? new Date(previousDueDate)
    : new Date(today);
  baseDate.setHours(0, 0, 0, 0);

  const freq = rrule.freq.toUpperCase();
  const interval = rrule.interval || 1;

  if (freq === "DAILY") {
    if (previousDueDate) {
      const comparePoint = new Date(
        Math.max(baseDate.getTime(), today.getTime()),
      );
      return capAtUntil(advancePastDate(baseDate, comparePoint, interval));
    }
    return capAtUntil(advancePastDate(today, today, interval));
  }

  if (freq === "WEEKLY") {
    if (!rrule.byday || rrule.byday.length === 0) {
      if (previousDueDate) {
        const comparePoint = new Date(
          Math.max(baseDate.getTime(), today.getTime()),
        );
        return advancePastDate(baseDate, comparePoint, interval * 7);
      }
      return advancePastDate(today, today, interval * 7);
    }

    const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const daysOfWeek = rrule.byday
      .map((day) => {
        const dayStr = day.replace(/^[+-]?\d+/, "");
        return dayNames.indexOf(dayStr);
      })
      .filter(day => day !== -1)
      .sort((a, b) => a - b);

    if (daysOfWeek.length === 0) {
      if (previousDueDate) {
        const comparePoint = new Date(
          Math.max(baseDate.getTime(), today.getTime()),
        );
        return advancePastDate(baseDate, comparePoint, interval * 7);
      }
      return advancePastDate(today, today, interval * 7);
    }

    const latestSelectedDay = daysOfWeek[daysOfWeek.length - 1] ?? 0;
    const setDay = (input: Date, dayOfWeek: number): Date => {
      const newDate = new Date(input);
      const currentDay = input.getDay();
      const diff = dayOfWeek - currentDay;
      newDate.setDate(newDate.getDate() + diff);
      return newDate;
    };

    const endOfCurrentWeek = setDay(today, latestSelectedDay);
    const startOfCurrentWeek = setDay(today, 0);

    const canUseCurrentWeek
      = baseDate.getDay() !== 6
        && today.getDay() <= latestSelectedDay
        && baseDate.getDay() < latestSelectedDay
        && baseDate >= startOfCurrentWeek
        && baseDate < endOfCurrentWeek;

    let nextDate = new Date(baseDate);

    if (canUseCurrentWeek) {
      nextDate.setDate(nextDate.getDate() + 1);
      nextDate = new Date(Math.max(nextDate.getTime(), today.getTime()));
    }
    else {
      nextDate = setDay(nextDate, 0);
      nextDate.setDate(nextDate.getDate() + interval * 7);
      let currentDate = new Date(nextDate);
      while (currentDate < today) {
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + interval * 7);
      }
      nextDate = currentDate;
    }

    let currentDate = new Date(nextDate);
    while (!daysOfWeek.includes(currentDate.getDay())) {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    nextDate = currentDate;

    return nextDate;
  }

  if (freq === "MONTHLY") {
    let nextDate = new Date(baseDate);
    const bymonthday = rrule.bymonthday?.[0];
    const targetDay = bymonthday || nextDate.getDate();

    const addMonths = (date: Date, months: number): Date => {
      const newDate = new Date(date);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + months);
      const maxDay = new Date(
        newDate.getFullYear(),
        newDate.getMonth() + 1,
        0,
      ).getDate();
      newDate.setDate(Math.min(targetDay, maxDay));
      return newDate;
    };

    nextDate = addMonths(nextDate, interval);

    let currentDate = new Date(nextDate);
    while (currentDate < today) {
      currentDate = addMonths(currentDate, interval);
    }
    nextDate = currentDate;

    return capAtUntil(nextDate);
  }

  if (freq === "YEARLY") {
    let nextDate = new Date(baseDate);
    nextDate.setFullYear(nextDate.getFullYear() + interval);
    while (nextDate < today) {
      nextDate = new Date(nextDate);
      nextDate.setFullYear(nextDate.getFullYear() + interval);
    }
    return capAtUntil(nextDate);
  }

  return capAtUntil(today);
}

export function calculateNextDueDate(
  rrule: ICalEvent["rrule"],
  originalDTSTART: Date,
  previousDueDate: Date | null = null,
  referenceDate: Date | null = null,
): Date | null {
  if (!rrule || !rrule.freq) {
    throw new Error("Invalid rrule: freq is required");
  }

  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const comparePoint = previousDueDate
    ? new Date(Math.max(previousDueDate.getTime(), today.getTime()))
    : today;
  comparePoint.setHours(0, 0, 0, 0);

  const fastPathApproximate = calculateFastPathApproximate(
    rrule,
    previousDueDate,
    referenceDate,
  );

  try {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "temp");
    vevent.addPropertyWithValue("summary", "temp");

    const dtstart = ical.Time.fromJSDate(originalDTSTART, true);
    vevent.addPropertyWithValue("dtstart", dtstart);

    const rruleProperty = new ical.Property("rrule", vevent);
    rruleProperty.setValue(rrule);
    vevent.addProperty(rruleProperty);

    const expansion = new ical.RecurExpansion({
      component: vevent,
      dtstart,
    });

    let currentTime = expansion.next();
    let iterations = 0;
    const maxIterations = 100;
    let lastValidDate: Date | null = null;

    while (currentTime && iterations < maxIterations) {
      const currentDate = currentTime.toJSDate();
      currentDate.setHours(0, 0, 0, 0);

      if (currentDate >= fastPathApproximate) {
        if (currentDate > comparePoint) {
          currentDate.setHours(23, 59, 59, 999);
          return currentDate;
        }
        lastValidDate = new Date(currentDate);
      }

      currentTime = expansion.next();
      iterations++;
    }

    if (iterations >= maxIterations) {
      consola.warn("calculateNextDueDate: Hit iteration limit, using fallback", {
        rrule,
        originalDTSTART: originalDTSTART.toISOString(),
        previousDueDate: previousDueDate?.toISOString() || null,
        approximateDate: fastPathApproximate.toISOString(),
        iterations,
      });
    }

    if (lastValidDate && lastValidDate > comparePoint) {
      lastValidDate.setHours(23, 59, 59, 999);
      return lastValidDate;
    }

    if (iterations >= maxIterations) {
      const untilDate = parseUntilToDate(rrule.until ?? undefined);
      if (untilDate && fastPathApproximate > untilDate) {
        return null;
      }
      fastPathApproximate.setHours(0, 0, 0, 0);
      comparePoint.setHours(0, 0, 0, 0);
      if (fastPathApproximate < comparePoint) {
        return null;
      }
      fastPathApproximate.setHours(23, 59, 59, 999);
      return fastPathApproximate;
    }

    return null;
  }
  catch (error) {
    consola.warn("calculateNextDueDate: RecurExpansion failed, using fast path", {
      error,
      rrule,
      originalDTSTART: originalDTSTART.toISOString(),
    });
    const untilDate = parseUntilToDate(rrule.until ?? undefined);
    if (untilDate && fastPathApproximate > untilDate) {
      return null;
    }
    fastPathApproximate.setHours(0, 0, 0, 0);
    comparePoint.setHours(0, 0, 0, 0);
    if (fastPathApproximate < comparePoint) {
      return null;
    }
    fastPathApproximate.setHours(23, 59, 59, 999);
    return fastPathApproximate;
  }
}
