<script setup lang="ts">
import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  event: CalendarEvent;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  onMouseDown?: (e: MouseEvent) => void;
  onTouchStart?: (e: TouchEvent) => void;
  view: string;
  currentDay?: Date;
}>();

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
  (e: "mousedown", event: MouseEvent): void;
  (e: "touchstart", event: TouchEvent): void;
}>();

const { getStableDate, parseStableDate } = useStableDate();

const displayStart = computed(() => {
  if (props.event.start instanceof Date) {
    return props.event.start;
  }
  const dateString = props.event.start;
  if (typeof dateString === "string") {
    return parseStableDate(dateString);
  }
  return getStableDate();
});

const displayEnd = computed(() => {
  if (props.event.end instanceof Date) {
    return props.event.end;
  }
  const dateString = props.event.end;
  if (typeof dateString === "string") {
    return parseStableDate(dateString);
  }
  return getStableDate();
});

const { getEventColorClasses } = useCalendar();

const eventColorClasses = computed(() => {
  return getEventColorClasses(props.event.color);
});

const eventUsers = computed(() => props.event.users || []);

const isAllDay = computed(() => {
  if (props.event.allDay) {
    return true;
  }

  const startHours = displayStart.value.getHours();
  const startMinutes = displayStart.value.getMinutes();
  const endHours = displayEnd.value.getHours();
  const endMinutes = displayEnd.value.getMinutes();

  return startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0;
});

const isSameDateTime = computed(() => {
  if (isAllDay.value) {
    return false;
  }

  return displayStart.value.getTime() === displayEnd.value.getTime();
});

function isPast(date: Date) {
  return date < getStableDate();
}

function isEventPast(event: CalendarEvent): boolean {
  const endDate = event.end instanceof Date ? event.end : parseStableDate(event.end);
  return isPast(endDate);
}

function handleClick(e: MouseEvent) {
  emit("click", e);
  props.onClick?.(e);
}

function handleMouseDown(e: MouseEvent) {
  emit("mousedown", e);
  props.onMouseDown?.(e);
}

function handleTouchStart(e: TouchEvent) {
  emit("touchstart", e);
  props.onTouchStart?.(e);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === " ") {
    handleClick(e as unknown as MouseEvent);
  }
}
</script>

