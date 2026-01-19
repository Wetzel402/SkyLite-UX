import type { OAuth2Client } from "google-auth-library";

import { consola } from "consola";
import { google } from "googleapis";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import type { TokenInfo } from "./types";

/**
 * Encrypt OAuth token using AES-256-GCM
 * @param token - Plain text token to encrypt
 * @returns Encrypted token in format: iv:authTag:encrypted
 */
export function encryptToken(token: string): string {
  const algorithm = "aes-256-gcm";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt OAuth token using AES-256-GCM
 * @param encryptedToken - Encrypted token in format: iv:authTag:encrypted
 * @returns Decrypted plain text token
 */
export function decryptToken(encryptedToken: string): string {
  const algorithm = "aes-256-gcm";
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Get encryption key from environment, generating one if not set (dev only)
 * @returns 32-byte encryption key buffer
 */
function getEncryptionKey(): Buffer {
  const config = useRuntimeConfig();
  const envKey = config.oauthEncryptionKey as string;

  if (envKey) {
    return Buffer.from(envKey, "hex");
  }

  // Development fallback - generate temporary key
  if (import.meta.dev) {
    consola.warn("OAUTH_ENCRYPTION_KEY not set, using temporary key (development only)");
    return crypto.randomBytes(32);
  }

  throw new Error("OAUTH_ENCRYPTION_KEY environment variable is required");
}

/**
 * Create Google OAuth2 client with credentials from environment
 * @returns Configured OAuth2Client instance
 */
export function createOAuth2Client(): OAuth2Client {
  const config = useRuntimeConfig();
  const clientId = config.googleClientId as string;
  const clientSecret = config.googleClientSecret as string;
  const redirectUri = (config.googleRedirectUri as string) || "http://localhost:3000/api/integrations/google-calendar/oauth/callback";

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
}

/**
 * Refresh an expired access token using refresh token
 * @param oauth2Client - OAuth2 client instance
 * @param refreshToken - Refresh token (plain text)
 * @returns New access token and expiry date
 */
export async function refreshAccessToken(
  oauth2Client: OAuth2Client,
  refreshToken: string,
): Promise<TokenInfo> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error("Failed to refresh access token: missing credentials");
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken,
      expiryDate: credentials.expiry_date,
    };
  }
  catch (error) {
    consola.error("Failed to refresh access token:", error);
    throw new Error("Token refresh failed - re-authorization required");
  }
}

/**
 * Generate Google OAuth2 authorization URL
 * @param oauth2Client - OAuth2 client instance
 * @param state - Optional state parameter for CSRF protection
 * @returns Authorization URL to redirect user to
 */
export function generateAuthUrl(oauth2Client: OAuth2Client, state?: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state,
  });
}

/**
 * Exchange authorization code for tokens
 * @param oauth2Client - OAuth2 client instance
 * @param code - Authorization code from OAuth callback
 * @returns Token information
 */
export async function exchangeCodeForTokens(
  oauth2Client: OAuth2Client,
  code: string,
): Promise<TokenInfo> {
  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new Error("Incomplete token response from Google");
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    };
  }
  catch (error) {
    consola.error("Failed to exchange code for tokens:", error);
    throw new Error("Failed to exchange authorization code");
  }
}
