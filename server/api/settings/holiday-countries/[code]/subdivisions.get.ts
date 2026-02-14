/**
 * GET /api/settings/holiday-countries/:code/subdivisions
 * Returns list of subdivisions for a country based on holiday data
 */
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Country code is required",
    });
  }

  try {
    const currentYear = new Date().getFullYear();
    const holidays = await getPublicHolidays(currentYear, code);

    // Extract unique subdivision codes from holidays
    const subdivisionSet = new Set<string>();

    for (const holiday of holidays) {
      if (holiday.counties && Array.isArray(holiday.counties)) {
        for (const county of holiday.counties) {
          // County format is "CC-SUBDIVISION" (e.g., "CA-ON")
          const parts = county.split("-");
          if (parts.length === 2 && parts[0] === code) {
            subdivisionSet.add(parts[1]!);
          }
        }
      }
    }

    // Convert to sorted array
    const subdivisions = Array.from(subdivisionSet).sort();

    return subdivisions.map(code => ({
      code,
      // For now, just return the code as the name
      // Could be enhanced with a lookup table for full names
      name: code,
    }));
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch subdivisions for ${code}: ${error}`,
    });
  }
});
