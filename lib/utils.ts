import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * FIX 7: Map a phone number to a consistent color from the PixiePop palette.
 * Used for group sender name labels.
 */
const GROUP_COLORS = [
  "#FF6EC7", "#4DFFB4", "#5BC8FF", "#FFE94A", "#C084FC", "#FF7A5C",
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function numberToColor(number: string): string {
  return GROUP_COLORS[hashCode(number) % GROUP_COLORS.length];
}

/**
 * FIX 8: Format call duration in MM:SS format.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format phone number as +1 (555) 123-4567.
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Check if the current time is within a DND window.
 * Handles midnight wraparound (e.g., 22:00-08:00).
 */
export function isInDNDWindow(
  dndEnabled: boolean,
  dndFrom: string,
  dndUntil: string,
  now?: Date
): boolean {
  if (!dndEnabled) return false;
  const current = now ?? new Date();
  const currentMinutes = current.getHours() * 60 + current.getMinutes();
  const [fromH, fromM] = dndFrom.split(":").map(Number);
  const [untilH, untilM] = dndUntil.split(":").map(Number);
  const fromMinutes = fromH * 60 + fromM;
  const untilMinutes = untilH * 60 + untilM;

  if (fromMinutes <= untilMinutes) {
    // Same day window (e.g., 09:00-17:00)
    return currentMinutes >= fromMinutes && currentMinutes < untilMinutes;
  } else {
    // Midnight wraparound (e.g., 22:00-08:00)
    return currentMinutes >= fromMinutes || currentMinutes < untilMinutes;
  }
}

/**
 * Format a burner countdown from an expiry date.
 */
export function formatBurnerCountdown(expiresAt: Date | string | null): string {
  if (!expiresAt) return "Permanent";
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
}

/**
 * Get message status indicator text.
 */
export function getStatusIndicator(status: "sent" | "delivered" | "read"): string {
  switch (status) {
    case "sent": return "✓";
    case "delivered": return "✓✓";
    case "read": return "✓✓";
  }
}
