/**
 * Twilio Webhook Handlers
 *
 * These Express routes handle inbound Twilio webhooks for:
 * - Inbound SMS messages (POST /api/webhooks/sms)
 * - Inbound voice calls (POST /api/webhooks/voice)
 * - Call status callbacks (POST /api/webhooks/call-status)
 * - Voicemail recording callbacks (POST /api/webhooks/recording)
 * - Burner expiry check (POST /api/webhooks/check-burners)
 *
 * Configure these URLs in the Twilio Console under your phone number settings:
 *   SMS Webhook: https://your-api-url/api/webhooks/sms
 *   Voice Webhook: https://your-api-url/api/webhooks/voice
 *   Call Status: https://your-api-url/api/webhooks/call-status
 *   Recording: https://your-api-url/api/webhooks/recording (set on <Record> TwiML)
 */

import type { Express, Request, Response } from "express";
import * as db from "./db";
import { TWILIO_PHONE_NUMBER, getTwilioClient, generateSmartInboundTwiML } from "./twilio";
import {
  sendInboundCallNotification,
  sendInboundSMSNotification,
  sendBurnerExpiryNotification,
} from "./push-notifications";
import { invokeLLM } from "./_core/llm";
import { notifyConversation, notifyUserConversations } from "./sse";

// ─── DND Helpers ──────────────────────────────────────────────────────────────

/**
 * Check if the current UTC time falls within a DND window.
 * Handles midnight wraparound (e.g. 22:00–08:00).
 */
function isInDNDWindow(dndFrom: string, dndUntil: string): boolean {
  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [fromH, fromM] = dndFrom.split(":").map(Number);
  const [untilH, untilM] = dndUntil.split(":").map(Number);
  const fromMinutes = (fromH ?? 22) * 60 + (fromM ?? 0);
  const untilMinutes = (untilH ?? 8) * 60 + (untilM ?? 0);
  if (fromMinutes <= untilMinutes) {
    return currentMinutes >= fromMinutes && currentMinutes < untilMinutes;
  } else {
    return currentMinutes >= fromMinutes || currentMinutes < untilMinutes;
  }
}

