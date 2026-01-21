export type GoogleIdentityCodeClient = {
  requestCode: () => void;
};

export type GoogleIdentityOAuth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: string;
    redirect_uri: string;
    state: string;
    access_type: string;
    prompt: string;
  }) => GoogleIdentityCodeClient;
};

export type GoogleAccounts = {
  oauth2: GoogleIdentityOAuth2;
};

export type GoogleAPI = {
  accounts: GoogleAccounts;
};

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface Window {
    google?: GoogleAPI;
  }
}
