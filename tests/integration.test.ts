/**
 * Integration tests for RingMe Pro — Twilio, AI, and Push Notification features.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Twilio SMS Helper ────────────────────────────────────────────────────────

describe("Twilio SMS Helper", () => {
  it("exports TWILIO_PHONE_NUMBER", async () => {
    const { TWILIO_PHONE_NUMBER } = await import("../server/twilio");
    expect(typeof TWILIO_PHONE_NUMBER).toBe("string");
  });

  it("getTwilioClient returns null when credentials missing", async () => {
    const originalSid = process.env.TWILIO_ACCOUNT_SID;
    const originalToken = process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;

    // Re-import to get fresh module
    vi.resetModules();
    const { getTwilioClient } = await import("../server/twilio");
    const client = getTwilioClient();
    expect(client).toBeNull();

    process.env.TWILIO_ACCOUNT_SID = originalSid;
    process.env.TWILIO_AUTH_TOKEN = originalToken;
    vi.resetModules();
  });

  it("generateInboundCallTwiML returns valid TwiML XML", async () => {
    vi.resetModules();
    const { generateInboundCallTwiML } = await import("../server/twilio");
    const twiml = generateInboundCallTwiML();
    expect(twiml).toContain("<?xml");
    expect(twiml).toContain("<Response>");
    expect(twiml).toContain("</Response>");
  });

  it("generateOutboundCallTwiML includes the destination number", async () => {
    vi.resetModules();
    const { generateOutboundCallTwiML } = await import("../server/twilio");
    const twiml = generateOutboundCallTwiML("+15551234567");
    expect(twiml).toContain("+15551234567");
    expect(twiml).toContain("<Dial");
  });

  it("validateTwilioSignature returns false when authToken missing", async () => {
    const originalToken = process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_AUTH_TOKEN;
    vi.resetModules();
    const { validateTwilioSignature } = await import("../server/twilio");
    const result = validateTwilioSignature("sig", "https://example.com", {});
    expect(result).toBe(false);
    process.env.TWILIO_AUTH_TOKEN = originalToken;
    vi.resetModules();
  });
});

// ─── Push Notification Helper ─────────────────────────────────────────────────

describe("Push Notification Helper", () => {
  it("sendPushNotifications skips empty token list", async () => {
    const { sendPushNotifications } = await import("../server/push-notifications");
    // Should not throw
    await expect(
      sendPushNotifications([], { title: "Test", body: "Test body" })
    ).resolves.toBeUndefined();
  }, 15000);

  it("sendPushNotifications filters invalid tokens", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }] }),
    } as Response);

    const { sendPushNotifications } = await import("../server/push-notifications");
    await sendPushNotifications(
      ["ExponentPushToken[valid-token]", "invalid-token"],
      { title: "Test", body: "Test" }
    );

    // Should only send to valid token
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body).toHaveLength(1);
    expect(body[0].to).toBe("ExponentPushToken[valid-token]");
    fetchSpy.mockRestore();
  });

  it("sendInboundSMSNotification sends correct notification data", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }] }),
    } as Response);

    const { sendInboundSMSNotification } = await import("../server/push-notifications");
    await sendInboundSMSNotification(
      ["ExponentPushToken[abc123]"],
      "+15551234567",
      "Hello there!",
      42
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body[0].title).toContain("+15551234567");
    expect(body[0].body).toBe("Hello there!");
    expect(body[0].data.type).toBe("inbound_sms");
    expect(body[0].data.conversationId).toBe(42);
    fetchSpy.mockRestore();
  });

  it("sendInboundCallNotification sends correct notification data", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }] }),
    } as Response);

    const { sendInboundCallNotification } = await import("../server/push-notifications");
    await sendInboundCallNotification(
      ["ExponentPushToken[abc123]"],
      "+15559876543",
      "CA1234567890abcdef"
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body[0].title).toBe("Incoming Call");
    expect(body[0].body).toContain("+15559876543");
    expect(body[0].data.type).toBe("inbound_call");
    expect(body[0].data.callSid).toBe("CA1234567890abcdef");
    fetchSpy.mockRestore();
  });

  it("handles Expo push API errors gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const { sendPushNotifications } = await import("../server/push-notifications");
    // Should not throw
    await expect(
      sendPushNotifications(
        ["ExponentPushToken[abc]"],
        { title: "Test", body: "Test" }
      )
    ).resolves.toBeUndefined();
  });
});

// ─── Webhook Route Logic ──────────────────────────────────────────────────────

describe("Webhook Route Logic", () => {
  it("SMS webhook handler is registered at /api/webhooks/sms", async () => {
    const { registerWebhookRoutes } = await import("../server/webhooks");
    const routes: string[] = [];
    const mockApp = {
      post: (path: string, _handler: unknown) => { routes.push(`POST:${path}`); },
      get: (path: string, _handler: unknown) => { routes.push(`GET:${path}`); },
    };
    registerWebhookRoutes(mockApp as never);
    expect(routes).toContain("POST:/api/webhooks/sms");
    expect(routes).toContain("POST:/api/webhooks/voice");
    expect(routes).toContain("POST:/api/webhooks/call-status");
    expect(routes).toContain("GET:/api/webhooks/config");
  });
});

// ─── Schema Validation ────────────────────────────────────────────────────────

describe("Database Schema", () => {
  it("all required tables are exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.users).toBeDefined();
    expect(schema.phoneNumbers).toBeDefined();
    expect(schema.conversations).toBeDefined();
    expect(schema.messages).toBeDefined();
    expect(schema.callLogs).toBeDefined();
    expect(schema.deviceTokens).toBeDefined();
  });

  it("conversations table has required columns", async () => {
    const { conversations } = await import("../drizzle/schema");
    const cols = Object.keys(conversations);
    expect(cols).toContain("userId");
    expect(cols).toContain("contactNumber");
    expect(cols).toContain("lastMessage");
    expect(cols).toContain("unreadCount");
    expect(cols).toContain("isBurner");
  });

  it("messages table has twilioSid column", async () => {
    const { messages } = await import("../drizzle/schema");
    const cols = Object.keys(messages);
    expect(cols).toContain("twilioSid");
    expect(cols).toContain("isMe");
    expect(cols).toContain("status");
  });

  it("deviceTokens table has platform column", async () => {
    const { deviceTokens } = await import("../drizzle/schema");
    const cols = Object.keys(deviceTokens);
    expect(cols).toContain("token");
    expect(cols).toContain("platform");
    expect(cols).toContain("userId");
  });
});

// ─── Utility Functions ────────────────────────────────────────────────────────

describe("Utility Functions", () => {
  it("formats phone number duration correctly", () => {
    const formatDuration = (seconds: number): string => {
      if (seconds === 0) return "0:00";
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, "0")}`;
    };
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3600)).toBe("60:00");
    expect(formatDuration(90)).toBe("1:30");
  });

  it("generates consistent avatar colors from phone numbers", () => {
    const AVATAR_COLORS = ["#00e676", "#4dd0e1", "#ffca28", "#ff6b6b", "#ce93d8", "#69f0ae"];
    const getAvatarColor = (str: string): string => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    };
    // Same input should always produce same color
    expect(getAvatarColor("+15551234567")).toBe(getAvatarColor("+15551234567"));
    // Different inputs may produce different colors
    const colors = new Set(["+1555", "+1666", "+1777", "+1888", "+1999", "+1000"].map(getAvatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("validates Expo push token format", () => {
    const isValidExpoPushToken = (token: string): boolean =>
      token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
    expect(isValidExpoPushToken("ExponentPushToken[abc123]")).toBe(true);
    expect(isValidExpoPushToken("ExpoPushToken[abc123]")).toBe(true);
    expect(isValidExpoPushToken("invalid-token")).toBe(false);
    expect(isValidExpoPushToken("")).toBe(false);
  });
});