<template>
  <div
    class="focus-visible:border-ring focus-visible:ring-ring/50 flex w-full flex-col gap-1 rounded p-2 text-left transition outline-none focus-visible:ring-[3px] data-past-event:line-through data-past-event:opacity-90 cursor-pointer"
    :class="typeof eventColorClasses === 'string' ? eventColorClasses : className"
    v-bind="typeof eventColorClasses === 'object' && eventColorClasses !== null ? eventColorClasses : undefined"
    :data-past-event="isEventPast(event) || undefined"
    tabindex="0"
    role="button"
    :aria-label="`Calendar event: ${event.title}`"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @touchstart.passive="handleTouchStart"
    @keydown="handleKeydown"
  >
    <div v-show="view === 'month'">
      <div class="flex items-center justify-between">
        <span class="truncate flex-1" :title="event.title">
          {{ event.title }}
        </span>
      </div>
    </div>
    <div v-show="view === 'week'">
      <div class="font-medium text-sm truncate" :title="event.title">
        {{ event.title }}
      </div>
      <div class="flex items-center justify-between gap-2 mt-1 min-h-[1.25rem]">
        <div class="text-xs opacity-70">
          <template v-if="isAllDay">
            All day
          </template>
          <template v-else>
            <NuxtTime
              :datetime="displayStart"
              hour="numeric"
              minute="2-digit"
              :hour12="true"
            />
            <template v-if="!isSameDateTime">
              - <NuxtTime
                :datetime="displayEnd"
                hour="numeric"
                minute="2-digit"
                :hour12="true"
              />
            </template>
          </template>
        </div>
        <div class="flex-shrink-0 h-5 flex items-center">
          <UAvatarGroup
            v-if="eventUsers.length > 0"
            size="xs"
            :max="4"
            :ui="{
              base: 'relative ring-0 border-0 shadow-none outline-none first:me-0',
            }"
          >
            <UAvatar
              v-for="user in eventUsers"
              :key="user.id"
              :src="user.avatar || undefined"
              :alt="user.name"
              :ui="{
                root: 'relative ring-0 border-0 shadow-none outline-none',
                image: 'object-cover ring-0 border-0 shadow-none',
                fallback: 'ring-0 border-0 shadow-none',
              }"
            />
          </UAvatarGroup>
        </div>
      </div>
    </div>
    <div v-show="view === 'day'">
      <div class="text-sm font-medium truncate" :title="event.title">
        {{ event.title }}
      </div>
      <div class="flex items-end justify-between mt-1">
        <div class="flex-1">
          <div class="text-xs opacity-70">
            <template v-if="isAllDay">
              <span>All day</span>
            </template>
            <template v-else>
              <span class="uppercase">
                <NuxtTime
                  :datetime="displayStart"
                  hour="numeric"
                  minute="2-digit"
                  :hour12="true"
                />
                <template v-if="!isSameDateTime">
                  - <NuxtTime
                    :datetime="displayEnd"
                    hour="numeric"
                    minute="2-digit"
                    :hour12="true"
                  />
                </template>
              </span>
            </template>
            <template v-if="event.location">
              <span class="px-1 opacity-35"> · </span>
              <span>{{ event.location }}</span>
            </template>
          </div>
          <div v-if="event.description" class="my-1 text-xs opacity-90">
            {{ event.description }}
          </div>
        </div>
        <UAvatarGroup
          v-if="eventUsers.length > 0"
          size="xs"
          :max="6"
          class="ml-3"
          :ui="{
            base: 'relative ring-0 border-0 shadow-none outline-none first:me-0',
          }"
        >
          <UAvatar
            v-for="user in eventUsers"
            :key="user.id"
            :src="user.avatar || undefined"
            :alt="user.name"
            :ui="{
              root: 'relative ring-0 border-0 shadow-none outline-none',
              image: 'object-cover ring-0 border-0 shadow-none',
              fallback: 'ring-0 border-0 shadow-none',
            }"
          />
        </UAvatarGroup>
      </div>
    </div>
    <div v-show="view === 'agenda'">
      <div class="text-sm font-medium truncate" :title="event.title">
        {{ event.title }}
      </div>
      <div class="flex items-end justify-between mt-1">
        <div class="flex-1">
          <div class="text-xs opacity-70">
            <template v-if="isAllDay">
              <span>All day</span>
            </template>
            <template v-else>
              <span class="uppercase">
                <NuxtTime
                  :datetime="displayStart"
                  hour="numeric"
                  minute="2-digit"
                  :hour12="true"
                />
                <template v-if="!isSameDateTime">
                  - <NuxtTime
                    :datetime="displayEnd"
                    hour="numeric"
                    minute="2-digit"
                    :hour12="true"
                  />
                </template>
              </span>
            </template>
            <template v-if="event.location">
              <span class="px-1 opacity-35"> · </span>
              <span>{{ event.location }}</span>
            </template>
          </div>
          <div v-if="event.description" class="my-1 text-xs opacity-90">
            {{ event.description }}
          </div>
        </div>
        <UAvatarGroup
          v-if="eventUsers.length > 0"
          size="md"
          :max="8"
          class="ml-3"
          :ui="{
            base: 'relative ring-0 border-0 shadow-none outline-none first:me-0',
          }"
        >
          <UAvatar
            v-for="user in eventUsers"
            :key="user.id"
            :src="user.avatar || undefined"
            :alt="user.name"
            :ui="{
              root: 'relative ring-0 border-0 shadow-none outline-none',
              image: 'object-cover ring-0 border-0 shadow-none',
              fallback: 'ring-0 border-0 shadow-none',
            }"
          />
        </UAvatarGroup>
      </div>
    </div>
  </div>
</template>
