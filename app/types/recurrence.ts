import type { DateValue } from "@internationalized/date";
import type { Ref } from "vue";

import type { ICalEvent } from "../../server/integrations/iCal/types";

export type ParseRecurrenceICalInput = {
  type: string;
  rrule?: ICalEvent["rrule"];
};

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
