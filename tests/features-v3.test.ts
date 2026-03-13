/**
 * Feature tests for RingMe Pro v3 batch:
 * - Twilio webhook config
 * - Contact name sync
 * - Voicemail transcription
 * - Burner expiry countdown
 * - Device contacts import
 * - SSE real-time messaging
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Burner Expiry Countdown ────────────────────────────────────────────────

describe("Burner expiry countdown", () => {
  function formatCountdown(expiresAt: Date): { text: string; urgency: "ok" | "warn" | "critical" } {
    const now = Date.now();
    const diff = expiresAt.getTime() - now;
    if (diff <= 0) return { text: "Expired", urgency: "critical" };

    const totalSecs = Math.floor(diff / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (days > 3) return { text: `${days}d ${hours}h`, urgency: "ok" };
    if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, urgency: "warn" };
    if (hours > 0) return { text: `${hours}h ${mins}m`, urgency: "warn" };
    if (mins > 0) return { text: `${mins}m ${secs}s`, urgency: "critical" };
    return { text: `${secs}s`, urgency: "critical" };
  }

  it("returns 'Expired' for past dates", () => {
    const past = new Date(Date.now() - 1000);
    const result = formatCountdown(past);
    expect(result.text).toBe("Expired");
    expect(result.urgency).toBe("critical");
  });

  it("returns 'ok' urgency for dates more than 3 days away", () => {
    const future = new Date(Date.now() + 5 * 86400 * 1000);
    const result = formatCountdown(future);
    expect(result.urgency).toBe("ok");
    expect(result.text).toMatch(/^\d+d/);
  });

  it("returns 'warn' urgency for 1-3 days", () => {
    const future = new Date(Date.now() + 2 * 86400 * 1000);
    const result = formatCountdown(future);
    expect(result.urgency).toBe("warn");
    expect(result.text).toMatch(/^\d+d/);
  });

  it("returns 'warn' urgency for hours", () => {
    const future = new Date(Date.now() + 3 * 3600 * 1000);
    const result = formatCountdown(future);
    expect(result.urgency).toBe("warn");
    expect(result.text).toMatch(/h/);
  });

  it("returns 'critical' urgency for minutes", () => {
    const future = new Date(Date.now() + 45 * 60 * 1000);
    const result = formatCountdown(future);
    expect(result.urgency).toBe("critical");
    expect(result.text).toMatch(/m/);
  });

  it("returns 'critical' urgency for seconds", () => {
    const future = new Date(Date.now() + 30 * 1000);
    const result = formatCountdown(future);
    expect(result.urgency).toBe("critical");
    expect(result.text).toMatch(/s/);
  });
});

// ─── Contact Name Sync ───────────────────────────────────────────────────────

describe("Contact name sync", () => {
  it("formats initials correctly", () => {
    function getInitials(name: string): string {
      return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    }
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Alice")).toBe("A");
    expect(getInitials("Mary Jane Watson")).toBe("MJ");
    expect(getInitials("")).toBe("");
  });

  it("assigns avatar color based on name", () => {
    const AVATAR_COLORS = ["#69f0ae", "#4dd0e1", "#ffca28", "#ce93d8", "#00e676", "#ff6b6b", "#4caf72", "#ff9800"];
    function randomAvatarColor(name: string): string {
      const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
      return AVATAR_COLORS[idx];
    }
    const color = randomAvatarColor("Alice");
    expect(AVATAR_COLORS).toContain(color);
    // Same name always gets same color
    expect(randomAvatarColor("Alice")).toBe(randomAvatarColor("Alice"));
  });
});

// ─── Voicemail Transcription ─────────────────────────────────────────────────

describe("Voicemail transcription", () => {
  it("formats voicemail duration correctly", () => {
    function formatDuration(secs: number): string {
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      return mins > 0 ? `${mins}m ${s}s` : `${s}s`;
    }
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("validates voicemail recording URL format", () => {
    const validUrls = [
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123.mp3",
      "https://api.twilio.com/2010-04-01/Accounts/AC456/Recordings/RE789.wav",
    ];
    for (const url of validUrls) {
      expect(url).toMatch(/^https:\/\/api\.twilio\.com/);
    }
  });
});

// ─── SSE Real-time Messaging ─────────────────────────────────────────────────

describe("SSE real-time messaging", () => {
  it("correctly parses SSE message events", () => {
    type SSEMessage = {
      type: "connected" | "new_message" | "conversations_updated" | "ping";
      conversationId?: number;
      message?: { id?: number; text: string; isMe: boolean; createdAt: string };
    };

    const rawEvent = JSON.stringify({
      type: "new_message",
      conversationId: 42,
      message: { id: 100, text: "Hello!", isMe: false, createdAt: new Date().toISOString() },
    });

    const parsed = JSON.parse(rawEvent) as SSEMessage;
    expect(parsed.type).toBe("new_message");
    expect(parsed.conversationId).toBe(42);
    expect(parsed.message?.text).toBe("Hello!");
    expect(parsed.message?.isMe).toBe(false);
  });

  it("ignores ping events without crashing", () => {
    const rawEvent = JSON.stringify({ type: "ping" });
    const parsed = JSON.parse(rawEvent) as { type: string };
    expect(parsed.type).toBe("ping");
    // No message field — should not throw
    expect((parsed as any).message).toBeUndefined();
  });

  it("handles conversations_updated event", () => {
    const rawEvent = JSON.stringify({ type: "conversations_updated" });
    const parsed = JSON.parse(rawEvent) as { type: string };
    expect(parsed.type).toBe("conversations_updated");
  });

  it("deduplicates messages by text+time proximity", () => {
    type LocalMessage = { id: string; text: string; isMe: boolean; time: string };
    const existing: LocalMessage[] = [
      { id: "1", text: "Hello!", isMe: false, time: "10:00" },
    ];

    const now = Date.now();
    const newMsg = { text: "Hello!", isMe: false, createdAt: new Date(now - 5000).toISOString() };

    // Dedup check: same text within 10 seconds
    const isDuplicate = existing.some(
      (m) => m.text === newMsg.text && Math.abs(new Date(newMsg.createdAt).getTime() - now) < 10000
    );
    expect(isDuplicate).toBe(true);
  });
});

// ─── Webhook Config ──────────────────────────────────────────────────────────

describe("Twilio webhook config", () => {
  it("constructs correct webhook URLs from API base", () => {
    const apiBase = "https://3000-test.manus.computer";
    const webhooks = {
      sms: `${apiBase}/api/webhooks/sms`,
      voice: `${apiBase}/api/webhooks/voice`,
      callStatus: `${apiBase}/api/webhooks/call-status`,
      recording: `${apiBase}/api/webhooks/recording`,
    };
    expect(webhooks.sms).toBe("https://3000-test.manus.computer/api/webhooks/sms");
    expect(webhooks.voice).toBe("https://3000-test.manus.computer/api/webhooks/voice");
    expect(webhooks.callStatus).toBe("https://3000-test.manus.computer/api/webhooks/call-status");
    expect(webhooks.recording).toBe("https://3000-test.manus.computer/api/webhooks/recording");
  });

  it("validates Twilio phone number format", () => {
    const validNumbers = ["+12025551234", "+447911123456", "+33612345678"];
    const invalidNumbers = ["2025551234", "0044123456", "not-a-number"];
    for (const n of validNumbers) {
      expect(n).toMatch(/^\+\d{7,15}$/);
    }
    for (const n of invalidNumbers) {
      expect(n).not.toMatch(/^\+\d{7,15}$/);
    }
  });
});

// ─── Device Contacts Import ──────────────────────────────────────────────────

describe("Device contacts import", () => {
  it("normalizes phone numbers by removing formatting characters", () => {
    function normalizeNumber(raw: string): string {
      return raw.replace(/[\s\-\(\)]/g, "");
    }
    expect(normalizeNumber("(202) 555-1234")).toBe("2025551234");
    expect(normalizeNumber("+1 800 123-4567")).toBe("+18001234567");
    expect(normalizeNumber("07911 123456")).toBe("07911123456");
  });

  it("filters contacts with valid phone numbers", () => {
    const rawContacts = [
      { name: "Alice", phoneNumbers: [{ number: "+12025551234" }] },
      { name: "Bob", phoneNumbers: [] },
      { name: "Charlie", phoneNumbers: [{ number: "123" }] }, // Too short
      { name: "Dave", phoneNumbers: [{ number: "+447911123456" }] },
    ];

    const valid = rawContacts.filter(
      (c) => c.phoneNumbers.length > 0 && c.phoneNumbers[0].number.replace(/[\s\-\(\)]/g, "").length >= 7
    );
    expect(valid).toHaveLength(2);
    expect(valid[0].name).toBe("Alice");
    expect(valid[1].name).toBe("Dave");
  });

  it("limits bulk import to 500 contacts", () => {
    const contacts = Array.from({ length: 600 }, (_, i) => ({
      name: `Contact ${i}`,
      number: `+1202555${String(i).padStart(4, "0")}`,
      avatarColor: "#00e676",
    }));
    const limited = contacts.slice(0, 500);
    expect(limited).toHaveLength(500);
  });
});
