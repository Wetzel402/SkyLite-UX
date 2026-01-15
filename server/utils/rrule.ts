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
