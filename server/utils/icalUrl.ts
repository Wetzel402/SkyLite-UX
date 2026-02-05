export function normalizeWebcalUrl(url: string): string {
  if (!url || typeof url !== "string")
    return url;
  const lower = url.toLowerCase();
  if (lower.startsWith("webcal://"))
    return `http://${url.slice(9)}`;
  if (lower.startsWith("webcals://"))
    return `https://${url.slice(10)}`;
  return url;
}
