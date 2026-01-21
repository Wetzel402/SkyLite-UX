---
title: Home Screen
layout: default
parent: Features
nav_order: 1
---

# Home Screen (Screensaver)
{: .no_toc }

The Home Screen serves as an ambient display and screensaver for your Skylite UX installation. It provides an at-a-glance view of your family's day with beautiful photo backgrounds and interactive widgets.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

The Home Screen displays:
- **Photo Slideshow** - Rotating photos from your Google Photos albums with Ken Burns effect
- **Clock & Date** - Current time and date display
- **Weather** - Current conditions and 7-day forecast
- **Today's Menu** - All meals planned for today (breakfast, lunch, dinner)
- **Upcoming Events** - Next 5 events from your Google Calendar
- **Today's Tasks** - Tasks due today or without due dates

All widgets are clickable and navigate to their respective pages for more details.

---

## Photo Slideshow

### Features
- Displays photos from selected Google Photos albums
- Smooth Ken Burns effect (pan and zoom animation)
- Configurable transition speed (5-60 seconds)
- Adjustable animation intensity

### Setup
1. Go to **Settings** → **Integrations** → **Google Photos**
2. Authenticate with your Google account
3. Select albums to display in the slideshow
4. Configure transition speed and Ken Burns intensity in **Settings** → **Home Page**

### Configuration Options
- **Photos Enabled** - Toggle photo slideshow on/off
- **Transition Speed** - How long each photo displays (5-60 seconds)
- **Ken Burns Intensity** - Animation speed (0.5x - 2.0x)

---

## Clock Widget

### Features
- Large, easy-to-read time display
- Current date with day of week
- 12-hour format with AM/PM

### Configuration
- **Clock Enabled** - Toggle clock display on/off (Settings → Home Page)

---

## Weather Widget

### Features
- Current temperature and conditions
- Weather icon matching current conditions
- 7-day forecast with daily high temperatures
- Clickable to navigate to Settings for configuration

### Weather Icons
- ☀️ Clear sky
- ⛅ Partly cloudy
- 🌫️ Foggy
- 🌧️ Rain
- 🌨️ Snow
- ⛈️ Thunderstorm

### Setup
1. Go to **Settings** → **Home Page** → **Weather Widget**
2. Enable the weather widget
3. Enter your latitude and longitude
4. Select temperature unit (Celsius or Fahrenheit)

The widget fetches data from Open-Meteo API (free, no API key required).

---

## Today's Menu Widget

### Features
- Displays all meals planned for today
- Meal type icons:
  - 🍳 Breakfast
  - 🥗 Lunch
  - 🍽️ Dinner
- Sorted chronologically (breakfast → lunch → dinner)
- Shows "No meals planned" when empty
- Clickable to navigate to Meal Planner

### Setup
1. Create meal plans in **Meal Planner**
2. Enable widget in **Settings** → **Home Page** → **Today's Menu**
3. Widget automatically shows meals for current day

---

## Upcoming Events Widget

### Features
- Shows next 5 upcoming events from Google Calendar
- Displays event time and title
- Smart date formatting:
  - Events today: "2:30 PM"
  - Future events: "Jan 25, 2:30 PM"
- Shows "No upcoming events" when empty
- Clickable to navigate to Calendar

### Setup
1. Configure Google Calendar integration in **Settings** → **Integrations**
2. Select which calendars to sync
3. Enable widget in **Settings** → **Home Page** → **Upcoming Events**

Events are fetched directly from Google Calendar (no database sync required).

---

## Today's Tasks Widget

### Features
- Shows up to 5 tasks due today or without due dates
- Right-aligned for visual balance
- Shows "No tasks for today" when empty
- Clickable to navigate to To-Do Lists

### Setup
1. Create tasks in **To-Do Lists**
2. Set due dates (or leave blank for "always show")
3. Enable widget in **Settings** → **Home Page** → **Today's Tasks**

---

## Widget Visibility

All widgets have semi-transparent dark backgrounds with blur effects to ensure text readability on both light and dark photos. Backgrounds become slightly darker on hover to indicate interactivity.

