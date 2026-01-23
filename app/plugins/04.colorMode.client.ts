/**
 * Color Mode Plugin
 *
 * Ensures dark mode preference persists across page navigation.
 * Initializes color mode on app load based on saved preference or system preference.
 */
export default defineNuxtPlugin(() => {
  const colorMode = useColorMode();

  // Initialize color mode if not set
  if (!colorMode.preference || colorMode.preference === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    colorMode.preference = prefersDark ? "dark" : "light";
  }
});
