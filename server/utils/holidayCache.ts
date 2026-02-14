import { prisma } from '~/server/utils/prisma'

export interface HolidayCacheData {
  countryCode: string
  subdivisionCode?: string | null
  holidayName: string
  holidayDate: Date
  cachedUntil: Date
}

/**
 * Get cached holiday for country/subdivision if valid (not expired)
 */
export async function getHolidayCache(
  countryCode: string,
  subdivisionCode?: string,
) {
  const now = new Date()

  const cached = await prisma.holidayCache.findFirst({
    where: {
      countryCode,
      subdivisionCode: subdivisionCode ?? null,
      cachedUntil: { gte: now },
    },
    orderBy: { holidayDate: 'asc' },
  })

  return cached
}

/**
 * Save holiday to cache
 */
export async function saveHolidayCache(data: HolidayCacheData) {
  return await prisma.holidayCache.create({
    data: {
      countryCode: data.countryCode,
      subdivisionCode: data.subdivisionCode ?? null,
      holidayName: data.holidayName,
      holidayDate: data.holidayDate,
      cachedUntil: data.cachedUntil,
    },
  })
}

/**
 * Invalidate cache for country/subdivision (used when settings change)
 */
export async function invalidateHolidayCache(
  countryCode: string,
  subdivisionCode?: string,
) {
  return await prisma.holidayCache.deleteMany({
    where: {
      countryCode,
      subdivisionCode: subdivisionCode ?? null,
    },
  })
}
