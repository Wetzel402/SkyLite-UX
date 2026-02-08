import prisma from "~/lib/prisma";

type UpdateHouseholdSettingsBody = {
  familyName?: string;
  choreCompletionMode?: "SELF_CLAIM" | "PARENT_VERIFY";
  rewardApprovalThreshold?: number | null;
  parentPin?: string | null;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateHouseholdSettingsBody>(event);

  // Get current settings or create if doesn't exist
  let settings = await prisma.householdSettings.findFirst();

  if (!settings) {
    settings = await prisma.householdSettings.create({
      data: {
        familyName: "Our Family",
        choreCompletionMode: "SELF_CLAIM",
        rewardApprovalThreshold: null,
        parentPin: null,
      },
    });
  }

  // Validate inputs
  if (body.familyName !== undefined && (typeof body.familyName !== "string" || body.familyName.trim() === "")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Family name cannot be empty",
    });
  }

  if (body.choreCompletionMode !== undefined && !["SELF_CLAIM", "PARENT_VERIFY"].includes(body.choreCompletionMode)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chore completion mode",
    });
  }

  if (body.rewardApprovalThreshold !== undefined && body.rewardApprovalThreshold !== null) {
    if (typeof body.rewardApprovalThreshold !== "number" || body.rewardApprovalThreshold < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Reward approval threshold must be a non-negative number",
      });
    }
  }

  // Hash PIN if provided
  let hashedPin: string | null | undefined;
  if (body.parentPin !== undefined) {
    if (body.parentPin === null) {
      hashedPin = null;
    }
    else {
      hashedPin = await hashPin(body.parentPin);
    }
  }

  // Update settings
  const updatedSettings = await prisma.householdSettings.update({
    where: { id: settings.id },
    data: {
      ...(body.familyName !== undefined && { familyName: body.familyName.trim() }),
      ...(body.choreCompletionMode !== undefined && { choreCompletionMode: body.choreCompletionMode }),
      ...(body.rewardApprovalThreshold !== undefined && { rewardApprovalThreshold: body.rewardApprovalThreshold }),
      ...(hashedPin !== undefined && { parentPin: hashedPin }),
    },
  });

  // Don't expose the PIN
  return {
    id: updatedSettings.id,
    familyName: updatedSettings.familyName,
    choreCompletionMode: updatedSettings.choreCompletionMode,
    rewardApprovalThreshold: updatedSettings.rewardApprovalThreshold,
    hasParentPin: !!updatedSettings.parentPin,
  };
});
