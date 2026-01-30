---
title: Countdown Events
layout: default
parent: Features
nav_order: 4
---

# Countdown Events

{: .no_toc }

Display upcoming special events on your home screen with AI-generated whimsical messages. Perfect for birthdays, holidays, vacations, and other family milestones.

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Overview

The Countdown feature allows you to:

- Mark special todos as "countdown events"
- Display the earliest upcoming countdown prominently on the home screen
- See AI-generated whimsical messages that change daily
- View days remaining in a beautiful gradient widget
- Quickly navigate to your todo lists by clicking the widget

---

## Creating a Countdown Event

### From Todo Lists Page

1. Navigate to **Todo Lists** page
2. Create a new todo or edit an existing one
3. Set a **due date** for the event
4. Check the **"Mark as Countdown Event"** checkbox
5. Save the todo

The countdown will now appear on the home screen if it's the earliest upcoming countdown event with a future due date.

### Requirements

- The todo must have a **due date** set
- The due date must be **today or in the future**
- The todo must **not be completed**
- The **isCountdown** field must be set to true

---

## Home Screen Display

### Widget Appearance

The countdown widget features:

- **Gradient Background** - Beautiful purple-to-pink gradient
- **Event Name** - Large, bold display of the event title
- **Days Remaining** - Huge number showing countdown
  - Shows "TODAY" if the event is today
  - Shows number of days for future events
- **AI Message** - Whimsical, family-friendly message (if Gemini API is configured)

### Visibility

The countdown widget is displayed when:

- The countdown feature is **enabled in Settings**
- At least one countdown event exists
- The earliest countdown has a due date today or in the future

To toggle the widget:

1. Go to **Settings** → **Home Screen**
2. Toggle **"Countdown"** under **Visible Widgets**

---

## AI-Generated Messages

### Gemini Integration (Optional)

Countdown messages can be generated using **Google Gemini 1.5 Flash** (free tier):

- **Creative Messages** - Whimsical, family-friendly messages
- **Context-Aware** - Different messages for "today", "tomorrow", and future dates
- **Daily Refresh** - Messages regenerate every 24 hours
- **Automatic Caching** - Reduces API calls

### Setup Gemini API (Optional)

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a free API key
3. Add to your `.env` file:
   ```dotenv
   NUXT_GEMINI_API_KEY=your_api_key_here
   ```
4. Restart Skylite UX

### Fallback Messages

If Gemini is not configured, the system uses simple fallback messages:

- **Today**: "Today is the day! [Event] is here!"
- **Tomorrow**: "Only 1 day until [Event]!"
- **Future**: "Only X days until [Event]!"

---

## Message Caching

### How It Works

- Messages are cached for **24 hours** after generation
- Cached messages are stored in the database with the todo
- Widget refreshes use cached messages when available
- New messages generate automatically after 24 hours

### Benefits

- Reduces API calls to Gemini (respects free tier limits)
- Faster page loads (no API waiting time)
- Still provides daily variety

### Manual Refresh

To force a new message generation:

- Wait 24 hours for automatic refresh
- Or update the todo (which clears the cache)

---

## Widget Refresh Interval

The countdown widget refreshes based on your **Home Screen** settings:

1. Go to **Settings** → **Home Screen**
2. Adjust **Data Refresh Interval** (default: 6 hours)
3. The countdown widget will refresh at this interval

**Note**: Even with frequent refreshes, AI messages only regenerate once per 24 hours to reduce API usage.

---

## Multiple Countdowns

### Priority Display

If you have multiple countdown events:

- Only the **earliest upcoming event** is displayed on the home screen
- Events are automatically sorted by due date
- Completed events are excluded
- Past events are excluded

### Managing Multiple Events

- Create as many countdown todos as you like
- All active countdowns are tracked
- The widget automatically updates when dates change
- Completing a countdown reveals the next one

---

## Examples

### Birthday Countdown

```text
Title: "Emma's 10th Birthday"
Due Date: March 15, 2026
isCountdown: ✓ Yes

Home Display:
┌─────────────────────────────┐
│  Emma's 10th Birthday       │
│                             │
│         42                  │
│      days to go             │
│                             │
│ "The party planning can     │
│  officially begin! 🎉"      │
└─────────────────────────────┘
```

### Vacation Countdown

```text
Title: "Disney World Trip"
Due Date: July 20, 2026
isCountdown: ✓ Yes

Home Display (when tomorrow):
┌─────────────────────────────┐
│    Disney World Trip        │
│                             │
│          1                  │
│       day to go             │
│                             │
│ "Pack those bags and get    │
│  ready for magic! ✨"       │
└─────────────────────────────┘
```

### Event Day

```text
Title: "First Day of School"
Due Date: Today
isCountdown: ✓ Yes

Home Display:
┌─────────────────────────────┐
│   First Day of School       │
│                             │
│        TODAY                │
│                             │
│                             │
│ "Rise and shine! Today's    │
│  the big day! 📚"          │
└─────────────────────────────┘
```

---

## Technical Details

### Database Fields

Each todo has three countdown-specific fields:

- `isCountdown` (Boolean) - Marks the todo as a countdown event
- `countdownMessage` (String, nullable) - Cached AI-generated message
- `messageGeneratedAt` (DateTime, nullable) - When the message was last generated

### API Endpoints

- **GET** `/api/todos/countdowns` - Fetch all active countdown events
- **POST** `/api/ai/generate-countdown-message` - Generate a new AI message

### Performance

- Messages cached in database for 24 hours
- Widget refreshes use cached data when available
- Minimal API calls to Gemini (1 per event per day maximum)

---

## Troubleshooting

### Widget Not Showing

**Check:**

1. Is the countdown feature enabled in Settings?
2. Do you have at least one countdown todo?
3. Does the countdown have a due date set?
4. Is the due date today or in the future?
5. Is the todo marked as not completed?

### No AI Messages

**Check:**

1. Is `NUXT_GEMINI_API_KEY` set in your `.env` file?
2. Is the API key valid? Test at [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Check server logs for API errors

**Fallback:**
The system automatically uses fallback messages if Gemini is unavailable.

### Message Not Updating

- Messages refresh every 24 hours
- Check the current time vs. `messageGeneratedAt` in the database
- Force refresh by updating the todo

---

## Best Practices

### Event Selection

- Use countdowns for **special occasions** only
- Limit to 3-5 active countdowns to avoid clutter
- Complete past countdowns to keep the list clean

### Event Names

- Keep names concise and clear
- Use specific names: "Emma's Birthday" vs. "Birthday"
- Avoid special characters that might confuse the AI

### Due Dates

- Set the due date to the **day of the event**, not the day before
- Use consistent time zones
- Verify dates before marking as countdown

### API Usage

- One free Gemini API key per Google account
- Free tier includes generous daily limits
- Messages cache for 24 hours to respect limits
- Fallback messages work without API key

---

## Privacy & Security

- Gemini API calls are made from your server, not the client
- Event names are sent to Google's API for message generation
- No personal information is shared beyond event names
- Messages are stored locally in your database
- API key is stored server-side only (never exposed to clients)

---

## Future Enhancements

Potential improvements for future versions:

- Display multiple countdowns (top 3)
- Custom user-written messages (override AI)
- Countdown categories (birthdays, holidays, etc.)
- Countdown history/archive
- Family sharing of specific countdowns
- Push notifications at milestones (1 week, 1 day, etc.)
- Alternative AI models (Claude, ChatGPT)
- Customizable message styles and tones
