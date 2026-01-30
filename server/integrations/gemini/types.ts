export type GeminiGenerateRequest = {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type CountdownMessageRequest = {
  eventName: string;
  daysRemaining: number;
};

export type CountdownMessageResponse = {
  message: string;
  cached: boolean;
  generatedAt: string;
};
