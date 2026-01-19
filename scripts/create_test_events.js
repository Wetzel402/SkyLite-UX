/* eslint-disable no-console */
// Script to create 100 test events for performance testing
const baseUrl = "http://localhost:3000/api/calendar-events";

async function createEvents() {
  console.log("Creating 100 test events...");

  for (let i = 1; i <= 100; i++) {
    const day = (i % 28) + 1;
    const hour = (i % 12) + 8; // 8 AM to 7 PM
    const dayStr = day.toString().padStart(2, "0");
    const hourStr = hour.toString().padStart(2, "0");

    const event = {
      title: `Performance Test Event ${i}`,
      description: "Test event for performance testing",
      start: `2026-01-${dayStr}T${hourStr}:00:00.000Z`,
      end: `2026-01-${dayStr}T${(hour + 1).toString().padStart(2, "0")}:00:00.000Z`,
      allDay: false,
    };

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.error(`Failed to create event ${i}: ${response.status}`);
      }

      if (i % 10 === 0) {
        console.log(`Created ${i} events...`);
      }
    }
    catch (error) {
      console.error(`Error creating event ${i}:`, error.message);
    }
  }

  console.log("Done! Created 100 test events.");
}

createEvents();
