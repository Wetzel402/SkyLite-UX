import type { tasks_v1 } from "googleapis";

import { consola } from "consola";
import { google } from "googleapis";

import type { GoogleTask, GoogleTasksList } from "./types";

/**
 * Google Tasks Server Service
 *
 * Provides server-side integration with Google Tasks API.
 * Handles OAuth token management and API requests.
 *
 * @example
 * const service = new GoogleTasksServerService(
 *   clientId, clientSecret, refreshToken, accessToken, expiry, integrationId, onTokenRefresh
 * );
 * const tasks = await service.getAllTasks();
 */
export class GoogleTasksServerService {
  private oauth2Client: any;
  private tasks: tasks_v1.Tasks;
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
    expiry?: number,
    integrationId?: string,
    onTokenRefresh?: (integrationId: string, accessToken: string, expiry: number) => Promise<void>,
  ) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
      expiry_date: expiry,
    });
    this.tasks = google.tasks({ version: "v1", auth: this.oauth2Client });
    this.integrationId = integrationId;
    this.onTokenRefresh = onTokenRefresh;
  }

  /**
   * Ensures the access token is valid, refreshing if necessary
   */
  private async ensureValidToken(): Promise<void> {
    const credentials = this.oauth2Client.credentials;
    const now = Date.now();
    const expiryDate = credentials.expiry_date || 0;

    // Refresh if expired or expiring in 30 seconds
    const needsRefresh = expiryDate < now + 30000;

    if (!needsRefresh) {
      return;
    }

    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        consola.info("Google Tasks: Refreshing access token...");
        const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(newCredentials);

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
            consola.success("Google Tasks: Access token refreshed and persisted");
          }
          catch (callbackError) {
            consola.error(
              "Google Tasks: Failed to persist refreshed token:",
              callbackError,
            );
          }
        }
      }
      catch (error) {
        consola.error("Google Tasks: Failed to refresh access token:", error);
        throw error;
      }
      finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Fetch all task lists (with pagination)
   * @returns Array of GoogleTasksList objects
   */
  async listTaskLists(): Promise<GoogleTasksList[]> {
    await this.ensureValidToken();

    const allTaskLists: GoogleTasksList[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.tasks.tasklists.list({
        pageToken,
      });

      const items = response.data.items || [];
      allTaskLists.push(...items.map(list => ({
        id: list.id!,
        title: list.title!,
        updated: list.updated,
      })));

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allTaskLists;
  }

  /**
   * Fetch tasks from a specific task list (with pagination)
   * @param taskListId - The ID of the task list
   * @returns Array of GoogleTask objects
   */
  async listTasks(taskListId: string): Promise<GoogleTask[]> {
    await this.ensureValidToken();

    const allTasks: GoogleTask[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.tasks.tasks.list({
        tasklist: taskListId,
        showCompleted: false, // Only fetch incomplete tasks
        showDeleted: false,
        showHidden: false,
        pageToken,
      });

      const items = response.data.items || [];
      allTasks.push(...items.map(task => ({
        id: task.id!,
        title: task.title!,
        notes: task.notes,
        status: task.status as "needsAction" | "completed",
        due: task.due,
        completed: task.completed,
        updated: task.updated!,
        taskListId,
      })));

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allTasks;
  }

  /**
   * Fetch all incomplete tasks from all task lists
   * @returns Array of GoogleTask objects
   */
  async getAllTasks(): Promise<GoogleTask[]> {
    // Fetch all tasks from all task lists
    const taskLists = await this.listTaskLists();
    const allTasks: GoogleTask[] = [];

    for (const taskList of taskLists) {
      const tasks = await this.listTasks(taskList.id);
      allTasks.push(...tasks);
    }

    return allTasks;
  }
}
