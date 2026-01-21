import type { DateValue } from "@internationalized/date";
import type { Ref } from "vue";

import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { consola } from "consola";
import ical from "ical.js";

import type { ICalEvent } from "../../server/integrations/iCal/types";

export type RecurrenceState = {
  isRecurring: Ref<boolean>;
  recurrenceType: Ref<"daily" | "weekly" | "monthly" | "yearly">;
  recurrenceInterval: Ref<number>;
  recurrenceEndType: Ref<"never" | "count" | "until">;
  recurrenceCount: Ref<number>;
  recurrenceUntil: Ref<DateValue>;
  recurrenceDays: Ref<number[]>;
  recurrenceMonthlyType: Ref<"day" | "weekday">;
  recurrenceMonthlyWeekday: Ref<{ week: number; day: number }>;
  recurrenceYearlyType: Ref<"day" | "weekday">;
  recurrenceYearlyWeekday: Ref<{ week: number; day: number; month: number }>;
};

export function useRecurrence() {
  const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  function parseRecurrenceFromICal(
    icalData: ICalEvent | null,
    state: RecurrenceState,
  ): void {
    if (!icalData || icalData.type !== "VEVENT") {
      resetRecurrenceFields(state);
      return;
    }

    try {
      const rrule = icalData.rrule;
      if (rrule) {
        state.isRecurring.value = true;

        const freq = rrule.freq?.toLowerCase();
        if (freq && ["daily", "weekly", "monthly", "yearly"].includes(freq)) {
          state.recurrenceType.value = freq as "daily" | "weekly" | "monthly" | "yearly";
        }

        state.recurrenceInterval.value = rrule.interval || 1;

        if (state.recurrenceType.value === "weekly" && rrule.byday) {
          state.recurrenceDays.value = rrule.byday.map((day: string) => dayNames.indexOf(day)).filter((day: number) => day !== -1);
        }

        if (state.recurrenceType.value === "monthly" && rrule.byday) {
          const bydayStr = Array.isArray(rrule.byday) ? rrule.byday[0] : rrule.byday;
          if (bydayStr) {
            const weekMatch = bydayStr.match(/^(-?\d+)([A-Z]{2})$/);
            if (weekMatch) {
              const week = Number.parseInt(weekMatch[1] || "1", 10);
              const dayCode = weekMatch[2] || "SU";
              const dayIndex = dayNames.indexOf(dayCode);

              if (dayIndex !== -1) {
                state.recurrenceMonthlyType.value = "weekday";
                state.recurrenceMonthlyWeekday.value = { week, day: dayIndex };
              }
            }
          }
        }

        if (state.recurrenceType.value === "yearly" && rrule.byday && rrule.bymonth) {
          const bydayStr = Array.isArray(rrule.byday) ? rrule.byday[0] : rrule.byday;
          if (bydayStr) {
            const weekMatch = bydayStr.match(/^(-?\d+)([A-Z]{2})$/);
            if (weekMatch) {
              const week = Number.parseInt(weekMatch[1] || "1", 10);
              const dayCode = weekMatch[2] || "SU";
              const dayIndex = dayNames.indexOf(dayCode);

              if (dayIndex !== -1) {
                state.recurrenceYearlyType.value = "weekday";
                const month = Array.isArray(rrule.bymonth) ? (rrule.bymonth[0] || 1) - 1 : (rrule.bymonth || 1) - 1;
                state.recurrenceYearlyWeekday.value = { week, day: dayIndex, month };
              }
            }
          }
        }

        if (rrule.count) {
          state.recurrenceEndType.value = "count";
          state.recurrenceCount.value = rrule.count;
        }
        else if (rrule.until) {
          state.recurrenceEndType.value = "until";
          const untilICal = ical.Time.fromString(rrule.until, "UTC");
          if (untilICal) {
            const untilDate = untilICal.toJSDate();
            state.recurrenceUntil.value = new CalendarDate(
              untilDate.getUTCFullYear(),
              untilDate.getUTCMonth() + 1,
              untilDate.getUTCDate(),
            );
          }
        }
        else {
          state.recurrenceEndType.value = "never";
        }
      }
      else {
        resetRecurrenceFields(state);
      }
    }
    catch (err) {
      consola.error("Error parsing iCal event:", err);
      resetRecurrenceFields(state);
    }
  }

  function generateRecurrenceRule(
    state: RecurrenceState,
    _start: Date,
  ): ICalEvent["rrule"] | undefined {
    if (!state.isRecurring.value) {
      return undefined;
    }

    const rruleObj: ICalEvent["rrule"] = {
      freq: state.recurrenceType.value.toUpperCase(),
      ...(state.recurrenceInterval.value > 1 && { interval: state.recurrenceInterval.value }),
    };

    if (state.recurrenceType.value === "weekly" && state.recurrenceDays.value.length > 0) {
      rruleObj.byday = state.recurrenceDays.value
        .map(day => dayNames[day] || "SU")
        .filter((day): day is string => Boolean(day));
    }

    if (state.recurrenceType.value === "monthly" && state.recurrenceMonthlyType.value === "weekday") {
      const week = state.recurrenceMonthlyWeekday.value.week;
      const day = dayNames[state.recurrenceMonthlyWeekday.value.day];
      rruleObj.byday = [`${week}${day}`];
    }

    if (state.recurrenceType.value === "yearly" && state.recurrenceYearlyType.value === "weekday") {
      const week = state.recurrenceYearlyWeekday.value.week;
      const day = dayNames[state.recurrenceYearlyWeekday.value.day];
      const month = state.recurrenceYearlyWeekday.value.month + 1;
      rruleObj.byday = [`${week}${day}`];
      rruleObj.bymonth = [month];
    }

    if (state.recurrenceEndType.value === "count") {
      rruleObj.count = state.recurrenceCount.value;
    }
    else if (state.recurrenceEndType.value === "until" && state.recurrenceUntil.value) {
      const untilDate = state.recurrenceUntil.value.toDate(getLocalTimeZone());
      if (untilDate) {
        const endOfDay = new Date(untilDate);
        endOfDay.setHours(23, 59, 59, 999);
        const untilICal = ical.Time.fromJSDate(endOfDay, true);
        rruleObj.until = untilICal.toString();
      }
    }

    return rruleObj;
  }

  function resetRecurrenceFields(state: RecurrenceState): void {
    state.isRecurring.value = false;
    state.recurrenceType.value = "weekly";
    state.recurrenceInterval.value = 1;
    state.recurrenceEndType.value = "never";
    state.recurrenceCount.value = 10;
    state.recurrenceUntil.value = new CalendarDate(2025, 12, 31);
    state.recurrenceDays.value = [];
    state.recurrenceMonthlyType.value = "day";
    state.recurrenceMonthlyWeekday.value = { week: 1, day: 1 };
    state.recurrenceYearlyType.value = "day";
    state.recurrenceYearlyWeekday.value = { week: 1, day: 1, month: 0 };
  }

  function adjustStartDateForRecurrenceDays(
    start: Date,
    recurrenceDays: number[],
  ): Date {
    if (recurrenceDays.length === 0) {
      return start;
    }

    const startDay = start.getUTCDay();
    const sortedDays = [...recurrenceDays].sort((a, b) => {
      const relativeA = a >= startDay ? a - startDay : 7 - startDay + a;
      const relativeB = b >= startDay ? b - startDay : 7 - startDay + b;
      return relativeA - relativeB;
    });

    const firstDay = sortedDays[0] ?? startDay;
    if (startDay !== firstDay) {
      const daysToAdd = firstDay >= startDay
        ? firstDay - startDay
        : 7 - startDay + firstDay;

      return new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    return start;
  }

  return {
    parseRecurrenceFromICal,
    generateRecurrenceRule,
    resetRecurrenceFields,
    adjustStartDateForRecurrenceDays,
  };
}
