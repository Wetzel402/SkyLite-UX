/**
 * Google Tasks Client Service
 *
 * This is a minimal client-side service for Google Tasks integration.
 * Since Google Tasks is a read-only server-side integration, this service
 * doesn't need to do much - it just satisfies the integration service contract.
 */
export function createGoogleTasksService(_id: string) {
  return {
    async initialize() {
      // No initialization needed for read-only server-side integration
    },
    async validate() {
      // Validation is handled server-side during OAuth
      return true;
    },
    async testConnection() {
      // Connection test is handled server-side during OAuth
      return true;
    },
    async getStatus() {
      return {
        isConnected: true,
        lastChecked: new Date(),
      };
    },
  };
}
