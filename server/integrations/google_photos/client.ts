import { consola } from "consola";
import { google } from "googleapis";

/**
 * Google Photos Server Service
 *
 * Handles Google Photos API interactions with automatic token refresh.
 * Similar to GoogleCalendarServerService pattern.
 */
export class GooglePhotosServerService {
  private oauth2Client: any;
  private refreshPromise: Promise<void> | null = null;
  private integrationId?: string;
  private onTokenRefresh?: (
    integrationId: string,
    accessToken: string,
    expiry: number,
  ) => Promise<void>;

  constructor(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    accessToken?: string,
    tokenExpiry?: number,
    integrationId?: string,
    onTokenRefresh?: (
      integrationId: string,
      accessToken: string,
      expiry: number,
    ) => Promise<void>,
  ) {
    this.integrationId = integrationId;
    this.onTokenRefresh = onTokenRefresh;

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
      expiry_date: tokenExpiry,
    });
  }

  /**
   * Ensures the access token is valid, refreshing if necessary
   */
  private async ensureValidToken(): Promise<void> {
    const credentials = this.oauth2Client.credentials;
    const now = Date.now();
    const expiryDate = credentials.expiry_date;
    const accessToken = credentials.access_token;

    // Per Google OAuth2 best practices, refresh token 5 minutes before expiry
    // Also refresh if access_token is missing
    const needsRefresh = !accessToken || !expiryDate || expiryDate < now + 300000;

    if (!needsRefresh) {
      return;
    }

    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        consola.info("Google Photos: Refreshing access token...");
        await this.oauth2Client.refreshAccessToken();

        const newCredentials = this.oauth2Client.credentials;
        const newAccessToken = newCredentials.access_token;
        const newExpiry = newCredentials.expiry_date;

        // Persist refreshed token via callback
        if (
          this.integrationId
          && this.onTokenRefresh
          && newAccessToken
          && newExpiry
        ) {
          try {
            await this.onTokenRefresh(
              this.integrationId,
              newAccessToken,
              newExpiry,
            );
            consola.success("Google Photos: Access token refreshed and persisted");
          }
          catch (callbackError) {
            consola.error(
              "Google Photos: Failed to persist refreshed token:",
              callbackError,
            );
          }
        }
      }
      catch (error: unknown) {
        const err = error as { code?: number; message?: string; response?: { status?: number; data?: { error?: string } } };

        // Check for refresh token expiration or revocation (including HTTP 401 responses)
        if (
          err?.response?.status === 401
          || err?.message?.includes("invalid_grant")
          || err?.message?.includes("Token has been expired or revoked")
          || err?.response?.data?.error === "invalid_grant"
        ) {
          consola.error("Google Photos: Refresh token is invalid or expired. User needs to re-authorize.");
          const authError = new Error("Refresh token expired. Please re-authorize the integration.");
          (authError as { code?: number }).code = 401;
          throw authError;
        }

        consola.error("Google Photos: Failed to refresh access token:", err);
        throw error;
      }
      finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Gets the current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    await this.ensureValidToken();

    const accessToken = this.oauth2Client.credentials.access_token;
    if (!accessToken) {
      throw new Error("No access token available after refresh");
    }

    return accessToken;
  }

  /**
   * Gets the current access token and expiry, refreshing if necessary
   */
  async getAccessTokenWithExpiry(): Promise<{ accessToken: string; expiry: number }> {
    await this.ensureValidToken();

    const credentials = this.oauth2Client.credentials;
    const accessToken = credentials.access_token;
    const expiry = credentials.expiry_date;

    if (!accessToken) {
      throw new Error("No access token available after refresh");
    }

    if (!expiry) {
      throw new Error("No expiry date available after refresh");
    }

    return { accessToken, expiry };
  }

  /**
   * Creates a Google Photos Picker session
   */
  async createPickerSession(): Promise<{ sessionId: string; pickerUri: string }> {
    const accessToken = await this.getAccessToken();

    consola.info("Google Photos: Creating picker session...");

    const response = await fetch("https://photospicker.googleapis.com/v1/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      consola.error("Google Photos Picker API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Failed to create picker session: ${response.status} ${response.statusText}`,
      );
    }

    const sessionData = await response.json();

    return {
      sessionId: sessionData.id,
      pickerUri: sessionData.pickerUri,
    };
  }

  /**
   * Fetches an image from Google Photos
   */
  async fetchImage(imageUrl: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Check for authentication errors
      if (response.status === 401 || response.status === 403) {
        consola.error(`Google Photos: Auth error (${response.status}) when fetching image`);
        const authError = new Error(`Authentication failed: ${response.status} ${response.statusText}`);
        (authError as { code?: number }).code = response.status;
        throw authError;
      }

      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return { buffer, contentType };
  }
}
