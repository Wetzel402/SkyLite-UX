import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  const albums = await prisma.selectedAlbum.findMany({
    orderBy: { order: 'asc' },
  });

  return { albums };
});
