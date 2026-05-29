export function toCategoryTypesenseDoc(eventData) {
  return {
    id: eventData.id,
    name: eventData.name || "",
    description: eventData.description || "",
    imageUrl: eventData.imageUrl || "",
    createdAt: eventData.createdAt
      ? (() => {
          const ts = Date.parse(eventData.createdAt);
          return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0;
        })()
      : 0,
    updatedAt: eventData.updatedAt
      ? (() => {
          const ts = Date.parse(eventData.updatedAt);
          return Number.isFinite(ts) ? Math.floor(ts / 1000) : 0;
        })()
      : 0,
  };
}
