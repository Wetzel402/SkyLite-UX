import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skylite.app",
  appName: "SkyLite",
  webDir: ".output/public",
  server: {
    // Allow HTTP for local server (bypasses cleartext security on Android)
    androidScheme: "http",
    // Allow all HTTP requests (your local server)
    cleartext: true,
    // Optional: Set your local server IP for development
    // url: 'http://192.168.1.100:3000',
    // allowNavigation: ['192.168.1.100']
  },
  android: {
    allowMixedContent: true,
    // Enable WebView debugging
    webContentsDebuggingEnabled: true,
  },
};

export default config;
