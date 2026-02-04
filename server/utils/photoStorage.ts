import { consola } from "consola";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

/**
 * Storage configuration for photos
 * Configurable via PHOTOS_STORAGE_PATH or NUXT_PHOTOS_STORAGE_PATH environment variable
 */
function getStorageDirectory(): string {
  // Read directly from environment variables (most reliable for server utils)
  // eslint-disable-next-line node/no-process-env
  const customPath = process.env.NUXT_PHOTOS_STORAGE_PATH || process.env.PHOTOS_STORAGE_PATH;
  if (customPath) {
    return customPath;
  }

  // Default to storage/photos in project directory
  return join(process.cwd(), "storage", "photos");
}

const DEFAULT_IMAGE_WIDTH = 1920;
const DEFAULT_IMAGE_HEIGHT = 1080;

/**
 * Sanitizes a filename to prevent path traversal attacks
 * @param filename - The filename to sanitize
 * @returns Safe filename without path components
 */
function sanitizeFilename(filename: string): string {
  // Use basename to strip any path components
  const safe = basename(filename);

  // Only allow alphanumerics, dots, dashes, and underscores
  if (!/^[\w.-]+$/.test(safe)) {
    throw new Error(`Invalid filename: ${filename}`);
  }

  return safe;
}

/**
 * Validates that a resolved path is within the storage directory
 * @param filepath - The path to validate
 * @throws Error if path is outside storage directory
 */
function validateStoragePath(filepath: string): void {
  const storageDir = resolve(getStorageDirectory());
  const resolvedPath = resolve(filepath);

  if (!resolvedPath.startsWith(storageDir)) {
    throw new Error(`Path traversal attempt detected: ${filepath}`);
  }
}

/**
 * Ensures the storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    const storageDir = getStorageDirectory();
    consola.info(`Using photo storage directory: ${storageDir}`);
    await mkdir(storageDir, { recursive: true });
  }
  catch (error) {
    consola.error("Failed to create storage directory:", error);
    throw error;
  }
}

/**
 * Downloads a photo from Google Photos and saves it locally
 * @param baseUrl - The Google Photos base URL (without size parameters)
 * @param accessToken - OAuth access token
 * @param filename - Filename to save as (e.g., "album-id.jpg")
 * @param width - Image width (default 1920)
 * @param height - Image height (default 1080)
 * @returns Path to the saved file relative to storage directory
 */
export async function downloadAndSavePhoto(
  baseUrl: string,
  accessToken: string,
  filename: string,
  width: number = DEFAULT_IMAGE_WIDTH,
  height: number = DEFAULT_IMAGE_HEIGHT,
): Promise<string> {
  await ensureStorageDir();

  // Sanitize filename to prevent path traversal
  const safeFilename = sanitizeFilename(filename);

  // Add size parameters to get optimized image
  const imageUrl = `${baseUrl}=w${width}-h${height}`;
  const storageDir = getStorageDirectory();
  const filepath = join(storageDir, safeFilename);

  // Validate the path is within storage directory
  validateStoragePath(filepath);

  consola.info(`Downloading photo to: ${filepath}`);

  try {
    // Fetch image from Google Photos
    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Provide more specific error for auth failures
      if (response.status === 401 || response.status === 403) {
        const authError = new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        (authError as { code?: number }).code = response.status;
        throw authError;
      }
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Stream to file
    const fileStream = createWriteStream(filepath);
    await pipeline(response.body as any, fileStream);

    consola.success(`Photo saved: ${safeFilename}`);

    return safeFilename; // Return sanitized filename
  }
  catch (error) {
    consola.error(`Failed to download photo ${safeFilename}:`, error);
    throw error;
  }
}

/**
 * Gets the full filesystem path for a stored photo
 */
export function getPhotoPath(filename: string): string {
  const safeFilename = sanitizeFilename(filename);
  const storageDir = getStorageDirectory();
  const filepath = join(storageDir, safeFilename);
  validateStoragePath(filepath);
  return filepath;
}

/**
 * Deletes a stored photo
 */
export async function deletePhoto(filename: string): Promise<void> {
  try {
    const filepath = getPhotoPath(filename); // Already sanitized and validated
    await unlink(filepath);
    consola.info(`Deleted photo: ${filename}`);
  }
  catch (error) {
    consola.error(`Failed to delete photo ${filename}:`, error);
    throw error;
  }
}

/**
 * Gets the storage directory path
 */
export function getStorageDir(): string {
  return getStorageDirectory();
}
