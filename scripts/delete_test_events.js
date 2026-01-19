/* eslint-disable no-console */
// Script to delete all performance test events
const baseUrl = "http://localhost:3000/api/calendar-events";

async function deleteEvents() {
  console.log("Fetching events to delete...");

  try {
    const response = await fetch(baseUrl);
    const events = await response.json();

    const testEvents = events.filter(e => e.title.startsWith("Performance Test Event"));
    console.log(`Found ${testEvents.length} test events to delete`);

    for (const event of testEvents) {
      try {
        await fetch(`${baseUrl}/${event.id}`, { method: "DELETE" });
      }
      catch (error) {
        console.error(`Error deleting event ${event.id}:`, error.message);
      }
    }

    console.log("Done! Deleted all test events.");
  }
  catch (error) {
    console.error("Error:", error.message);
  }
}

deleteEvents();
