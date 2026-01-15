import prisma from "~/lib/prisma";

type VerifyPinBody = {
  pin: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<VerifyPinBody>(event);

  if (!body.pin) {
    throw createError({
      statusCode: 400,
      statusMessage: "PIN is required",
    });
  }

  const settings = await prisma.householdSettings.findFirst();

  if (!settings || !settings.parentPin) {
    throw createError({
      statusCode: 400,
      statusMessage: "No parent PIN has been set",
    });
  }

  // Simple comparison - in production, this should use proper hashing
  const isValid = settings.parentPin === body.pin;

  return { valid: isValid };
});
