<script setup lang="ts">
import { onMounted, ref } from "vue";

const logs = ref<Array<{ time: string; type: string; message: string }>>([]);
const isVisible = ref(true);
const isExpanded = ref(false);

// Store original console methods for cleanup
let originalLog: typeof console.log;
let originalError: typeof console.error;
let originalWarn: typeof console.warn;

onMounted(() => {
  // Intercept console methods
  originalLog = console.log;
  originalError = console.error;
  originalWarn = console.warn;

  const addLog = (type: string, args: any[]) => {
    const message = args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : String(arg),
    ).join(" ");

    const time = new Date().toLocaleTimeString();
    logs.value.push({ time, type, message });

    // Keep only last 50 logs
    if (logs.value.length > 50) {
      logs.value = logs.value.slice(-50);
    }
  };

  console.log = function (...args) {
    addLog("log", args);
    originalLog.apply(console, args);
  };

  console.error = function (...args) {
    addLog("error", args);
    originalError.apply(console, args);
  };

  console.warn = function (...args) {
    addLog("warn", args);
    originalWarn.apply(console, args);
  };

  console.log("[DebugLogger] Initialized");
});

onUnmounted(() => {
  // Restore original console methods to prevent stacking interceptors
  if (originalLog)
    console.log = originalLog;
  if (originalError)
    console.error = originalError;
  if (originalWarn)
    console.warn = originalWarn;
});

function copyLogs() {
  const text = logs.value.map(log => `[${log.time}] ${log.type.toUpperCase()}: ${log.message}`).join("\n");
  navigator.clipboard.writeText(text);
  alert("Logs copied to clipboard!");
}

function clearLogs() {
  logs.value = [];
  console.log("[DebugLogger] Logs cleared");
}
</script>

<template>
  <div v-if="isVisible" class="fixed bottom-0 left-0 right-0 z-[9999] bg-black text-white font-mono text-xs">
    <div class="flex items-center justify-between p-2 bg-gray-900 border-t-2 border-yellow-500">
      <div class="flex items-center gap-2">
        <button
          class="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
          @click="isExpanded = !isExpanded"
        >
          {{ isExpanded ? '▼' : '▲' }} Debug Logger ({{ logs.length }})
        </button>
        <button
          class="px-2 py-1 bg-blue-600 rounded hover:bg-blue-500"
          @click="copyLogs"
        >
          Copy
        </button>
        <button
          class="px-2 py-1 bg-red-600 rounded hover:bg-red-500"
          @click="clearLogs"
        >
          Clear
        </button>
      </div>
      <button
        class="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
        @click="isVisible = false"
      >
        ✕
      </button>
    </div>

    <div
      v-if="isExpanded"
      class="overflow-y-auto bg-gray-950 p-2 space-y-0.5"
      style="max-height: 40vh;"
    >
      <div
        v-for="(log, index) in logs"
        :key="index"
        :class="{
          'text-red-400': log.type === 'error',
          'text-yellow-400': log.type === 'warn',
          'text-green-400': log.type === 'log',
        }"
      >
        <span class="text-gray-500">[{{ log.time }}]</span>
        <span class="text-gray-400 ml-1">[{{ log.type }}]</span>
        <span class="ml-1">{{ log.message }}</span>
      </div>

      <div v-if="logs.length === 0" class="text-gray-500 italic">
        No logs yet...
      </div>
    </div>
  </div>
</template>
