const NAGER_API_BASE = "https://date.nager.at/api/v3";
const FETCH_TIMEOUT_MS = 5000; // 5 seconds

export type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  counties: string[] | null;
};

export type NagerCountry = {
  countryCode: string;
  name: string;
};

export type NagerCountryInfo = {
  countryCode: string;
  name: string;
  region: string;
  borderCountries: NagerCountry[];
};

/**
 * Fetch public holidays for a specific year and country
 */
export async function getPublicHolidays(
  year: number,
  countryCode: string,
): Promise<NagerHoliday[]> {
  try {
    const response = await fetch(
      `${NAGER_API_BASE}/PublicHolidays/${year}/${countryCode}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch holidays: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout fetching holidays for ${countryCode}`);
    }
    throw error;
  }
}

/**
 * Get list of available countries
 */
export async function getAvailableCountries(): Promise<NagerCountry[]> {
  try {
    const response = await fetch(`${NAGER_API_BASE}/AvailableCountries`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch countries: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout fetching available countries");
    }
    throw error;
  }
}

/**
 * Get country information including subdivisions
 */
export async function getCountryInfo(
  countryCode: string,
): Promise<NagerCountryInfo> {
  try {
    const response = await fetch(`${NAGER_API_BASE}/CountryInfo/${countryCode}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch country info: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout fetching country info for ${countryCode}`);
    }
    throw error;
  }
}

/**
 * Get next upcoming holiday for country/subdivision
 * Filters to holidays >= today and optionally by subdivision
 */
export async function getNextUpcomingHoliday(
  countryCode: string,
  subdivisionCode?: string,
): Promise<NagerHoliday | null> {
  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch holidays for current year
  let holidays = await getPublicHolidays(currentYear, countryCode);

  // Filter to upcoming holidays
  let upcomingHolidays = holidays.filter((holiday) => {
    const holidayDate = new Date(holiday.date);
    holidayDate.setHours(0, 0, 0, 0);

    // Must be today or in the future
    if (holidayDate < today) {
      return false;
    }

    // If subdivision specified, filter by counties
    if (subdivisionCode) {
      const fullIsoSubdivision = `${countryCode}-${subdivisionCode}`;
      // Holiday applies if counties is null (national) or includes subdivision
      return (
        holiday.counties === null || holiday.counties.includes(fullIsoSubdivision)
      );
    }

    // No subdivision filter - include all holidays
    return true;
  });

  // If no upcoming holidays this year, try next year
  if (upcomingHolidays.length === 0) {
    holidays = await getPublicHolidays(currentYear + 1, countryCode);
    upcomingHolidays = holidays.filter((holiday) => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);

      // If subdivision specified, filter by counties
      if (subdivisionCode) {
        const fullIsoSubdivision = `${countryCode}-${subdivisionCode}`;
        return (
          holiday.counties === null || holiday.counties.includes(fullIsoSubdivision)
        );
      }

      return true;
    });
  }

  // Return earliest upcoming holiday
  return upcomingHolidays.length > 0 ? upcomingHolidays[0]! : null;
}
