import { consola } from "consola";

import type { Integration } from "~/types/database";

import { integrationServices } from "~/plugins/02.appInit";
import { createIntegrationService } from "~/types/integrations";

export function useIntegrations() {
  const { data: cachedIntegrations } = useNuxtData<Integration[]>("integrations");

  const loading = ref(false);
  const error = ref<string | null>(null);

  const integrations = computed(() => {
    return cachedIntegrations.value || [];
  });

  const initialized = computed(() => {
    if (!integrations.value.length)
      return false;
    const enabledIntegrations = integrations.value.filter(i => i.enabled);
    return enabledIntegrations.every(i => integrationServices.has(i.id));
  });

  const servicesInitializing = computed(() => {
    if (!integrations.value.length)
      return false;
    const enabledIntegrations = integrations.value.filter(i => i.enabled);
    return enabledIntegrations.length > 0 && !initialized.value;
  });

  const fetchIntegrations = async () => {
    try {
      await refreshNuxtData("integrations");
      consola.debug("Use Integrations: Integrations data refreshed successfully");
    }
    catch (err) {
      consola.error("Use Integrations: Error refreshing integrations:", err);
    }
  };

  const refreshIntegrations = async () => {
    await fetchIntegrations();
  };

  const createIntegration = async (integration: Omit<Integration, "id">) => {
    try {
      const response = await $fetch<Integration>("/api/integrations", {
        method: "POST",
        body: integration,
      });

      await refreshNuxtData("integrations");

      if (response.enabled) {
        consola.info(`Use Integrations: Initializing service for ${response.name} (${response.id})...`);
        try {
          const service = await createIntegrationService(response);
          if (service) {
            integrationServices.set(response.id, service);
            consola.debug(`Use Integrations: Service created, calling initialize()...`);
            await service.initialize();
            consola.info(`Use Integrations: Service initialized successfully for ${response.name}`);
          }
          else {
            consola.warn(`Use Integrations: Failed to create service for ${response.name}`);
          }
        }
        catch (initError) {
          consola.error(`Use Integrations: Service initialization failed for ${response.name}:`, initError);
          // Continue anyway - integration is saved, just not initialized
        }
      }

      if (response.enabled) {
        try {
          consola.debug(`Use Integrations: Registering ${response.name} with sync manager...`);
          await $fetch("/api/sync/register", {
            method: "POST",
            body: response,
          });
          consola.debug("Use Integrations: Integration registered with sync manager:", response.name);

          consola.debug(`Use Integrations: Triggering immediate sync for ${response.name}...`);
          const { triggerImmediateSync } = useSyncManager();
          await triggerImmediateSync(response.type, response.id);
          consola.info("Use Integrations: Immediate sync completed for new integration:", response.name);
        }
        catch (syncError) {
          consola.warn("Use Integrations: Failed to register integration with sync manager:", syncError);
          // Continue anyway - integration is created
        }
      }

      consola.debug("Use Integrations: Integration created successfully:", response.name);
      return response;
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create integration";
      consola.error("Use Integrations: Error creating integration:", err);
      throw new Error(errorMessage);
    }
  };

  const updateIntegration = async (id: string, updates: Partial<Integration>) => {
    try {
      const response = await $fetch<Integration>(`/api/integrations/${id}`, {
        method: "PUT",
        body: updates,
      });

      await refreshNuxtData("integrations");

      if (response.enabled) {
        const service = await createIntegrationService(response);
        if (service) {
          integrationServices.set(response.id, service);
          await service.initialize();
        }

        try {
          await $fetch("/api/sync/register", {
            method: "POST",
            body: response,
          });
          consola.debug("Use Integrations: Integration re-registered with sync manager:", response.name);
        }
        catch (syncError) {
          consola.warn("Use Integrations: Failed to re-register integration with sync manager:", syncError);
        }
      }
      else {
        integrationServices.delete(response.id);
      }

      consola.debug("Use Integrations: Integration updated successfully:", response.name);
      return response;
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update integration";
      consola.error("Use Integrations: Error updating integration:", err);
      throw new Error(errorMessage);
    }
  };

  const deleteIntegration = async (id: string) => {
    try {
      await $fetch(`/api/integrations/${id}`, {
        method: "DELETE",
      });

      integrationServices.delete(id);

      await refreshNuxtData("integrations");

      consola.debug("Use Integrations: Integration deleted successfully:", id);
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete integration";
      consola.error("Use Integrations: Error deleting integration:", err);
      throw new Error(errorMessage);
    }
  };

  const getEnabledIntegrations = computed(() => {
    if (!initialized.value)
      return [];
    return integrations.value.filter((integration: Integration) => integration.enabled);
  });

  const getIntegrationsByType = (type: string) => {
    if (!initialized.value)
      return [];
    return integrations.value.filter((integration: Integration) => integration.type === type && integration.enabled);
  };

  const getIntegrationByType = (type: string) => {
    if (!initialized.value)
      return undefined;
    return integrations.value.find((integration: Integration) => integration.type === type && integration.enabled);
  };

  const getService = (integrationId: string) => {
    return integrationServices.get(integrationId);
  };

  const reinitializeIntegration = async (integrationId: string) => {
    const integration = integrations.value.find(i => i.id === integrationId);
    if (integration) {
      if (integration.enabled) {
        const service = await createIntegrationService(integration);
        if (service) {
          integrationServices.set(integration.id, service);
          await service.initialize();
          consola.debug(`Use Integrations: Reinitialized integration service: ${integration.name}`);
        }
      }
      else {
        integrationServices.delete(integration.id);
        consola.debug(`Use Integrations: Removed integration service: ${integration.name}`);
      }
    }
  };

  return {
    integrations: readonly(integrations),
    loading: readonly(loading),
    error: readonly(error),
    initialized: readonly(initialized),
    servicesInitializing: readonly(servicesInitializing),

    fetchIntegrations,
    refreshIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    reinitializeIntegration,
    getEnabledIntegrations,
    getIntegrationByType,
    getIntegrationsByType,
    getService,
  };
}
