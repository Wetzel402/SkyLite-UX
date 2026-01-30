import consola from "consola";

import type { Todo } from "~/types/database";

export function useCountdowns() {
  const countdowns = ref<Todo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Fetch all countdown todos from the API
   */
  const fetchCountdowns = async () => {
    loading.value = true;
    error.value = null;

    try {
      const data = await $fetch<Todo[]>("/api/todos/countdowns");
      countdowns.value = data;
      consola.debug(`Fetched ${data.length} countdowns`);
    }
    catch (err) {
      consola.error("Failed to fetch countdowns:", err);
      error.value = "Failed to load countdowns";
      countdowns.value = [];
    }
    finally {
      loading.value = false;
    }
  };

  /**
   * Get the earliest upcoming countdown
   */
  const getEarliestCountdown = (): Todo | null => {
    if (countdowns.value.length === 0)
      return null;

    // Countdowns are already sorted by due date (earliest first) from the API
    const earliest = countdowns.value[0];
    return earliest || null;
  };

  /**
   * Calculate days remaining until the event
   */
  const calculateDaysRemaining = (dueDate: Date | string | null): number => {
    if (!dueDate)
      return -1;

    const due = new Date(dueDate);
    const now = new Date();

    // Reset time to start of day for accurate day calculation
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  /**
   * Check if the cached message needs to be refreshed (>24 hours old)
   */
  const needsMessageRefresh = (messageGeneratedAt: Date | string | null): boolean => {
    if (!messageGeneratedAt)
      return true;

    const generated = new Date(messageGeneratedAt);
    const now = new Date();
    const hoursSinceGeneration = (now.getTime() - generated.getTime()) / (1000 * 60 * 60);

    return hoursSinceGeneration > 24;
  };

  /**
   * Get a simple fallback message when AI generation fails
   */
  const getFallbackMessage = (eventName: string, daysRemaining: number): string => {
    if (daysRemaining === 0) {
      return `Today is the day! ${eventName} is here!`;
    }
    else if (daysRemaining === 1) {
      return `Only 1 day until ${eventName}!`;
    }
    else {
      return `Only ${daysRemaining} days until ${eventName}!`;
    }
  };

  /**
   * Get or generate a countdown message for a todo
   */
  const getCountdownMessage = async (
    todo: Todo,
    forceRefresh: boolean = false,
  ): Promise<string> => {
    // Check if we need to refresh the message
    const shouldRefresh = forceRefresh
      || !todo.countdownMessage
      || needsMessageRefresh(todo.messageGeneratedAt);

    // If we have a valid cached message, use it
    if (!shouldRefresh && todo.countdownMessage) {
      consola.debug(`Using cached message for todo ${todo.id}`);
      return todo.countdownMessage;
    }

    // Generate a new message
    try {
      const daysRemaining = calculateDaysRemaining(todo.dueDate);

      consola.debug(`Generating new message for todo ${todo.id} (${daysRemaining} days)`);

      const response = await $fetch<{
        message: string;
        cached: boolean;
        generatedAt: string;
      }>("/api/ai/generate-countdown-message", {
        method: "POST",
        body: {
          eventName: todo.title,
          daysRemaining,
          todoId: todo.id,
        },
      });

      // Update the local todo with the new message
      todo.countdownMessage = response.message;
      todo.messageGeneratedAt = new Date(response.generatedAt);

      return response.message;
    }
    catch (err) {
      consola.error("Failed to generate countdown message:", err);

      // Return fallback message
      const daysRemaining = calculateDaysRemaining(todo.dueDate);
      return getFallbackMessage(todo.title, daysRemaining);
    }
  };

  return {
    countdowns,
    loading,
    error,
    fetchCountdowns,
    getEarliestCountdown,
    calculateDaysRemaining,
    needsMessageRefresh,
    getCountdownMessage,
    getFallbackMessage,
  };
}