### Background Effects
- **Base**: 30% black opacity with backdrop blur
- **Hover**: 40% black opacity (on clickable widgets)
- **Result**: Text remains readable regardless of photo brightness

---

## Navigation

Each widget is clickable and navigates to its related page:

| Widget | Destination |
|--------|-------------|
| Clock | (Not clickable) |
| Weather | Settings (weather configuration) |
| Today's Menu | Meal Planner |
| Upcoming Events | Calendar |
| Today's Tasks | To-Do Lists |

---

## Widget Configuration

Go to **Settings** → **Home Page** to configure all widgets:

1. **Photo Slideshow**
   - Enable/disable slideshow
   - Select Google Photos albums
   - Adjust transition speed (5-60 seconds)
   - Set Ken Burns intensity (0-2x)

2. **Weather Widget**
   - Enable/disable widget
   - Set location (latitude/longitude)
   - Choose temperature unit (Celsius/Fahrenheit)

3. **Data Refresh Interval**
   - Set how often data widgets refresh (0.25-6 hours)
   - Applies to: weather, events, tasks, and menu
   - Default: 1 hour

4. **Widget Visibility**
   - Clock: Enable/disable display
   - Events: Enable/disable widget
   - Todos: Enable/disable widget
   - Meals: Enable/disable widget

---

## Auto-Refresh Intervals

Widgets automatically refresh to keep data current:

| Widget | Refresh Interval |
|--------|------------------|
| Clock | 1 second (fixed) |
| Photos | Configured transition speed |
| Weather | Configurable (default: 1 hour) |
| Events | Configurable (default: 1 hour) |
| Tasks | Configurable (default: 1 hour) |
| Menu | Configurable (default: 1 hour) |

### Configuring Refresh Interval

Data widgets (weather, events, tasks, menu) share a common refresh interval that can be configured in **Settings** → **Home Page** → **Data Refresh Interval**.

- **Range**: 15 minutes (0.25 hours) to 6 hours
- **Default**: 1 hour
- **Purpose**: Controls how frequently the home screen fetches new data from APIs

Shorter intervals provide more up-to-date information but increase API calls and network usage. Longer intervals reduce load but data may be less current.

---

## Troubleshooting

### Photos Not Showing
- Verify Google Photos integration is configured in Settings
- Ensure at least one album is selected
- Check that selected albums contain photos

### Weather Not Displaying
- Verify latitude and longitude are entered correctly in Settings
- Check that Weather Widget is enabled
- Ensure internet connection is active

### Events Not Appearing
- Verify Google Calendar integration is configured
- Check that calendars are selected in integration settings
- Ensure events exist in the future (past events are filtered)

### Menu Shows "No meals planned"
- Verify meals are created in Meal Planner for today
- Check that Today's Menu widget is enabled
- Ensure meal plan week includes today's date

### Tasks Not Showing
- Verify tasks exist in To-Do Lists
- Check that tasks are not marked as completed
- Ensure tasks have today's due date or no due date

---

## Technical Details

### Date Handling
All date comparisons use UTC to avoid timezone issues. Meals and events are correctly matched to the current day regardless of server timezone.

### API Endpoints
- **Weather**: `/api/weather` (Open-Meteo)
- **Events**: `/api/integrations/google_calendar/events`
- **Tasks**: `/api/todos`
- **Menu**: `/api/meals/byDateRange`

### Performance
- Widget data is cached client-side between refresh intervals
- Photos preload during transitions for smooth slideshow
- API calls are debounced to prevent excessive requests

---

## Best Practices

1. **Photo Selection**
   - Choose albums with landscape-oriented photos for best display
   - Mix light and dark photos for visual variety
   - Avoid albums with text-heavy images

2. **Widget Balance**
   - Disable unused widgets to reduce clutter
   - Consider screen size when enabling all widgets
   - Test readability at viewing distance

3. **Refresh Rates**
   - Keep default refresh intervals for optimal performance
   - Slower photo transitions are more relaxing
   - Weather updates every 10 minutes provide current data

4. **Location**
   - Place device where ambient display is visible
   - Avoid direct sunlight to prevent glare
   - Consider mounting on wall for dedicated display
