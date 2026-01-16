// Screensaver composable for managing idle detection and screensaver state

const DEFAULT_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes default

// Shared state (reactive and persistent across components)
const isScreensaverActive = ref(false);
const idleTimeout = ref(DEFAULT_IDLE_TIMEOUT);
const lastActivity = ref(Date.now());

let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function useScreensaver() {
  const router = useRouter();

  // Reset activity timer
  const resetIdleTimer = () => {
    lastActivity.value = Date.now();

    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    // Only set timer if not already on screensaver
    if (!isScreensaverActive.value) {
      idleTimer = setTimeout(() => {
        activateScreensaver();
      }, idleTimeout.value);
    }
  };

  // Activate screensaver
  const activateScreensaver = () => {
    isScreensaverActive.value = true;
    router.push("/screensaver");
  };

  // Deactivate screensaver and return to calendar
  const deactivateScreensaver = () => {
    isScreensaverActive.value = false;
    resetIdleTimer();
    router.push("/calendar");
  };

  // Set up activity listeners
  const startIdleDetection = () => {
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];

    events.forEach((event) => {
      if (typeof document !== "undefined") {
        document.addEventListener(event, resetIdleTimer, { passive: true });
      }
    });

    // Start the initial timer
    resetIdleTimer();
  };

  // Clean up listeners
  const stopIdleDetection = () => {
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];

    events.forEach((event) => {
      if (typeof document !== "undefined") {
        document.removeEventListener(event, resetIdleTimer);
      }
    });

    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  // Set idle timeout (in milliseconds)
  const setIdleTimeout = (timeout: number) => {
    idleTimeout.value = timeout;
    resetIdleTimer();
  };

  // Manually trigger screensaver (for testing or settings)
  const triggerScreensaver = () => {
    activateScreensaver();
  };

  return {
    isScreensaverActive: readonly(isScreensaverActive),
    idleTimeout: readonly(idleTimeout),
    lastActivity: readonly(lastActivity),
    startIdleDetection,
    stopIdleDetection,
    deactivateScreensaver,
    setIdleTimeout,
    triggerScreensaver,
    resetIdleTimer,
  };
}
