import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const pageSize = Math.min(Number(query.pageSize) || 50, 100);

  // Get selected albums
  const albums = await prisma.selectedAlbum.findMany({
    orderBy: { order: 'asc' },
  });

  if (albums.length === 0) {
    return { photos: [], albums: [] };
  }

  // For Photos Picker API, we need to fetch photos client-side
  // This endpoint just returns the album info
  return {
    albums: albums.map(a => ({
      id: a.id,
      albumId: a.albumId,
      title: a.title,
      coverPhotoUrl: a.coverPhotoUrl,
    })),
    photos: [], // Photos fetched client-side with Picker API
  };
});
