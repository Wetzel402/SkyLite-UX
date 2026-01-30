import consola from "consola";

import prisma from "~/lib/prisma";

import { geminiClient } from "../../integrations/gemini/client";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { eventName, daysRemaining, todoId } = body;

    if (!eventName || daysRemaining === undefined) {
      throw createError({
        statusCode: 400,
        message: "eventName and daysRemaining are required",
      });
    }

    // Generate the message using Gemini (with fallback)
    const message = await geminiClient.generateCountdownMessage(
      eventName,
      daysRemaining,
    );

    const generatedAt = new Date();
    const cached = false; // This is a fresh generation

    // If todoId is provided, update the todo with the new message
    if (todoId) {
      try {
        await prisma.todo.update({
          where: { id: todoId },
          data: {
            countdownMessage: message,
            messageGeneratedAt: generatedAt,
          },
        });
        consola.info(`Updated countdown message for todo ${todoId}`);
      }
      catch (updateError) {
        consola.error(`Failed to update todo ${todoId} with message:`, updateError);
        // Don't throw - we still want to return the generated message
      }
    }

    return {
      message,
      cached,
      generatedAt,
    };
  }
  catch (error) {
    consola.error("Failed to generate countdown message:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to generate countdown message",
    });
  }
});
