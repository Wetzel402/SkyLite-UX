import { consola } from "consola";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";
import type { AppSettings, Integration, MealPlanWithMeals, ShoppingListWithItemsAndCount, TodoColumn, TodoWithUser, User } from "~/types/database";
import type { CalendarIntegrationService, IntegrationService, ShoppingIntegrationService, TodoIntegrationService } from "~/types/integrations";

import { integrationConfigs } from "~/integrations/integrationConfig";
import { setBrowserTimezone, setTimezoneRegistered } from "~/types/global";
import { createIntegrationService, registerIntegration } from "~/types/integrations";

export const integrationServices = new Map<string, IntegrationService>();

export default defineNuxtPlugin(async () => {
  consola.start("AppInit: Starting up...");

  const config = useRuntimeConfig();
  const browserTimezone = config.public.tz;

  try {
    const apiUrl = `https://tz.add-to-calendar-technology.com/api/${encodeURIComponent(browserTimezone)}.ics`;
    const { data: vtimezoneBlock, error } = await useFetch(apiUrl, {
      key: `timezone-${browserTimezone}`,
      server: true,
      default: () => null,
    });

    if (error.value) {
      throw new Error(`Failed to fetch timezone data: ${error.value.statusCode || "Unknown error"}`);
    }

    if (!vtimezoneBlock.value) {
      throw new Error("No timezone data received");
    }

    const timezoneComponent = new ical.Component(ical.parse(vtimezoneBlock.value as string));
    const timezone = new ical.Timezone({
      tzid: browserTimezone,
      component: timezoneComponent,
    });

    ical.TimezoneService.register(timezone);
    consola.debug("AppInit: Successfully registered timezone:", browserTimezone, "on", import.meta.server ? "server" : "client");

    setTimezoneRegistered(true);
    setBrowserTimezone(browserTimezone);
  }
  catch (error) {
    consola.warn("AppInit: Failed to register timezone, calendar will use fallback:", error);
    setTimezoneRegistered(false);
  }

  integrationConfigs.forEach((config) => {
    registerIntegration(config);
  });
  consola.debug(`AppInit: Registered ${integrationConfigs.length} integrations`);

  try {
    const [_usersResult, _currentUserResult, integrationsResult, _appSettingsResult] = await Promise.all([
      useAsyncData("users", () => $fetch<User[]>("/api/users"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("current-user", () => Promise.resolve(null), {
        server: false,
        lazy: false,
      }),

      useAsyncData("integrations", () => $fetch<Integration[]>("/api/integrations"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("app-settings", () => $fetch<AppSettings>("/api/app-settings"), {
        server: true,
        lazy: false,
      }),
    ]);

    consola.debug("AppInit: Core dependencies loaded successfully");

    const [_localCalendarResult, _localTodosResult, _localShoppingResult, _todoColumnsResult, _mealPlansResult] = await Promise.all([
      useAsyncData("calendar-events", () => $fetch<CalendarEvent[]>("/api/calendar-events"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("todos", () => $fetch<TodoWithUser[]>("/api/todos"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("native-shopping-lists", () => $fetch<ShoppingListWithItemsAndCount[]>("/api/shopping-lists"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("todo-columns", () => $fetch<TodoColumn[]>("/api/todo-columns"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("meal-plans", () => $fetch<MealPlanWithMeals[]>("/api/meal-plans"), {
        server: true,
        lazy: false,
      }),
    ]);

    consola.debug("AppInit: Local data loaded successfully");

    const integrationDataPromises: ReturnType<typeof useAsyncData>[] = [];

    if (integrationsResult.data.value) {
      const enabledIntegrations = integrationsResult.data.value.filter(integration => integration.enabled);
      consola.debug(`AppInit: Found ${enabledIntegrations.length} enabled integrations`);

      for (const integration of enabledIntegrations) {
        consola.debug(`AppInit: Processing integration: ${integration.name} (${integration.type})`);

        try {
          const service = await createIntegrationService(integration);
          if (!service) {
            consola.warn(`AppInit: Failed to create service for ${integration.name}`);
            continue;
          }

          await service.initialize();

          integrationServices.set(integration.id, service);
          consola.debug(`AppInit: Service initialized and stored for ${integration.name}`);

          if (integration.type === "calendar") {
            integrationDataPromises.push(
              useAsyncData(`calendar-events-${integration.id}`, async () => {
                try {
                  const events = await (service as CalendarIntegrationService).getEvents();
                  return events || [];
                }
                catch (err) {
                  consola.error(`AppInit: Error fetching calendar events for ${integration.name}:`, err);
                  return [];
                }
              }, {
                server: true,
                lazy: false,
              }),
            );
          }
          else if (integration.type === "shopping") {
            integrationDataPromises.push(
              useAsyncData(`shopping-lists-${integration.id}`, async () => {
                try {
                  const lists = await (service as ShoppingIntegrationService).getShoppingLists();
                  return lists || [];
                }
                catch (err) {
                  consola.error(`AppInit: Error fetching shopping lists for ${integration.name}:`, err);
                  return [];
                }
              }, {
                server: true,
                lazy: false,
              }),
            );
          }
          else if (integration.type === "todo") {
            integrationDataPromises.push(
              useAsyncData(`todos-${integration.id}`, async () => {
                try {
                  const todos = await (service as TodoIntegrationService).getTodos();
                  return todos || [];
                }
                catch (err) {
                  consola.error(`AppInit: Error fetching todos for ${integration.name}:`, err);
                  return [];
                }
              }, {
                server: true,
                lazy: false,
              }),
            );
          }
        }
        catch (err) {
          consola.error(`AppInit: Error processing integration ${integration.name}:`, err);
        }
      }
    }

    if (integrationDataPromises.length > 0) {
      consola.debug(`AppInit: Loading data for ${integrationDataPromises.length} integrations...`);

      try {
        await Promise.all(integrationDataPromises);
        consola.debug("AppInit: Integration data loaded successfully");
      }
      catch (integrationError) {
        consola.error("AppInit: Error loading integration data:", integrationError);
      }
    }

    consola.debug(`AppInit: All data pre-loaded successfully. Initialized ${integrationServices.size} integration services.`);
  }
  catch (error) {
    consola.error("AppInit: Error pre-loading data:", error);
  }
});
