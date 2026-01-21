import { z } from "zod";
import prisma from "~/lib/prisma";

const albumSchema = z.object({
  albumId: z.string(),
  title: z.string(),
  coverPhotoUrl: z.string().optional(),
  mediaItemsCount: z.number().optional(),
});

const requestSchema = z.object({
  albums: z.array(albumSchema),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { albums } = requestSchema.parse(body);

  // Clear existing albums
  await prisma.selectedAlbum.deleteMany();

  // Insert new albums
  const created = await Promise.all(
    albums.map((album, index) =>
      prisma.selectedAlbum.create({
        data: {
          albumId: album.albumId,
          title: album.title,
          coverPhotoUrl: album.coverPhotoUrl,
          mediaItemsCount: album.mediaItemsCount,
          order: index,
        },
      })
    )
  );

  return { albums: created };
});
