import { consola } from "consola";
import { z } from "zod";

import prisma from "~/lib/prisma";

import { GooglePhotosServerService } from "../../../server/integrations/google_photos";
import { getGoogleOAuthConfig } from "../../../server/utils/googleOAuthConfig";
import { downloadAndSavePhoto } from "../../../server/utils/photoStorage";

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

  // Get integration and access token for downloading images
  const integration = await prisma.integration.findFirst({
    where: {
      type: "photos",
      service: "google",
      enabled: true,
    },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Google Photos integration not found",
    });
  }

  // Validate settings exist
  if (!integration.settings) {
    throw createError({
      statusCode: 401,
      message: "Integration settings are missing. Please re-authorize the integration.",
    });
  }

  const settings = (integration.settings ?? {}) as {
    accessToken?: string;
    tokenExpiry?: number;
  };

  if (!integration.apiKey) {
    throw createError({
      statusCode: 401,
      message: "No refresh token available. Please re-authorize the integration.",
    });
  }

  // Get OAuth config
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google OAuth credentials not configured",
    });
  }

  // Create service for token management
  const service = new GooglePhotosServerService(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    integration.apiKey,
    settings.accessToken,
    settings.tokenExpiry,
    integration.id,
    async (integrationId, accessToken, expiry) => {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          settings: {
            ...settings,
            accessToken,
            tokenExpiry: expiry,
          },
        },
      });
    },
  );

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

  // Download cover photos in the background (don't block response)
  // This runs after the transaction completes
  downloadCoverPhotosInBackground(created, service);

  return { albums: created };
});

/**
 * Downloads cover photos for albums in the background
 */
async function downloadCoverPhotosInBackground(
  albums: any[],
  service: any,
): Promise<void> {
  // Run in background - don't await
  Promise.resolve().then(async () => {
    for (const album of albums) {
      // Skip if already downloaded or no cover photo URL
      if (album.localImagePath || !album.coverPhotoUrl) {
        continue;
      }

      try {
        // Validate URL before downloading
        const url = new URL(album.coverPhotoUrl);
        const allowedHosts = [
          "lh3.googleusercontent.com",
          "lh4.googleusercontent.com",
          "lh5.googleusercontent.com",
          "lh6.googleusercontent.com",
          "photos.google.com",
          "photospicker.googleapis.com",
        ];

        if (!allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
          consola.warn(`Skipping download for album ${album.albumId}: invalid host ${url.hostname}`);
          continue;
        }

        // Get fresh access token for this album (handles expiration)
        let accessToken: string;
        try {
          accessToken = await service.getAccessToken();
        }
        catch (tokenError) {
          consola.error(`Failed to get access token for album ${album.albumId}:`, tokenError);
          continue; // Skip this album and move to next
        }

        const filename = `album-${album.albumId}.jpg`;
        const localPath = await downloadAndSavePhoto(
          album.coverPhotoUrl,
          accessToken,
          filename,
        );

        // Update database with local path
        await prisma.selectedAlbum.update({
          where: { id: album.id },
          data: {
            localImagePath: localPath,
            cachedWidth: 1920,
            cachedHeight: 1080,
            downloadedAt: new Date(),
          },
        });
      }
      catch (error) {
        consola.error(`Failed to download cover photo for album ${album.albumId}:`, error);
        // Continue with next album even if one fails
      }
    }
  });
}
