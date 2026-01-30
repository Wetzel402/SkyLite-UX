export function getGeminiConfig(): { apiKey: string } | null {
  const config = useRuntimeConfig();
  let apiKey = (config.geminiApiKey as string) || "";

  // Fallback to direct environment variable
  if (!apiKey) {
    // eslint-disable-next-line node/no-process-env
    apiKey = process.env.GEMINI_API_KEY || "";
  }

  if (!apiKey)
    return null;
  return { apiKey };
}
