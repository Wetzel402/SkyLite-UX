import { getCountryInfo } from "../../../../server/utils/nagerDateApi";

/**
 * GET /api/settings/holiday-countries/:code
 * Returns country information including subdivisions
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
    const info = await getCountryInfo(code);
    return info;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch country info for ${code}: ${error}`,
    });
  }
});
