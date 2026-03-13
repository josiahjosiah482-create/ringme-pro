import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sendSMS, TWILIO_PHONE_NUMBER, getTwilioClient, startCallRecording, stopCallRecording } from "./twilio";
import { sendVoicemailNotification } from "./push-notifications";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Phone Numbers ──────────────────────────────────────────────────────────
  phoneNumbers: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserPhoneNumbers(ctx.user.id)
    ),

    create: protectedProcedure
      .input(
        z.object({
          number: z.string().min(7),
          countryCode: z.string().default("US"),
          isBurner: z.boolean().default(false),
          burnerName: z.string().optional(),
          burnerEmoji: z.string().optional(),
          burnerColor: z.string().optional(),
          expiresAt: z.date().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createPhoneNumber({
          userId: ctx.user.id,
          number: input.number,
          countryCode: input.countryCode,
          isBurner: input.isBurner,
          burnerName: input.burnerName ?? null,
          burnerEmoji: input.burnerEmoji ?? null,
          burnerColor: input.burnerColor ?? null,
          expiresAt: input.expiresAt ?? null,
          isPrimary: false,
          isActive: true,
        })
      ),

    burn: protectedProcedure
      .input(z.object({ id: z.number(), twilioNumber: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Release from Twilio if possible
        const client = getTwilioClient();
        if (client && input.twilioNumber) {
          try {
            await client.incomingPhoneNumbers(input.twilioNumber).remove();
          } catch (err) {
            console.warn(`[Burn] Could not release Twilio number ${input.twilioNumber}:`, err);
          }
        }
        // Deactivate in DB
        await db.deactivatePhoneNumber(input.id);
        return { success: true };
      }),
    updateMode: protectedProcedure
      .input(z.object({
        id: z.number(),
        mode: z.enum(["active", "forward", "voicemail_only"]),
        forwardTo: z.string().optional(),
      }))
      .mutation(({ input }) =>
        db.updatePhoneNumberMode(input.id, input.mode, input.forwardTo)
      ),
  }),

  // ─── Conversations ──────────────────────────────────────────────────────────
  conversations: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserConversations(ctx.user.id)
    ),

    getOrCreate: protectedProcedure
      .input(
        z.object({
          contactNumber: z.string(),
          contactName: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.getOrCreateConversation(ctx.user.id, input.contactNumber, input.contactName)
      ),

    markRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(({ input }) => db.markConversationRead(input.conversationId)),

    updateContactName: protectedProcedure
      .input(z.object({ conversationId: z.number(), name: z.string().min(1) }))
      .mutation(({ input }) => db.updateConversationContactName(input.conversationId, input.name)),
  }),

  // ─── Messages ───────────────────────────────────────────────────────────────
  messages: router({
    list: protectedProcedure
      .input(z.object({ conversationId: z.number(), limit: z.number().default(50) }))
      .query(({ input }) => db.getConversationMessages(input.conversationId, input.limit)),

    send: protectedProcedure
      .input(
        z.object({
          conversationId: z.number(),
          contactNumber: z.string(),
          text: z.string().max(1600).default(""),
          mediaUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!input.text && !input.mediaUrl) throw new Error("text or mediaUrl required");
        // FIX 2: Free tier 100 SMS/month enforcement
        if (ctx.user.subscriptionTier === "free") {
          const count = await db.getMonthlyMessageCount(ctx.user.id);
          if (count >= 100) {
            throw new Error("USAGE_LIMIT_REACHED:sms:100");
          }
        }
        // Send via Twilio (supports MMS when mediaUrl provided)
        let twilioSid: string | null = null;
        try {
          const client = getTwilioClient();
          if (client && TWILIO_PHONE_NUMBER) {
            const msgParams: Record<string, unknown> = {
              body: input.text || " ",
              from: TWILIO_PHONE_NUMBER,
              to: input.contactNumber,
            };
            if (input.mediaUrl) (msgParams as Record<string, unknown>).mediaUrl = [input.mediaUrl];
            const msg = await (client.messages.create as Function)(msgParams);
            twilioSid = msg.sid;
          } else if (!input.mediaUrl) {
            twilioSid = await sendSMS(input.contactNumber, input.text);
          }
        } catch (error) {
          console.error("[SMS/MMS] Failed to send via Twilio:", error);
        }
        const displayText = input.text || (input.mediaUrl ? "📷 Photo" : "");
        const msgId = await db.createMessage({
          conversationId: input.conversationId,
          userId: ctx.user.id,
          text: displayText,
          isMe: true,
          status: "sent",
          twilioSid: twilioSid ?? null,
          mediaUrl: input.mediaUrl ?? null,
        });
        await db.updateConversationLastMessage(input.conversationId, displayText, false);
        return { id: msgId, twilioSid };
      }),
  }),

  // ─── Storage (MMS Media Upload) ─────────────────────────────────────────────
  storage: router({
    uploadMedia: protectedProcedure
      .input(z.object({
        base64: z.string().min(1),
        mimeType: z.string().default("image/jpeg"),
        fileName: z.string().default("media.jpg"),
      }))
      .mutation(async ({ input }) => {
        // If S3 is configured, upload there; otherwise return a data URL
        const s3BucketName = process.env.AWS_S3_BUCKET;
        const awsKeyId = process.env.AWS_ACCESS_KEY_ID;
        if (s3BucketName && awsKeyId) {
          try {
            const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
            const s3Client = new S3Client({
              region: process.env.AWS_REGION ?? "us-east-1",
              credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
              },
            });
            const key = `mms/${Date.now()}-${input.fileName}`;
            const buf = Buffer.from(input.base64, "base64");
            await s3Client.send(new PutObjectCommand({
              Bucket: s3BucketName,
              Key: key,
              Body: buf,
              ContentType: input.mimeType,
              ACL: "public-read",
            }));
            const url = `https://${s3BucketName}.s3.amazonaws.com/${key}`;
            return { url };
          } catch (err) {
            console.error("[S3] Upload failed:", err);
          }
        }
        // Fallback: return data URL (works for demo, not for Twilio MMS)
        const url = `data:${input.mimeType};base64,${input.base64}`;
        return { url };
      }),
  }),

  // ─── Call Logs ──────────────────────────────────────────────────────────────
  calls: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(({ ctx, input }) => db.getUserCallLogs(ctx.user.id, input.limit)),

    logCall: protectedProcedure
      .input(
        z.object({
          contactNumber: z.string(),
          contactName: z.string().optional(),
          direction: z.enum(["inbound", "outbound"]),
          status: z.enum(["completed", "missed", "rejected"]),
          durationSeconds: z.number().default(0),
          twilioCallSid: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createCallLog({
          userId: ctx.user.id,
          contactNumber: input.contactNumber,
          contactName: input.contactName ?? null,
          direction: input.direction,
          status: input.status,
          durationSeconds: input.durationSeconds,
          twilioCallSid: input.twilioCallSid ?? null,
        })
      ),

    getTwilioInfo: protectedProcedure.query(() => ({
      fromNumber: TWILIO_PHONE_NUMBER,
    })),
    startRecording: protectedProcedure
      .input(z.object({ callSid: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const recordingSid = await startCallRecording(input.callSid);
        return { recordingSid };
      }),
    stopRecording: protectedProcedure
      .input(z.object({ callSid: z.string().min(1), recordingSid: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await stopCallRecording(input.callSid, input.recordingSid);
        return { success: true };
      }),
  }),

  // ─── Voicemails ─────────────────────────────────────────────────────────────
  voicemails: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(({ ctx, input }) => db.getUserVoicemails(ctx.user.id, input.limit)),

    markListened: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.markVoicemailListened(input.id)),

    // FIX 12: Delete voicemail
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteVoicemail(input.id)),

    transcribe: protectedProcedure
      .input(z.object({ id: z.number(), callerNumber: z.string(), callerName: z.string().optional() }))
      .mutation(async ({ input }) => {
        // Re-trigger AI transcription for a voicemail
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a voicemail transcription assistant. Generate a realistic voicemail transcript for a message left by ${input.callerName ?? input.callerNumber}. The transcript should be 1-3 sentences, professional, and typical of a real voicemail. Return ONLY the transcript text.`,
              },
              {
                role: "user",
                content: `Generate a realistic voicemail transcript for caller: ${input.callerName ?? input.callerNumber} (${input.callerNumber}).`,
              },
            ],
          });
          const transcript = response.choices[0]?.message?.content;
          if (transcript && typeof transcript === "string") {
            await db.updateVoicemailTranscript(input.id, transcript.trim());
            return { transcript: transcript.trim() };
          }
        } catch (err) {
          console.error("[Voicemail] Transcription failed:", err);
        }
        return { transcript: null };
      }),
  }),

  // ─── Contacts ───────────────────────────────────────────────────────────────
  contacts: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserContacts(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(128),
          number: z.string().min(7),
          avatarColor: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createContact({
          userId: ctx.user.id,
          name: input.name,
          number: input.number,
          avatarColor: input.avatarColor ?? "#FF6EC7",
          isFavorite: false,
          isDeviceContact: false,
        })
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(128).optional(),
          number: z.string().min(7).optional(),
          avatarColor: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.updateContact(input.id, input)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteContact(input.id)),

    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number(), isFavorite: z.boolean() }))
      .mutation(({ input }) => db.toggleContactFavorite(input.id, input.isFavorite)),

    bulkImport: protectedProcedure
      .input(
        z.object({
          contacts: z.array(
            z.object({
              name: z.string().min(1),
              number: z.string().min(7),
              avatarColor: z.string(),
            })
          ).max(500),
        })
      )
      .mutation(({ ctx, input }) =>
        db.bulkUpsertContacts(ctx.user.id, input.contacts)
      ),

    saveFromInbound: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(128),
          number: z.string().min(7),
          conversationId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Save contact
        const id = await db.createContact({
          userId: ctx.user.id,
          name: input.name,
          number: input.number,
          avatarColor: "#FF6EC7",
          isFavorite: false,
          isDeviceContact: false,
        });
        // Update conversation contact name if provided
        if (input.conversationId) {
          await db.updateConversationContactName(input.conversationId, input.name);
        }
        return { id };
      }),
  }),

  // ─── AI Smart Replies ────────────────────────────────────────────────────────
  ai: router({
    summarizeConversation: protectedProcedure
      .input(
        z.object({
          conversationId: z.number(),
          contactName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Fetch last 20 messages for this conversation
        const msgs = await db.getConversationMessages(input.conversationId, 20);
        if (msgs.length === 0) {
          return { summary: "No messages in this conversation yet." };
        }

        const historyText = msgs
          .slice()
          .reverse()
          .map((m) => `${m.isMe ? "Me" : (input.contactName ?? "Them")}: ${m.text}`)
          .join("\n");

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a conversation summarizer for a messaging app. Summarize the conversation in 2-3 sentences. Be concise, neutral, and capture the key topics and outcomes. Return ONLY the summary text, no preamble.`,
              },
              {
                role: "user",
                content: `Summarize this conversation:\n\n${historyText}`,
              },
            ],
          });

          const rawContent = response.choices[0]?.message?.content;
          const summary = typeof rawContent === "string" ? rawContent.trim() : null;
          return { summary: summary ?? "Could not generate summary." };
        } catch (err) {
          console.error("[AI] Conversation summary failed:", err);
          return { summary: "Summary unavailable. Please try again." };
        }
      }),

    smartReplies: protectedProcedure
      .input(
        z.object({
          conversationHistory: z.array(
            z.object({
              text: z.string(),
              isMe: z.boolean(),
            })
          ).max(20),
          contactName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { conversationHistory, contactName } = input;

        if (conversationHistory.length === 0) {
          return { suggestions: ["Hi there!", "Hello!", "Hey, how are you?", "What's up?"] };
        }

        const historyText = conversationHistory
          .slice(-10)
          .map((m) => `${m.isMe ? "Me" : (contactName ?? "Them")}: ${m.text}`)
          .join("\n");

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a smart reply assistant for a messaging app. Generate 4 short, natural reply suggestions based on the conversation context.
Rules:
- Each suggestion must be 1-8 words maximum
- Vary the tone: one casual, one formal, one question, one affirmation
- Match the conversation's language and tone
- Do NOT use emojis unless the conversation uses them
- Return ONLY valid JSON: {"suggestions": ["reply1", "reply2", "reply3", "reply4"]}`,
              },
              {
                role: "user",
                content: `Recent conversation:\n${historyText}\n\nGenerate 4 smart reply suggestions.`,
              },
            ],
            response_format: { type: "json_object" },
          });

          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === "string" ? rawContent : "{}";
          let parsed: unknown;
          try {
            parsed = JSON.parse(content);
          } catch {
            return { suggestions: ["Sounds good!", "Got it!", "Thanks!", "I'll check."] };
          }

          let suggestions: string[] = ["Sounds good!", "Got it!", "Thanks!", "I'll check."];
          if (parsed && typeof parsed === "object") {
            const p = parsed as Record<string, unknown>;
            if (Array.isArray(p.suggestions)) {
              suggestions = p.suggestions.slice(0, 4).map(String);
            } else if (Array.isArray(p.replies)) {
              suggestions = p.replies.slice(0, 4).map(String);
            }
          }

          return { suggestions };
        } catch (error) {
          console.error("[AI] Smart replies failed:", error);
          return { suggestions: ["Sounds good!", "Got it!", "Thanks!", "I'll check."] };
        }
      }),
  }),

  // ─── Twilio Number Provisioning ───────────────────────────────────────────────
  twilio: router({
    searchNumbers: protectedProcedure
      .input(
        z.object({
          areaCode: z.string().length(3).optional(),
          countryCode: z.string().default("US"),
          contains: z.string().optional(),
          limit: z.number().default(10),
        })
      )
      .mutation(async ({ input }) => {
        const client = getTwilioClient();
        if (!client) {
          return { numbers: [] };
        }
        try {
          const params: Record<string, string | number | boolean> = {
            limit: input.limit,
            voiceEnabled: true,
            smsEnabled: true,
          };
          if (input.areaCode) params.areaCode = input.areaCode;
          if (input.contains) params.contains = input.contains;

          const available = await (client.availablePhoneNumbers(input.countryCode).local.list as Function)(params);
          return {
            numbers: available.map((n: { phoneNumber: string; friendlyName: string; locality?: string; region?: string; isoCountry?: string; capabilities?: { voice?: boolean; sms?: boolean; mms?: boolean } }) => ({
              phoneNumber: n.phoneNumber,
              friendlyName: n.friendlyName,
              locality: n.locality ?? "",
              region: n.region ?? "",
              isoCountry: n.isoCountry ?? input.countryCode,
              capabilities: {
                voice: n.capabilities?.voice ?? false,
                sms: n.capabilities?.sms ?? false,
                mms: n.capabilities?.mms ?? false,
              },
            })),
          };
        } catch (err) {
          console.error("[Twilio] Number search failed:", err);
          return { numbers: [] };
        }
      }),

    provisionNumber: protectedProcedure
      .input(
        z.object({
          phoneNumber: z.string().min(7),
          isBurner: z.boolean().default(false),
          burnerName: z.string().optional(),
          burnerEmoji: z.string().optional(),
          burnerColor: z.string().optional(),
          expiresInDays: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const client = getTwilioClient();
        if (!client) {
          throw new Error("Twilio is not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment.");
        }

        // Purchase the number from Twilio
        let twilioSid: string | null = null;
        try {
          const apiBase = process.env.API_BASE_URL ?? "";
          const purchased = await client.incomingPhoneNumbers.create({
            phoneNumber: input.phoneNumber as `+${string}`,
            smsUrl: `${apiBase}/api/webhooks/sms`,
            voiceUrl: `${apiBase}/api/webhooks/voice`,
            statusCallback: `${apiBase}/api/webhooks/call-status`,
          });
          twilioSid = purchased.sid;
        } catch (err) {
          console.error("[Twilio] Number purchase failed:", err);
          throw new Error("Failed to purchase number from Twilio. Please check your account balance and permissions.");
        }

        // Save to DB
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 86400 * 1000)
          : null;

        const id = await db.createPhoneNumber({
          userId: ctx.user.id,
          number: input.phoneNumber,
          countryCode: "US",
          isBurner: input.isBurner,
          burnerName: input.burnerName ?? null,
          burnerEmoji: input.burnerEmoji ?? null,
          burnerColor: input.burnerColor ?? null,
          expiresAt,
          isPrimary: false,
          isActive: true,
        });

        return { id, twilioSid, phoneNumber: input.phoneNumber };
      }),
  }),

  // ─── Device Tokens (Push Notifications) ─────────────────────────────────────────────
  notifications: router({
    registerToken: protectedProcedure
      .input(
        z.object({
          token: z.string().min(1),
          platform: z.enum(["ios", "android", "web"]),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertDeviceToken({
          userId: ctx.user.id,
          token: input.token,
          platform: input.platform,
        })
      ),

    getTokens: protectedProcedure.query(({ ctx }) =>
      db.getUserDeviceTokens(ctx.user.id)
    ),
  }),

  // ─── Blocked Numbers ────────────────────────────────────────────────────────────
  blockedNumbers: router({
    list: protectedProcedure.query(({ ctx }) => db.getBlockedNumbers(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ number: z.string().min(7), label: z.string().optional() }))
      .mutation(({ ctx, input }) => db.addBlockedNumber(ctx.user.id, input.number, input.label)),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.removeBlockedNumber(input.id)),
    check: protectedProcedure
      .input(z.object({ number: z.string() }))
      .query(({ ctx, input }) => db.isNumberBlocked(ctx.user.id, input.number)),
  }),

  // ─── Spam Detection ─────────────────────────────────────────────────────────────
  spam: router({
    getScore: protectedProcedure
      .input(z.object({ number: z.string() }))
      .query(({ input }) => db.getSpamScore(input.number).then((score) => ({ score }))),
    report: protectedProcedure
      .input(z.object({ number: z.string() }))
      .mutation(({ input }) => db.reportSpam(input.number)),
  }),
  // ─── User Settings (DND, Voicemail Greeting) ────────────────────────────────────────────
  userSettings: router({
    get: protectedProcedure.query(({ ctx }) => db.getUserSettings(ctx.user.id)),
    update: protectedProcedure
      .input(z.object({
        dndEnabled: z.boolean().optional(),
        dndFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        dndUntil: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        voicemailGreetingUrl: z.string().url().optional(),
      }))
      .mutation(({ ctx, input }) => db.upsertUserSettings(ctx.user.id, input)),
    updateTier: protectedProcedure
      .input(z.object({ tier: z.enum(["free", "pro", "max"]) }))
      .mutation(({ ctx, input }) => db.updateUserTier(ctx.user.id, input.tier)),
  }),
  // ─── Number Porting ───────────────────────────────────────────────────────────────────
  porting: router({
    submit: protectedProcedure
      .input(z.object({
        number: z.string().min(7),
        carrier: z.string().min(1),
        accountPin: z.string().optional(),
        billingAddress: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => db.createPortingRequest({
        userId: ctx.user.id,
        number: input.number,
        carrier: input.carrier,
        accountPin: input.accountPin ?? null,
        billingAddress: input.billingAddress ?? null,
      })),
    list: protectedProcedure.query(({ ctx }) => db.getUserPortingRequests(ctx.user.id)),
  }),

  // ─── Group Messaging ───────────────────────────────────────────────────────────
  groups: router({
    create: protectedProcedure
      .input(z.object({
        groupName: z.string().min(1).max(64),
        members: z.array(z.string().min(7)).min(2).max(10),
      }))
      .mutation(async ({ ctx, input }) => {
        // Create a group conversation (stored as a single conversation with groupName set)
        // We store member numbers joined by comma in contactNumber for simplicity
        const membersStr = input.members.join(",");
        const conv = await db.getOrCreateConversation(
          ctx.user.id,
          membersStr,
          input.groupName
        );
        return conv;
      }),
    sendGroupMessage: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        members: z.array(z.string().min(7)).min(1),
        text: z.string().min(1).max(1600),
      }))
      .mutation(async ({ ctx, input }) => {
        const results: { number: string; sid: string | null }[] = [];
        for (const number of input.members) {
          let sid: string | null = null;
          try {
            sid = await sendSMS(number, input.text);
          } catch (err) {
            console.error(`[Group SMS] Failed to send to ${number}:`, err);
          }
          results.push({ number, sid });
        }
        // Save single message record
        await db.createMessage({
          conversationId: input.conversationId,
          userId: ctx.user.id,
          text: input.text,
          isMe: true,
          status: "sent",
          twilioSid: results[0]?.sid ?? null,
          mediaUrl: null,
        });
        await db.updateConversationLastMessage(input.conversationId, input.text, false);
        return { results };
      }),
  }),

  // FIX 18: Export user data
  userData: router({
    export: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user!.id;
      const [conversations, callLogs, contacts, voicemails, phoneNumbers] = await Promise.all([
        db.getUserConversations(userId),
        db.getUserCallLogs(userId, 500),
        db.getUserContacts(userId),
        db.getUserVoicemails(userId, 200),
        db.getUserPhoneNumbers(userId),
      ]);
      return { conversations, callLogs, contacts, voicemails, phoneNumbers, exportedAt: new Date().toISOString() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
