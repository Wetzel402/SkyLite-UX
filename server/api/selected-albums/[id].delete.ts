import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Album ID required",
    });
  }

  await prisma.selectedAlbum.delete({
    where: { id },
  });

  return { success: true };
});
