import { defineEventHandler } from "h3";
import { useRuntimeConfig } from "#imports";

export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  const databaseUrl = config.databaseUrl || "";

  let provider: "sqlite" | "postgresql" | "unknown" = "unknown";
  let displayName = "Unknown";
  let location = "";

  if (databaseUrl.startsWith("file:")) {
    provider = "sqlite";
    displayName = "SQLite";
    // Extract file path from DATABASE_URL
    location = databaseUrl.replace("file:", "");
  }
  else if (databaseUrl.startsWith("postgresql://")) {
    provider = "postgresql";
    displayName = "PostgreSQL";
    // Extract host from DATABASE_URL (hide credentials)
    try {
      const url = new URL(databaseUrl);
      location = `${url.host}${url.pathname}`;
    }
    catch {
      location = "configured";
    }
  }
  else if (!databaseUrl) {
    // Default to SQLite when no DATABASE_URL is set
    provider = "sqlite";
    displayName = "SQLite";
    location = "/data/skylite.db (default)";
  }

  return {
    provider,
    displayName,
    location,
  };
});
