const NAGER_API_BASE = 'https://date.nager.at/api/v3'

export interface NagerHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  counties: string[] | null
}

export interface NagerCountry {
  countryCode: string
  name: string
}

export interface NagerCountryInfo {
  countryCode: string
  name: string
  region: string
  borderCountries: NagerCountry[]
}

/**
 * Fetch public holidays for a specific year and country
 */
export async function getPublicHolidays(
  year: number,
  countryCode: string,
): Promise<NagerHoliday[]> {
  const response = await fetch(
    `${NAGER_API_BASE}/PublicHolidays/${year}/${countryCode}`,
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch holidays: ${response.status} ${response.statusText}`,
    )
  }

  return await response.json()
}

/**
 * Get list of available countries
 */
export async function getAvailableCountries(): Promise<NagerCountry[]> {
  const response = await fetch(`${NAGER_API_BASE}/AvailableCountries`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch countries: ${response.status} ${response.statusText}`,
    )
  }

  return await response.json()
}

/**
 * Get country information including subdivisions
 */
export async function getCountryInfo(
  countryCode: string,
): Promise<NagerCountryInfo> {
  const response = await fetch(`${NAGER_API_BASE}/CountryInfo/${countryCode}`)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch country info: ${response.status} ${response.statusText}`,
    )
  }

  return await response.json()
}

/**
 * Get next upcoming holiday for country/subdivision
 * Filters to holidays >= today and optionally by subdivision
 */
export async function getNextUpcomingHoliday(
  countryCode: string,
  subdivisionCode?: string,
): Promise<NagerHoliday | null> {
  const currentYear = new Date().getFullYear()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch holidays for current year
  const holidays = await getPublicHolidays(currentYear, countryCode)

  // Filter to upcoming holidays
  const upcomingHolidays = holidays.filter((holiday) => {
    const holidayDate = new Date(holiday.date)
    holidayDate.setHours(0, 0, 0, 0)

    // Must be today or in the future
    if (holidayDate < today) {
      return false
    }

    // If subdivision specified, filter by counties
    if (subdivisionCode) {
      // Holiday applies if counties is null (national) or includes subdivision
      return (
        holiday.counties === null || holiday.counties.includes(subdivisionCode)
      )
    }

    // No subdivision filter - include all holidays
    return true
  })

  // Return earliest upcoming holiday
  return upcomingHolidays.length > 0 ? upcomingHolidays[0] : null
}
