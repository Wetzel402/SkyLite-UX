import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Nuxt auto-imports
global.defineEventHandler = vi.fn((handler) => handler)
global.readBody = vi.fn()
global.createError = vi.fn((error) => {
  const err = new Error(error.message)
  err.statusCode = error.statusCode
  return err
})

// Create shared mock function
const mockInvalidateHolidayCache = vi.fn()

// Mock dependencies
vi.mock('../../../server/utils/holidayCache', () => ({
  invalidateHolidayCache: mockInvalidateHolidayCache,
}))

// Mock the aliased import path
vi.mock('~/server/utils/holidayCache', () => ({
  invalidateHolidayCache: mockInvalidateHolidayCache,
}))

// Create shared prisma mock
const mockPrisma = {
  appSettings: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

// Mock the actual prisma module
vi.mock('../../../app/lib/prisma', () => ({
  default: mockPrisma,
}))

// Mock the aliased import path used in the handler
vi.mock('~/lib/prisma', () => ({
  default: mockPrisma,
}))

describe('App Settings API - Holiday Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PUT /api/app-settings', () => {
    it('should update holiday settings and invalidate cache', async () => {

      // Current settings in DB
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: 'ON',
        enableHolidayCountdowns: true,
      })

      // Updated settings
      mockPrisma.appSettings.update.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'US',
        holidaySubdivisionCode: 'NY',
        enableHolidayCountdowns: true,
      })

      const event = {
        context: {},
      }

      vi.mocked(global.readBody).mockResolvedValue({
        holidayCountryCode: 'US',
        holidaySubdivisionCode: 'NY',
      })

      const handler = await import('../../../server/api/app-settings/index.put')
      await handler.default(event)

      // Should invalidate cache for old country/subdivision
      expect(mockInvalidateHolidayCache).toHaveBeenCalledWith('CA', 'ON')

      // Should update settings
      expect(mockPrisma.appSettings.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          holidayCountryCode: 'US',
          holidaySubdivisionCode: 'NY',
        }),
      })
    })

    it('should invalidate cache when changing country only', async () => {

      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
      })

      mockPrisma.appSettings.update.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'US',
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
      })

      const event = {
        context: {},
      }

      vi.mocked(global.readBody).mockResolvedValue({
        holidayCountryCode: 'US',
      })

      const handler = await import('../../../server/api/app-settings/index.put')
      await handler.default(event)

      expect(mockInvalidateHolidayCache).toHaveBeenCalledWith('CA', undefined)
    })

    it('should invalidate cache when changing subdivision only', async () => {

      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'US',
        holidaySubdivisionCode: 'CA',
        enableHolidayCountdowns: true,
      })

      mockPrisma.appSettings.update.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'US',
        holidaySubdivisionCode: 'NY',
        enableHolidayCountdowns: true,
      })

      const event = {
        context: {},
      }

      vi.mocked(global.readBody).mockResolvedValue({
        holidaySubdivisionCode: 'NY',
      })

      const handler = await import('../../../server/api/app-settings/index.put')
      await handler.default(event)

      expect(mockInvalidateHolidayCache).toHaveBeenCalledWith('US', 'CA')
    })

    it('should not invalidate cache if holiday settings unchanged', async () => {

      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: 'ON',
        enableHolidayCountdowns: true,
      })

      mockPrisma.appSettings.update.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: true,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: 'ON',
        enableHolidayCountdowns: false,
      })

      const event = {
        context: {},
      }

      vi.mocked(global.readBody).mockResolvedValue({
        enableHolidayCountdowns: false,
        showMealsOnCalendar: true,
      })

      const handler = await import('../../../server/api/app-settings/index.put')
      await handler.default(event)

      // Should NOT invalidate cache if country/subdivision unchanged
      expect(mockInvalidateHolidayCache).not.toHaveBeenCalled()
    })

    it('should handle clearing subdivision (setting to null)', async () => {

      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: 'ON',
        enableHolidayCountdowns: true,
      })

      mockPrisma.appSettings.update.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
      })

      const event = {
        context: {},
      }

      vi.mocked(global.readBody).mockResolvedValue({
        holidaySubdivisionCode: null,
      })

      const handler = await import('../../../server/api/app-settings/index.put')
      await handler.default(event)

      // Should invalidate cache for old subdivision
      expect(mockInvalidateHolidayCache).toHaveBeenCalledWith('CA', 'ON')
    })

    it('should preserve existing app settings functionality', async () => {

      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: false,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
      })

      mockPrisma.appSettings.update.mockResolvedValue({
        id: '1',
        showMealsOnCalendar: true,
        holidayCountryCode: 'CA',
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
      })

      const event = {
        context: {},
      }

      vi.mocked(global.readBody).mockResolvedValue({
        showMealsOnCalendar: true,
      })

      const handler = await import('../../../server/api/app-settings/index.put')
      const result = await handler.default(event)

      // Should update showMealsOnCalendar
      expect(mockPrisma.appSettings.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          showMealsOnCalendar: true,
        }),
      })

      // Should not invalidate cache
      expect(mockInvalidateHolidayCache).not.toHaveBeenCalled()

      // Should return updated settings
      expect(result).toEqual(expect.objectContaining({
        showMealsOnCalendar: true,
      }))
    })
  })
})
