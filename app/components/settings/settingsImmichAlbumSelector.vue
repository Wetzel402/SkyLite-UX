<script setup lang="ts">
import type { ImmichAlbum } from "~/integrations/immich/immichPhotos";

const props = defineProps<{
  integrationId: string;
  selectedAlbums?: string[];
}>();

const emit = defineEmits<{
  (e: "albumsSelected", albumIds: string[]): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const albums = ref<ImmichAlbum[]>([]);
const selectedAlbumIds = ref<string[]>(props.selectedAlbums || []);

// Watch for prop changes
watch(() => props.selectedAlbums, (newVal) => {
  if (newVal) {
    selectedAlbumIds.value = [...newVal];
  }
}, { immediate: true });

// Fetch albums on mount
onMounted(async () => {
  await fetchAlbums();
});

async function fetchAlbums() {
  if (!props.integrationId) {
    error.value = "Integration ID is required";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await $fetch<{ albums: ImmichAlbum[] }>(
      "/api/integrations/immich/albums",
      {
        query: { integrationId: props.integrationId },
      },
    );
    albums.value = response.albums;
  }
  catch (err) {
    console.error("Failed to fetch Immich albums:", err);
    error.value = err instanceof Error ? err.message : "Failed to fetch albums from Immich";
  }
  finally {
    loading.value = false;
  }
}

function toggleAlbum(albumId: string) {
  const index = selectedAlbumIds.value.indexOf(albumId);
  if (index === -1) {
    selectedAlbumIds.value.push(albumId);
  }
  else {
    selectedAlbumIds.value.splice(index, 1);
  }
  emit("albumsSelected", selectedAlbumIds.value);
}

function isSelected(albumId: string): boolean {
  return selectedAlbumIds.value.includes(albumId);
}

function selectAll() {
  selectedAlbumIds.value = albums.value.map(a => a.id);
  emit("albumsSelected", selectedAlbumIds.value);
}

function deselectAll() {
  selectedAlbumIds.value = [];
  emit("albumsSelected", selectedAlbumIds.value);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium text-highlighted">
        Select Albums for Screensaver
      </label>
      <div class="flex gap-2">
        <UButton
          v-if="albums.length > 0"
          size="xs"
          variant="ghost"
          @click="selectAll"
        >
          Select All
        </UButton>
        <UButton
          v-if="selectedAlbumIds.length > 0"
          size="xs"
          variant="ghost"
          @click="deselectAll"
        >
          Clear
        </UButton>
      </div>
    </div>

    <p class="text-sm text-muted">
      Choose which Immich albums to use for the screensaver slideshow.
    </p>

    <div
      v-if="error"
      role="alert"
      class="bg-error/10 text-error rounded-md px-3 py-2 text-sm flex items-center gap-2"
    >
      <UIcon name="i-lucide-alert-circle" class="h-4 w-4 flex-shrink-0" />
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto mb-3 text-primary" />
      <p class="text-sm text-muted">
        Loading albums from Immich...
      </p>
    </div>

    <div v-else-if="albums.length === 0 && !error" class="text-center py-8">
      <UIcon name="i-lucide-folder-open" class="h-12 w-12 mx-auto mb-3 text-muted" />
      <p class="text-sm text-muted">
        No albums found in your Immich library.
      </p>
      <p class="text-xs text-muted mt-1">
        Create albums in Immich to use them here.
      </p>
    </div>

    <div v-else class="max-h-64 overflow-y-auto border border-default rounded-lg divide-y divide-default">
      <div
        v-for="album in albums"
        :key="album.id"
        class="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors cursor-pointer"
        @click="toggleAlbum(album.id)"
      >
        <UCheckbox
          :model-value="isSelected(album.id)"
          @update:model-value="toggleAlbum(album.id)"
          @click.stop
        />
        <div class="flex-1 min-w-0">
          <p class="font-medium text-highlighted truncate">
            {{ album.title }}
          </p>
          <p class="text-xs text-muted">
            {{ album.assetCount }} {{ album.assetCount === 1 ? 'photo' : 'photos' }}
            <span v-if="album.shared" class="ml-2 text-info">
              <UIcon name="i-lucide-users" class="h-3 w-3 inline" /> Shared
            </span>
          </p>
        </div>
      </div>
    </div>

    <div v-if="selectedAlbumIds.length > 0" class="text-sm text-muted">
      {{ selectedAlbumIds.length }} {{ selectedAlbumIds.length === 1 ? 'album' : 'albums' }} selected
    </div>
  </div>
</template>
