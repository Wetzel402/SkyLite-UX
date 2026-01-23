export default defineAppConfig({
  // https://ui.nuxt.com/getting-started/theme#design-system
  ui: {
    colors: {
      primary: "cyan",
      secondary: "blue",
      neutral: "slate",
    },
    button: {
      defaultVariants: {
      },
    },
    toaster: {
      defaultVariants: {
        position: "bottom-center",
      },
    },
  },
  // Color mode configuration
  colorMode: {
    preference: "system", // Default to system preference
    fallback: "light", // Fallback if system preference cannot be determined
    classSuffix: "", // No suffix for dark/light classes
  },
});
