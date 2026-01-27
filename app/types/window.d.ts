// Global Window type extensions
declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Window {
    __CAPACITOR_SERVER_URL__?: string | null;
  }
}

export {};
