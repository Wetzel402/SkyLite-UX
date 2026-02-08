import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  // Get the first (and only) household settings record, or create one if it doesn't exist
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

  // Don't expose the PIN
  return {
    id: settings.id,
    familyName: settings.familyName,
    choreCompletionMode: settings.choreCompletionMode,
    rewardApprovalThreshold: settings.rewardApprovalThreshold,
    hasParentPin: !!settings.parentPin,
  };
});
