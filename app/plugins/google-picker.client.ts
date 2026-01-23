export default defineNuxtPlugin(() => {
  // Google Photos Picker doesn't need a separate library
  // It's embedded directly via iframe/popup
  if (process.client) {
    console.log('Google Photos Picker ready - no library needed');
  }
});
