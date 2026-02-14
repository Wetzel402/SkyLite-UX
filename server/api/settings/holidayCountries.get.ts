import { getAvailableCountries } from "../../../server/utils/nagerDateApi";

/**
 * GET /api/settings/holiday-countries
 * Returns list of countries supported by Nager.Date API
 */
export default defineEventHandler(async () => {
  try {
    const countries = await getAvailableCountries();
    return countries;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch available countries: ${error}`,
    });
  }
});
