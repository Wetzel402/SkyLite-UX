import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

export default defineEventHandler(async () => {
  try {
    // Basic health check - just return OK if the server is running
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
  catch (error) {
    consola.error("Health Check: Error in health check:", error);
    throw createError({
      statusCode: 500,
      message: "Health check failed",
    });
  }
});
