import { prisma } from "./prisma";

export type HolidayCacheData = {
  countryCode: string;
  subdivisionCode?: string | null;
  holidayName: string;
  holidayDate: Date;
  cachedUntil: Date;
};

/**
 * Get cached holiday for country/subdivision if valid (not expired)
 */
export async function getHolidayCache(
  countryCode: string,
  subdivisionCode?: string,
) {
  try {
    const now = new Date();

    const cached = await prisma.holidayCache.findFirst({
      where: {
        countryCode,
        subdivisionCode: subdivisionCode ?? null,
        cachedUntil: { gte: now },
      },
      orderBy: { holidayDate: "asc" },
    });

    return cached;
  }
  catch (error) {
    throw new Error(`Failed to get holiday cache for ${countryCode}${subdivisionCode ? `/${subdivisionCode}` : ""}: ${error}`);
  }
}

/**
 * Save holiday to cache using transaction for atomicity
 */
export async function saveHolidayCache(data: HolidayCacheData) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Delete old cache entries for this location
      await tx.holidayCache.deleteMany({
        where: {
          countryCode: data.countryCode,
          subdivisionCode: data.subdivisionCode ?? null,
        },
      });

      // Create new cache entry
      return await tx.holidayCache.create({
        data: {
          ...data,
          subdivisionCode: data.subdivisionCode ?? null,
        },
      });
    });
  }
  catch (error) {
    throw new Error(`Failed to save holiday cache for ${data.countryCode}: ${error}`);
  }
}

/**
 * Invalidate cache for country/subdivision (used when settings change)
 */
export async function invalidateHolidayCache(
  countryCode: string,
  subdivisionCode?: string,
) {
  try {
    return await prisma.holidayCache.deleteMany({
      where: {
        countryCode,
        subdivisionCode: subdivisionCode ?? null,
      },
    });
  }
  catch (error) {
    throw new Error(`Failed to invalidate holiday cache for ${countryCode}${subdivisionCode ? `/${subdivisionCode}` : ""}: ${error}`);
  }
}
