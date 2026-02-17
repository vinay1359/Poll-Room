import UAParser from "ua-parser-js";

export function buildFingerprint(): string {
  const parser = new UAParser();
  const result = parser.getResult();
  const nav = navigator as Navigator & { deviceMemory?: number };

  const parts = [
    result.browser.name,
    result.browser.version,
    result.os.name,
    result.os.version,
    navigator.language,
    String(navigator.hardwareConcurrency ?? 0),
    String(nav.deviceMemory ?? 0),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ];

  return parts.filter(Boolean).join("|");
}
