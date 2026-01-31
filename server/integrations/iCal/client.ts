import consola from "consola";
import ical from "ical.js";

import type { ICalEvent } from "./types";

// Simple in-memory cache for iCal feeds to avoid rate limiting
// Version in cache key to bust cache when format changes
const CACHE_VERSION = "v4";
const iCalCache = new Map<string, { events: ICalEvent[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export class ICalServerService {
  constructor(private integrationId: string, private url: string) {}

  async fetchEventsFromUrl(url: string): Promise<ICalEvent[]> {
    // Check cache first to avoid rate limiting
    const cacheKey = `${CACHE_VERSION}:${url}`;
    const cached = iCalCache.get(cacheKey);
    const nowTimestamp = Date.now();

    if (cached && (nowTimestamp - cached.timestamp) < CACHE_TTL) {
      consola.debug(`[iCal ${this.integrationId}] Using cached data (${Math.round((nowTimestamp - cached.timestamp) / 1000)}s old)`);
      return cached.events;
    }

    consola.debug(`[iCal ${this.integrationId}] Fetching fresh data from URL`);
    const response = await fetch(url);

    if (!response.ok) {
      // If we have stale cache and get rate limited, return stale data
      if (response.status === 429 && cached) {
        consola.warn(`[iCal ${this.integrationId}] Rate limited (429), using stale cache from ${cacheKey}`);
        return cached.events;
      }

      throw new Error(`Failed to fetch iCal feed: HTTP ${response.status} ${response.statusText}`);
    }

    const icalData = await response.text();

    // Check if response is actually iCal data (not HTML error page)
    if (icalData.trim().startsWith("<!DOCTYPE") || icalData.trim().startsWith("<html")) {
      throw new Error("The URL returned an HTML page instead of an iCal file. Please verify the URL is correct and points to a .ics file (secret calendar URL).");
    }

    if (!icalData.includes("BEGIN:VCALENDAR")) {
      throw new Error("The URL did not return valid iCal data. Please check the URL and ensure it's a secret iCal/ICS calendar feed.");
    }

    const jcalData = ical.parse(icalData);
    const vcalendar = new ical.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents("vevent");

    consola.info(`ICalServerService: Fetched ${vevents.length} events from iCal feed`);

    const events: ICalEvent[] = [];

    const now = new Date();
    // Start from today at midnight UTC (not 1 year ago) to avoid showing past recurring events
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endDate = new Date(Date.UTC(now.getUTCFullYear() + 2, now.getUTCMonth(), now.getUTCDate()));

    consola.debug(`ICalServerService: Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    for (const vevent of vevents) {
      const rrule = vevent.getFirstPropertyValue("rrule");

      if (rrule) {
        const expandedEvents = this.expandRecurringEvent(vevent, startDate, endDate);
        consola.debug(`[iCal ${this.integrationId}] Expanded recurring event into ${expandedEvents.length} instances`);
        events.push(...expandedEvents);
      }
      else {
        // For non-recurring events, include them if they end on or after today
        const parsedEvent = this.parseICalEvent(vevent);
        const dtstart = vevent.getFirstPropertyValue("dtstart") as ical.Time;
        const dtend = vevent.getFirstPropertyValue("dtend") as ical.Time;

        if (dtstart) {
          const eventEndDate = dtend ? dtend.toJSDate() : dtstart.toJSDate();
          // Include event if it ends on or after the start date (today)
          if (eventEndDate >= startDate) {
            events.push(parsedEvent);
          }
        }
        else {
          // If no start date, include it anyway
          events.push(parsedEvent);
        }
      }
    }

    consola.info(`[iCal ${this.integrationId}] Processed ${events.length} total event instances (${vevents.length} source events)`);

    // Cache the results to avoid rate limiting (reuse cacheKey from above)
    iCalCache.set(cacheKey, { events, timestamp: Date.now() });
    consola.debug(`[iCal ${this.integrationId}] Cached ${events.length} events for 5 minutes`);

    return events;
  }

  private parseICalEvent(vevent: ical.Component): ICalEvent {
    const dtstart = vevent.getFirstPropertyValue("dtstart") as ical.Time;
    const dtend = vevent.getFirstPropertyValue("dtend") as ical.Time;

    // Check if this is an all-day event (DATE vs DATETIME)
    const isAllDay = dtstart && dtstart.isDate;

    let startUTC: string;
    let endUTC: string;

    if (isAllDay) {
      // For all-day events, don't convert timezone - use the date as-is
      // All-day events are stored as DATE (e.g., 20250130) not DATETIME
      startUTC = dtstart.toString();
      endUTC = dtend ? dtend.toString() : dtstart.toString();
    }
    else {
      // For timed events, convert to UTC
      startUTC = dtstart
        ? dtstart.convertToZone(ical.TimezoneService.get("UTC")).toString()
        : new Date().toISOString().replace(".000", "");
      endUTC = dtend
        ? dtend.convertToZone(ical.TimezoneService.get("UTC")).toString()
        : new Date().toISOString().replace(".000", "");
    }

    return {
      type: "VEVENT",
      uid: vevent.getFirstPropertyValue("uid") as string || "",
      summary: vevent.getFirstPropertyValue("summary") as string || "",
      description: vevent.getFirstPropertyValue("description") as string || "",
      dtstart: startUTC,
      dtend: endUTC,
      location: vevent.getFirstPropertyValue("location") as string || undefined,
      attendees: vevent.getAllSubcomponents("attendee")?.map((attendee: ical.Component) => ({
        cn: attendee.getFirstPropertyValue("cn") as string || "",
        mailto: attendee.getFirstPropertyValue("email") as string || "",
        role: attendee.getFirstPropertyValue("role") as string || "REQ-PARTICIPANT",
      })) || undefined,
      rrule: vevent.getFirstPropertyValue("rrule")
        ? {
            freq: (vevent.getFirstPropertyValue("rrule") as ical.Recur).freq,
            ...(vevent.getFirstPropertyValue("rrule") as ical.Recur).interval && {
              interval: (vevent.getFirstPropertyValue("rrule") as ical.Recur).interval,
            },
            ...((vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("byday")?.length && {
              byday: (vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("byday") as string[],
            }),
            ...((vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("bymonth")?.length && {
              bymonth: (vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("bymonth") as number[],
            }),
            ...(typeof (vevent.getFirstPropertyValue("rrule") as ical.Recur).count === "number" && {
              count: (vevent.getFirstPropertyValue("rrule") as ical.Recur).count as number,
            }),
            ...(vevent.getFirstPropertyValue("rrule") as ical.Recur).until && {
              until: (vevent.getFirstPropertyValue("rrule") as ical.Recur).until?.toString(),
            },
          }
        : undefined,
    };
  }

  private expandRecurringEvent(vevent: ical.Component, startDate: Date, endDate: Date): ICalEvent[] {
    const events: ICalEvent[] = [];

    try {
      const recurrence = vevent.getFirstPropertyValue("rrule");
      const dtstart = vevent.getFirstPropertyValue("dtstart") as ical.Time;

      if (!recurrence || !dtstart) {
        return [this.parseICalEvent(vevent)];
      }

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
          const eventInstance = this.createRecurringEventInstance(vevent, currentTime);
          if (eventInstance) {
            events.push(eventInstance);
          }
        }
        count++;
      }
    }
    catch (error) {
      // Silently skip malformed recurring events - return single occurrence
      consola.debug(
        "ICalServerService: Skipped recurring event expansion:",
        error instanceof Error ? error.message : String(error),
      );
      return [this.parseICalEvent(vevent)];
    }

    return events;
  }

  private createRecurringEventInstance(vevent: ical.Component, occurrenceTime: ical.Time): ICalEvent | null {
    try {
      const dtstart = vevent.getFirstPropertyValue("dtstart") as ical.Time;
      const dtend = vevent.getFirstPropertyValue("dtend") as ical.Time;

      if (!dtstart) {
        return null;
      }

      const isAllDay = dtstart.isDate;

      let startUTC: string;
      let endUTC: string;

      if (isAllDay) {
        // For all-day recurring events, work directly with ical.Time (DATE format)
        // Don't convert to JS Date and back - this avoids timezone issues

        // Calculate the duration in days
        const originalStartDate = dtstart.toJSDate();
        const originalEndDate = dtend ? dtend.toJSDate() : originalStartDate;
        const durationDays = Math.round((originalEndDate.getTime() - originalStartDate.getTime()) / (1000 * 60 * 60 * 24));

        // Use occurrenceTime as-is for start (it's already a DATE)
        startUTC = occurrenceTime.toString();

        // Calculate end date by adding duration
        const endTime = occurrenceTime.clone();
        endTime.addDuration(new ical.Duration({ days: durationDays || 1 }));
        endUTC = endTime.toString();
      }
      else {
        // For timed recurring events, calculate using JS dates and duration
        const originalStart = dtstart.toJSDate();
        const originalEnd = dtend ? dtend.toJSDate() : originalStart;
        const duration = originalEnd.getTime() - originalStart.getTime();

        const newStart = occurrenceTime.toJSDate();
        const newEnd = new Date(newStart.getTime() + duration);

        // Convert to UTC and format as iCal string
        startUTC = ical.Time.fromJSDate(newStart, false).convertToZone(ical.TimezoneService.get("UTC")).toString();
        endUTC = ical.Time.fromJSDate(newEnd, false).convertToZone(ical.TimezoneService.get("UTC")).toString();
      }

      const eventInstance: ICalEvent = {
        type: "VEVENT",
        uid: `${vevent.getFirstPropertyValue("uid")}-${occurrenceTime.toICALString()}`,
        summary: vevent.getFirstPropertyValue("summary") as string || "",
        description: vevent.getFirstPropertyValue("description") as string || "",
        dtstart: startUTC,
        dtend: endUTC,
        location: vevent.getFirstPropertyValue("location") as string || undefined,
        attendees: vevent.getAllSubcomponents("attendee")?.map((attendee: ical.Component) => ({
          cn: attendee.getFirstPropertyValue("cn") as string || "",
          mailto: attendee.getFirstPropertyValue("email") as string || "",
          role: attendee.getFirstPropertyValue("role") as string || "REQ-PARTICIPANT",
        })) || undefined,
        rrule: vevent.getFirstPropertyValue("rrule")
          ? {
              freq: (vevent.getFirstPropertyValue("rrule") as ical.Recur).freq,
              ...(vevent.getFirstPropertyValue("rrule") as ical.Recur).interval && {
                interval: (vevent.getFirstPropertyValue("rrule") as ical.Recur).interval,
              },
              ...((vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("byday")?.length && {
                byday: (vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("byday") as string[],
              }),
              ...((vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("bymonth")?.length && {
                bymonth: (vevent.getFirstPropertyValue("rrule") as ical.Recur).getComponent("bymonth") as number[],
              }),
              ...(typeof (vevent.getFirstPropertyValue("rrule") as ical.Recur).count === "number" && {
                count: (vevent.getFirstPropertyValue("rrule") as ical.Recur).count as number,
              }),
              ...(vevent.getFirstPropertyValue("rrule") as ical.Recur).until && {
                until: (vevent.getFirstPropertyValue("rrule") as ical.Recur).until?.toString(),
              },
            }
          : undefined,
      };
      return eventInstance;
    }
    catch (error) {
      consola.warn("ICalServerService: Failed to create recurring event instance:", error);
      return null;
    }
  }
}
