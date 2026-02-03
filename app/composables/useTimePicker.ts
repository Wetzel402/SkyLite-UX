export function useTimePicker() {
  function convert12To24(hour: number, amPm: string): number {
    if (amPm === "PM" && hour !== 12) {
      return hour + 12;
    }
    if (hour === 12 && amPm === "AM") {
      return 0;
    }
    return hour;
  }

  function convert24To12(hour24: number): { hour: number; amPm: string } {
    if (hour24 === 0) {
      return { hour: 12, amPm: "AM" };
    }
    if (hour24 > 12) {
      return { hour: hour24 - 12, amPm: "PM" };
    }
    if (hour24 === 12) {
      return { hour: 12, amPm: "PM" };
    }
    return { hour: hour24, amPm: "AM" };
  }

  function addMinutes(
    hour: number,
    minute: number,
    amPm: string,
    minutesToAdd: number,
  ): { hour: number; minute: number; amPm: string } {
    const hour24 = convert12To24(hour, amPm);
    const totalMinutes = hour24 * 60 + minute + minutesToAdd;

    const newHour24 = Math.floor(totalMinutes / 60) % 24;
    const newMinute = totalMinutes % 60;

    const { hour: newHour, amPm: newAmPm } = convert24To12(newHour24);

    return {
      hour: newHour,
      minute: newMinute,
      amPm: newAmPm,
    };
  }

  function subtractMinutes(
    hour: number,
    minute: number,
    amPm: string,
    minutesToSubtract: number,
  ): { hour: number; minute: number; amPm: string } {
    const hour24 = convert12To24(hour, amPm);
    const totalMinutes = hour24 * 60 + minute - minutesToSubtract;

    let newHour24 = Math.floor(totalMinutes / 60);
    let newMinute = totalMinutes % 60;

    if (newMinute < 0) {
      newMinute += 60;
      newHour24 -= 1;
    }

    if (newHour24 < 0) {
      newHour24 += 24;
    }

    const { hour: newHour, amPm: newAmPm } = convert24To12(newHour24);

    return {
      hour: newHour,
      minute: newMinute,
      amPm: newAmPm,
    };
  }

  function getTimeInMinutes(
    hour: number,
    minute: number,
    amPm: string,
  ): number {
    const hour24 = convert12To24(hour, amPm);
    return hour24 * 60 + minute;
  }

  function isTimeAfter(
    hour1: number,
    minute1: number,
    amPm1: string,
    hour2: number,
    minute2: number,
    amPm2: string,
  ): boolean {
    const minutes1 = getTimeInMinutes(hour1, minute1, amPm1);
    const minutes2 = getTimeInMinutes(hour2, minute2, amPm2);
    return minutes1 > minutes2;
  }

  function roundToNearest5Minutes(minutes: number): number {
    return Math.round(minutes / 5) * 5;
  }

  function getCurrentTime12Hour(): {
    hour: number;
    minute: number;
    amPm: string;
  } {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const roundedMinutes = roundToNearest5Minutes(currentMinutes);

    let currentHour = now.getHours();
    let adjustedMinutes = roundedMinutes;

    if (adjustedMinutes === 60) {
      adjustedMinutes = 0;
      currentHour += 1;
    }

    const { hour, amPm } = convert24To12(currentHour);
    return { hour, minute: adjustedMinutes, amPm };
  }

  return {
    convert12To24,
    convert24To12,
    addMinutes,
    subtractMinutes,
    getTimeInMinutes,
    isTimeAfter,
    roundToNearest5Minutes,
    getCurrentTime12Hour,
  };
}
