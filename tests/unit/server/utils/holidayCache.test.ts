import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getHolidayCache, saveHolidayCache, invalidateHolidayCache } from '../../../../server/utils/holidayCache'

// Mock Prisma client
vi.mock('../../../../server/utils/prisma', () => ({
  prisma: {
    holidayCache: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('holidayCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getHolidayCache', () => {
    it('should return cached holiday if valid', async () => {
      const mockHoliday = {
        id: '123',
        countryCode: 'CA',
        subdivisionCode: 'ON',
        holidayName: 'Canada Day',
        holidayDate: new Date('2026-07-01'),
        fetchedAt: new Date(),
        cachedUntil: new Date('2026-07-01'),
      }

      const { prisma } = await import('../../../../server/utils/prisma')
      vi.mocked(prisma.holidayCache.findFirst).mockResolvedValue(mockHoliday)

      const result = await getHolidayCache('CA', 'ON')

      expect(result).toEqual(mockHoliday)
      expect(prisma.holidayCache.findFirst).toHaveBeenCalledWith({
        where: {
          countryCode: 'CA',
          subdivisionCode: 'ON',
          cachedUntil: { gte: expect.any(Date) },
        },
        orderBy: { holidayDate: 'asc' },
      })
    })

    it('should return null if no valid cache', async () => {
      const { prisma } = await import('../../../../server/utils/prisma')
      vi.mocked(prisma.holidayCache.findFirst).mockResolvedValue(null)

      const result = await getHolidayCache('CA', 'ON')

      expect(result).toBeNull()
    })

    it('should handle undefined subdivisionCode', async () => {
      const { prisma } = await import('../../../../server/utils/prisma')
      vi.mocked(prisma.holidayCache.findFirst).mockResolvedValue(null)

      await getHolidayCache('CA', undefined)

      expect(prisma.holidayCache.findFirst).toHaveBeenCalledWith({
        where: {
          countryCode: 'CA',
          subdivisionCode: null,
          cachedUntil: { gte: expect.any(Date) },
        },
        orderBy: { holidayDate: 'asc' },
      })
    })
  })

  describe('saveHolidayCache', () => {
    it('should save holiday to cache', async () => {
      const holidayData = {
        countryCode: 'CA',
        subdivisionCode: 'ON',
        holidayName: 'Canada Day',
        holidayDate: new Date('2026-07-01'),
        cachedUntil: new Date('2026-07-01'),
      }

      const { prisma } = await import('../../../../server/utils/prisma')
      vi.mocked(prisma.holidayCache.create).mockResolvedValue({
        id: '123',
        ...holidayData,
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await saveHolidayCache(holidayData)

      expect(prisma.holidayCache.create).toHaveBeenCalledWith({
        data: holidayData,
      })
    })
  })

  describe('invalidateHolidayCache', () => {
    it('should delete cache for country', async () => {
      const { prisma } = await import('../../../../server/utils/prisma')
      vi.mocked(prisma.holidayCache.deleteMany).mockResolvedValue({ count: 2 })

      await invalidateHolidayCache('CA', undefined)

      expect(prisma.holidayCache.deleteMany).toHaveBeenCalledWith({
        where: {
          countryCode: 'CA',
          subdivisionCode: null,
        },
      })
    })

    it('should delete cache for country and subdivision', async () => {
      const { prisma } = await import('../../../../server/utils/prisma')
      vi.mocked(prisma.holidayCache.deleteMany).mockResolvedValue({ count: 1 })

      await invalidateHolidayCache('CA', 'ON')

      expect(prisma.holidayCache.deleteMany).toHaveBeenCalledWith({
        where: {
          countryCode: 'CA',
          subdivisionCode: 'ON',
        },
      })
    })
  })
})
