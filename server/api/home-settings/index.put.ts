import { z } from "zod";

import prisma from "~/lib/prisma";

const updateSchema = z.object({
  photosEnabled: z.boolean().optional(),
  photoTransitionSpeed: z.number().optional(),
  kenBurnsIntensity: z.number().optional(),
  photoPlayback: z.enum(["sequential", "random"]).optional(),
  weatherEnabled: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  temperatureUnit: z.string().optional(),
  clockEnabled: z.boolean().optional(),
  eventsEnabled: z.boolean().optional(),
  todosEnabled: z.boolean().optional(),
  mealsEnabled: z.boolean().optional(),
  menuEnabled: z.boolean().optional(),
  countdownEnabled: z.boolean().optional(),
  countdownEventId: z.string().optional().nullable(),
  refreshInterval: z.number().optional(),
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const updates = updateSchema.parse(body);

    const settings = await prisma.homeSettings.upsert({
      where: { singletonId: 1 },
      update: updates,
      create: {
        singletonId: 1,
        ...updates,
      },
    });

    return settings;
  }
  catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: `Invalid request body: ${(error as z.ZodError).message}`,
      });
    }

    throw createError({
      statusCode: 500,
      message: `Failed to update home settings: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});
