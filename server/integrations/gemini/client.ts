import consola from "consola";

import type { GeminiGenerateRequest } from "./types";

import { getGeminiConfig } from "../../utils/geminiConfig";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-1.5-flash";

export class GeminiClient {
  private apiKey: string | null = null;

  constructor() {
    const config = getGeminiConfig();
    this.apiKey = config?.apiKey || null;
  }

  async generateCountdownMessage(
    eventName: string,
    daysRemaining: number,
  ): Promise<string> {
    if (!this.apiKey) {
      consola.warn("Gemini API key not configured. Using fallback message.");
      return this.getFallbackMessage(eventName, daysRemaining);
    }

    try {
      const prompt = this.buildCountdownPrompt(eventName, daysRemaining);
      const message = await this.generate({
        prompt,
        temperature: 0.9,
        maxTokens: 100,
      });

      return message;
    }
    catch (error) {
      consola.error("Failed to generate countdown message:", error);
      return this.getFallbackMessage(eventName, daysRemaining);
    }
  }

  private async generate(request: GeminiGenerateRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: request.prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: request.temperature || 0.9,
            maxOutputTokens: request.maxTokens || 100,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        consola.error("Gemini API error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        consola.error("No candidates in Gemini response:", data);
        throw new Error("No response from Gemini API");
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        consola.error("Invalid candidate structure:", candidate);
        throw new Error("Invalid response structure from Gemini API");
      }

      const message = candidate.content.parts[0].text;
      if (!message || message.trim() === "") {
        consola.error("Empty text in Gemini response:", candidate);
        throw new Error("Empty text in Gemini response");
      }

      return message.trim();
    }
    catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private buildCountdownPrompt(eventName: string, daysRemaining: number): string {
    if (daysRemaining === 0) {
      return `Write a short celebratory message about "${eventName}" happening TODAY. Max 10 words. Must include 2-3 relevant emojis. Make it exciting and fun, not just stating it's today. Focus on the joy and celebration of the event itself. Example style: "Time to party! 🎉🎂✨" Family-friendly.`;
    }
    else if (daysRemaining === 1) {
      return `Write a short anticipatory message about "${eventName}" happening TOMORROW. Max 10 words. Must include 2-3 relevant emojis. Make it magical and exciting, not just stating it's tomorrow. Focus on building excitement for the event. Example style: "Almost time to celebrate! 🎊✨🎈" Family-friendly.`;
    }
    else {
      return `Write a short exciting message about "${eventName}" coming up soon. Max 10 words. Must include 2-3 relevant emojis. Be creative and fun - don't mention the number of days or "countdown". Focus on the excitement and anticipation of the event itself. Example style: "Get ready for an amazing celebration! 🎉🎊✨" Family-friendly.`;
    }
  }

  private getFallbackMessage(eventName: string, daysRemaining: number): string {
    if (daysRemaining === 0) {
      return `Time to celebrate! 🎉🎂✨`;
    }
    else if (daysRemaining === 1) {
      return `Almost here! Get excited! 🎊✨`;
    }
    else {
      return `Something special is coming! 🎈✨`;
    }
  }
}

export const geminiClient = new GeminiClient();
