export function safeHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url
      : undefined;
  } catch {
    return;
  }
}
