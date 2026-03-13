/**
 * Push notification helper using Expo Push Notification Service.
 * Sends notifications to device tokens registered by the app.
 */

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

/**
 * Send push notifications to a list of Expo push tokens.
 * Uses the Expo Push API — no additional credentials required.
 */
export async function sendPushNotifications(
  tokens: string[],
  notification: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  if (tokens.length === 0) return;

  // Filter to only valid Expo push tokens
  const validTokens = tokens.filter(
    (t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[")
  );

  if (validTokens.length === 0) {
    console.warn("[Push] No valid Expo push tokens found");
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    sound: "default",
    priority: "high",
    channelId: "ringme-alerts",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Push] Expo push API error:", response.status, text);
      return;
    }

    const result = (await response.json()) as ExpoPushResponse;
    const errors = result.data.filter((t) => t.status === "error");
    if (errors.length > 0) {
      console.warn("[Push] Some push notifications failed:", errors);
    } else {
      console.log(`[Push] Sent ${validTokens.length} push notification(s) successfully`);
    }
  } catch (error) {
    console.error("[Push] Failed to send push notifications:", error);
  }
}

/**
 * Send an inbound SMS push notification to the user who owns the destination number.
 */
export async function sendInboundSMSNotification(
  tokens: string[],
  from: string,
  body: string,
  conversationId?: number
): Promise<void> {
  await sendPushNotifications(tokens, {
    title: `New message from ${from}`,
    body: body.length > 100 ? body.slice(0, 97) + "..." : body,
    data: {
      type: "inbound_sms",
      from,
      conversationId,
    },
  });
}

/**
 * Send an inbound call push notification.
 */
export async function sendInboundCallNotification(
  tokens: string[],
  from: string,
  callSid: string
): Promise<void> {
  await sendPushNotifications(tokens, {
    title: "Incoming Call",
    body: `Call from ${from}`,
    data: {
      type: "inbound_call",
      from,
      callSid,
    },
  });
}

/**
 * Send a burner number expiry notification.
 */
export async function sendBurnerExpiryNotification(
  tokens: string[],
  burnerName: string,
  number: string
): Promise<void> {
  await sendPushNotifications(tokens, {
    title: "Burner Expired 🔥",
    body: `Your burner "${burnerName}" (${number}) has expired and been released.`,
    data: {
      type: "burner_expired",
      burnerName,
      number,
    },
  });
}

/**
 * Send a voicemail received notification.
 */
export async function sendVoicemailNotification(
  tokens: string[],
  from: string,
  durationSeconds: number
): Promise<void> {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  await sendPushNotifications(tokens, {
    title: "New Voicemail",
    body: `Voicemail from ${from} (${durationStr})`,
    data: {
      type: "voicemail",
      from,
      durationSeconds,
    },
  });
}
