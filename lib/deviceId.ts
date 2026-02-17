const DEVICE_COOKIE = "pollbox_device";
const DEVICE_TTL_DAYS = 7;

export function getOrCreateDeviceId(): string {
  const existing = readCookie(DEVICE_COOKIE);
  if (existing) return existing;

  const value = crypto.randomUUID();
  const expires = new Date(
    Date.now() + DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toUTCString();
  document.cookie = `${DEVICE_COOKIE}=${value}; expires=${expires}; path=/`;
  return value;
}

function readCookie(name: string): string | null {
  const entries = document.cookie.split(";").map((cookie) => cookie.trim());
  for (const entry of entries) {
    if (entry.startsWith(`${name}=`)) {
      return entry.substring(name.length + 1);
    }
  }
  return null;
}
