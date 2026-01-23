import { z } from "zod";

import prisma from "~/lib/prisma";

// Allowed Google Photos domains for SSRF protection
const ALLOWED_DOMAINS = [
  "lh3.googleusercontent.com",
  "photos.google.com",
  "photospicker.googleapis.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
];

function isValidGooglePhotosUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:"
      && ALLOWED_DOMAINS.some(
        domain =>
          parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
      )
    );
  }
  catch {
    return false;
  }
}

const albumSchema = z.object({
  albumId: z.string(),
  title: z.string(),
  coverPhotoUrl: z
    .string()
    .url()
    .refine((url: string) => !url || isValidGooglePhotosUrl(url), {
      message: "URL must be a valid Google Photos URL",
    })
    .optional(),
  mediaItemsCount: z.number().optional(),
});

type Album = z.infer<typeof albumSchema>;

const requestSchema = z.object({
  albums: z.array(albumSchema),
  append: z.boolean().optional().default(true), // Default to append mode for cumulative selection
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { albums, append } = requestSchema.parse(body);

  // Use transaction to ensure atomicity (all or nothing)
  const created = await prisma.$transaction(async (tx) => {
    if (!append) {
      // Replace mode: Clear existing albums
      await tx.selectedAlbum.deleteMany();
    }

    // Get existing albums to determine order and avoid duplicates
    const existingAlbums = await tx.selectedAlbum.findMany({
      orderBy: { order: "asc" },
    });

    // Filter out albums that already exist (based on albumId)
    const existingAlbumIds = new Set(existingAlbums.map(a => a.albumId));
    const newAlbums = albums.filter((album: Album) => !existingAlbumIds.has(album.albumId));

    // Calculate starting order for new albums
    const maxOrder = existingAlbums.length > 0
      ? Math.max(...existingAlbums.map(a => a.order))
      : -1;

    // Insert new albums (skipping duplicates)
    const insertedAlbums = await Promise.all(
      newAlbums.map((album: Album, index: number) =>
        tx.selectedAlbum.create({
          data: {
            albumId: album.albumId,
            title: album.title,
            coverPhotoUrl: album.coverPhotoUrl,
            mediaItemsCount: album.mediaItemsCount,
            order: maxOrder + 1 + index,
          },
        }),
      ),
    );

    // Return all albums (existing + new)
    return [...existingAlbums, ...insertedAlbums];
  });

  return { albums: created };
});