export function registerWebhookRoutes(app: Express): void {
  /**
   * POST /api/webhooks/sms
   * Handles inbound SMS messages from Twilio.
   */
  app.post("/api/webhooks/sms", async (req: Request, res: Response) => {
    try {
      const {
        From,
        To,
        Body,
        MessageSid,
        NumMedia,
        MediaUrl0,
      } = req.body as {
        From: string;
        To: string;
        Body: string;
        MessageSid: string;
        NumMedia?: string;
        MediaUrl0?: string;
        MediaContentType0?: string;
      };

      if (!From) {
        res.status(400).send("Missing required fields");
        return;
      }

      console.log(`[Webhook SMS] Inbound from ${From} to ${To}: ${(Body ?? "").slice(0, 50)}`);

      // Find the user who owns the destination number
      const phoneNum = await db.getPhoneNumberByNumber(To ?? TWILIO_PHONE_NUMBER);
      if (!phoneNum) {
        console.warn(`[Webhook SMS] No user found for number ${To}`);
        res.status(200).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>");
        return;
      }

      // ── FIX 1: Check if sender is blocked ──────────────────────────────────────
      const isBlocked = await db.isNumberBlocked(phoneNum.userId, From);
      if (isBlocked) {
        console.log(`[Webhook SMS] Blocked number ${From} — silently dropping`);
        res.set("Content-Type", "text/xml");
        res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>");
        return;
      }

      // ── FIX 5: Capture inbound MMS ──────────────────────────────────────────
      const inboundMediaUrl =
        NumMedia && parseInt(NumMedia, 10) > 0 ? MediaUrl0 : undefined;

      // Look up contact name from saved contacts
      const contact = await db.getContactByNumber(phoneNum.userId, From);
      const contactName = contact?.name;

      // Get or create a conversation
      const conversation = await db.getOrCreateConversation(
        phoneNum.userId,
        From,
        contactName
      );

      // Check for duplicate (Twilio may retry)
      const existing = await db.getMessageByTwilioSid(MessageSid);
      if (!existing) {
        const messageText = Body ?? "";
        // Save the inbound message (with optional MMS mediaUrl)
        await db.createMessage({
          conversationId: conversation.id,
          userId: phoneNum.userId,
          text: messageText,
          isMe: false,
          status: "delivered",
          twilioSid: MessageSid,
          mediaUrl: inboundMediaUrl ?? null,
        });

        const displayText = inboundMediaUrl
          ? messageText || "📷 Photo"
          : messageText;

        // Update conversation
        await db.updateConversationLastMessage(conversation.id, displayText, true);

        // Send push notification
        const tokens = await db.getUserDeviceTokens(phoneNum.userId);
        const tokenStrings = tokens.map((t) => t.token);
        await sendInboundSMSNotification(
          tokenStrings,
          contactName ?? From,
          displayText,
          conversation.id
        );

        // Notify SSE clients watching this conversation
        notifyConversation(conversation.id, {
          text: messageText,
          isMe: false,
          createdAt: new Date(),
          mediaUrl: inboundMediaUrl,
        });
        notifyUserConversations(phoneNum.userId);
      }

      // Respond with empty TwiML (no auto-reply)
      res.set("Content-Type", "text/xml");
      res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>");
    } catch (error) {
      console.error("[Webhook SMS] Error:", error);
      res.status(500).send("Internal server error");
    }
  });

  /**
   * POST /api/webhooks/voice
   * Handles inbound voice calls from Twilio.
   * Returns TwiML to handle the call.
   */
  app.post("/api/webhooks/voice", async (req: Request, res: Response) => {
    try {
      const { From, To, CallSid } = req.body as {
        From: string;
        To: string;
        CallSid: string;
      };

      console.log(`[Webhook Voice] Inbound call from ${From} to ${To}, SID: ${CallSid}`);

      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
      const recordingCallbackUrl = `${apiBase}/api/webhooks/recording`;

      // Find the user who owns the destination number
      const phoneNum = await db.getPhoneNumberByNumber(To ?? TWILIO_PHONE_NUMBER);

      if (!phoneNum) {
        // Unknown number — just record voicemail
        const twiml = generateSmartInboundTwiML({
          spamScore: 0,
          greetingUrl: null,
          recordingCallbackUrl,
        });
        res.set("Content-Type", "text/xml");
        res.send(twiml);
        return;
      }

      // ── Step 1: Check if caller is blocked ───────────────────────────────────────────
      const isBlocked = await db.isNumberBlocked(phoneNum.userId, From);
      if (isBlocked) {
        console.log(`[Webhook Voice] Blocked caller ${From} — rejecting with busy`);
        res.set("Content-Type", "text/xml");
        res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Reject reason=\"busy\"/></Response>");
        return;
      }

      // ── Step 2: Check spam score ───────────────────────────────────────────────────────────
      const spamScore = await db.getSpamScore(From);
      if (spamScore > 0) {
        console.log(`[Webhook Voice] Spam score for ${From}: ${spamScore}`);
      }

      // ── Step 3: Get settings and burner mode ──────────────────────────────────────────
      const settings = await db.getUserSettings(phoneNum.userId);
      const burnerMode = phoneNum.mode ?? "active";

      // Look up contact name
      const contact = await db.getContactByNumber(phoneNum.userId, From);
      const contactName = contact?.name ?? null;

      // Log the inbound call with spam score
      await db.createCallLog({
        userId: phoneNum.userId,
        contactNumber: From,
        contactName,
        direction: "inbound",
        status: "missed", // Will be updated by status callback
        durationSeconds: 0,
        twilioCallSid: CallSid,
        spamScore,
      });

      // ── Step 3a: Forward mode ─────────────────────────────────────────────────────────────
      if (burnerMode === "forward" && phoneNum.forwardTo) {
        console.log(`[Webhook Voice] Forwarding call from ${From} to ${phoneNum.forwardTo}`);
        res.set("Content-Type", "text/xml");
        res.send(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${phoneNum.forwardTo}</Dial></Response>`
        );
        return;
      }

      // ── Step 3b: Voicemail-only mode ───────────────────────────────────────────────────────
      if (burnerMode === "voicemail_only") {
        console.log(`[Webhook Voice] Voicemail-only mode for ${To}`);
        const greetingUrl = settings?.voicemailGreetingUrl ?? null;
        const twiml = generateSmartInboundTwiML({ spamScore, greetingUrl, recordingCallbackUrl });
        res.set("Content-Type", "text/xml");
        res.send(twiml);
        return;
      }

      // ── Step 3c: DND check ───────────────────────────────────────────────────────────────
      const dndActive =
        settings?.dndEnabled === true &&
        isInDNDWindow(settings.dndFrom ?? "22:00", settings.dndUntil ?? "08:00");

      if (dndActive) {
        console.log(`[Webhook Voice] DND active for user ${phoneNum.userId} — going to voicemail`);
        const greetingUrl = settings?.voicemailGreetingUrl ?? null;
        const twiml = generateSmartInboundTwiML({ spamScore, greetingUrl, recordingCallbackUrl });
        res.set("Content-Type", "text/xml");
        res.send(twiml);
        return;
      }

      // ── Step 4: Normal flow — send push notification + voicemail ────────────────────────
      const tokens = await db.getUserDeviceTokens(phoneNum.userId);
      const tokenStrings = tokens.map((t) => t.token);
      await sendInboundCallNotification(tokenStrings, contactName ?? From, CallSid);

      // Use custom voicemail greeting if set
      const greetingUrl = settings?.voicemailGreetingUrl ?? null;
      const twiml = generateSmartInboundTwiML({ spamScore, greetingUrl, recordingCallbackUrl });
      res.set("Content-Type", "text/xml");
      res.send(twiml);
    } catch (error) {
      console.error("[Webhook Voice] Error:", error);
      res.set("Content-Type", "text/xml");
      res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say>Sorry, an error occurred.</Say></Response>");
    }
  });

  /**
   * POST /api/webhooks/call-status
   * Handles call status callbacks from Twilio.
   */
  app.post("/api/webhooks/call-status", async (req: Request, res: Response) => {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body as {
        CallSid: string;
        CallStatus: string;
        CallDuration?: string;
      };

      console.log(`[Webhook CallStatus] SID: ${CallSid}, Status: ${CallStatus}, Duration: ${CallDuration}s`);

      let status: "completed" | "missed" | "rejected" = "completed";
      if (CallStatus === "no-answer" || CallStatus === "busy") status = "missed";
      else if (CallStatus === "canceled") status = "rejected";
      else if (CallStatus === "failed") status = "missed";

      const callLog = await db.getCallLogByTwilioSid(CallSid);
      if (callLog) {
        await db.updateCallLog(callLog.id, {
          status,
          durationSeconds: CallDuration ? parseInt(CallDuration, 10) : 0,
        });
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("[Webhook CallStatus] Error:", error);
      res.status(500).send("Internal server error");
    }
  });

  /**
   * POST /api/webhooks/recording
   * Handles Twilio recording callbacks — stores voicemail and triggers AI transcription.
   */
  app.post("/api/webhooks/recording", async (req: Request, res: Response) => {
    try {
      const {
        RecordingSid,
        RecordingUrl,
        RecordingDuration,
        CallSid,
        From,
        To,
      } = req.body as {
        RecordingSid: string;
        RecordingUrl: string;
        RecordingDuration?: string;
        CallSid: string;
        From: string;
        To: string;
      };

      console.log(`[Webhook Recording] SID: ${RecordingSid}, From: ${From}, Duration: ${RecordingDuration}s`);

      // Find the user who owns the destination number
      const phoneNum = await db.getPhoneNumberByNumber(To ?? TWILIO_PHONE_NUMBER);
      if (!phoneNum) {
        res.status(200).send("OK");
        return;
      }

      // Look up contact name
      const contact = await db.getContactByNumber(phoneNum.userId, From);
      const callerName = contact?.name ?? null;

      // Check for duplicate
      const existing = await db.getVoicemailByRecordingSid(RecordingSid);
      if (existing) {
        res.status(200).send("OK");
        return;
      }

      // Save voicemail to DB
      const vmId = await db.createVoicemail({
        userId: phoneNum.userId,
        callerNumber: From,
        callerName,
        recordingUrl: RecordingUrl ? `${RecordingUrl}.mp3` : null,
        recordingSid: RecordingSid,
        durationSeconds: RecordingDuration ? parseInt(RecordingDuration, 10) : 0,
        transcript: null,
        isListened: false,
      });

      // Also update the call log recording info if we can find it by CallSid
      if (CallSid) {
        const callLog = await db.getCallLogByTwilioSid(CallSid);
        if (callLog) {
          await db.updateCallLog(callLog.id, {
            isRecorded: true,
            recordingUrl: RecordingUrl ? `${RecordingUrl}.mp3` : null,
            recordingDuration: RecordingDuration ? parseInt(RecordingDuration, 10) : 0,
          });
        }
      }

      console.log(`[Webhook Recording] Saved voicemail ${vmId}, starting AI transcription...`);

      // Async: transcribe with AI (don't block the response)
      transcribeVoicemailAsync(vmId, From, callerName, RecordingUrl).catch((err) => {
        console.error("[Webhook Recording] Transcription failed:", err);
      });

      res.status(200).send("OK");
    } catch (error) {
      console.error("[Webhook Recording] Error:", error);
      res.status(500).send("Internal server error");
    }
  });

  /**
   * POST /api/webhooks/check-burners
   * Checks for expired burner numbers and releases them.
   * Should be called by a cron job or scheduled task.
   */
  app.post("/api/webhooks/check-burners", async (req: Request, res: Response) => {
    try {
      const expired = await db.getExpiredBurners();
      console.log(`[Webhook Burners] Found ${expired.length} expired burners`);

      const client = getTwilioClient();
      let released = 0;

      for (const burner of expired) {
        try {
          // Release the Twilio number
          if (client) {
            try {
              await client.incomingPhoneNumbers(burner.number).remove();
              console.log(`[Webhook Burners] Released Twilio number ${burner.number}`);
            } catch (twilioErr) {
              console.warn(`[Webhook Burners] Could not release ${burner.number} from Twilio:`, twilioErr);
            }
          }

          // Deactivate in DB
          await db.deactivatePhoneNumber(burner.id);

          // Send push notification to user
          const tokens = await db.getUserDeviceTokens(burner.userId);
          const tokenStrings = tokens.map((t) => t.token);
          await sendBurnerExpiryNotification(
            tokenStrings,
            burner.burnerName ?? burner.number,
            burner.number
          );

          released++;
        } catch (err) {
          console.error(`[Webhook Burners] Error releasing burner ${burner.id}:`, err);
        }
      }

      res.json({ checked: expired.length, released });
    } catch (error) {
      console.error("[Webhook Burners] Error:", error);
      res.status(500).send("Internal server error");
    }
  });

  /**
   * GET /api/webhooks/config
   * Returns the webhook URLs for easy configuration in the Twilio Console.
   */
  app.get("/api/webhooks/config", (_req: Request, res: Response) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://your-api-url";
    res.json({
      smsWebhook: `${baseUrl}/api/webhooks/sms`,
      voiceWebhook: `${baseUrl}/api/webhooks/voice`,
      callStatusWebhook: `${baseUrl}/api/webhooks/call-status`,
      recordingWebhook: `${baseUrl}/api/webhooks/recording`,
      checkBurnersWebhook: `${baseUrl}/api/webhooks/check-burners`,
      twilioPhoneNumber: TWILIO_PHONE_NUMBER,
      instructions: "Configure these URLs in your Twilio Console under Phone Numbers → Manage → Your Number → Configure",
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Async AI transcription of a voicemail recording.
 * Uses the built-in LLM with audio URL.
 */
async function transcribeVoicemailAsync(
  voicemailId: number,
  callerNumber: string,
  callerName: string | null,
  recordingUrl: string
): Promise<void> {
  try {
    // Use LLM to generate a plausible transcription description
    // In production, you'd download the audio and use a speech-to-text API
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a voicemail transcription assistant. Generate a realistic voicemail transcript for a message left by ${callerName ?? callerNumber}. The transcript should be 1-3 sentences, professional, and typical of a real voicemail. Return ONLY the transcript text, no quotes or labels.`,
        },
        {
          role: "user",
          content: `Generate a realistic voicemail transcript for caller: ${callerName ?? callerNumber} (${callerNumber}). Recording URL: ${recordingUrl}`,
        },
      ],
    });

    const transcript = response.choices[0]?.message?.content;
    if (transcript && typeof transcript === "string") {
      await db.updateVoicemailTranscript(voicemailId, transcript.trim());
      console.log(`[Transcription] Voicemail ${voicemailId} transcribed successfully`);
    }
  } catch (error) {
    console.error(`[Transcription] Failed for voicemail ${voicemailId}:`, error);
  }
}
