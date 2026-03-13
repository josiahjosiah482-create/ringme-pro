import { and, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertCallLog,
  InsertContact,
  InsertDeviceToken,
  InsertMessage,
  InsertPhoneNumber,
  InsertVoicemail,
  InsertUser,
  InsertPortingRequest,
  InsertUserSettings,
  UserSettings,
  BlockedNumber,
  InsertBlockedNumber,
  callLogs,
  contacts,
  conversations,
  deviceTokens,
  messages,
  phoneNumbers,
  users,
  voicemails,
  blockedNumbers,
  spamReports,
  portingRequests,
  userSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Phone Numbers ────────────────────────────────────────────────────────────

export async function getUserPhoneNumbers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(phoneNumbers).where(and(eq(phoneNumbers.userId, userId), eq(phoneNumbers.isActive, true)));
}

export async function getPhoneNumberByNumber(number: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(phoneNumbers).where(eq(phoneNumbers.number, number)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPhoneNumber(data: InsertPhoneNumber) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(phoneNumbers).values(data);
  return result[0].insertId;
}

export async function deactivatePhoneNumber(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(phoneNumbers).set({ isActive: false }).where(eq(phoneNumbers.id, id));
}

export async function getExpiredBurners() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(phoneNumbers).where(
    and(
      eq(phoneNumbers.isBurner, true),
      eq(phoneNumbers.isActive, true),
    )
  ).then((rows) => rows.filter((r) => r.expiresAt && r.expiresAt <= now));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getOrCreateConversation(userId: number, contactNumber: string, contactName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Look up contact name from contacts table if not provided
  let resolvedName = contactName;
  if (!resolvedName) {
    const contact = await getContactByNumber(userId, contactNumber);
    if (contact) resolvedName = contact.name;
  }

  const existing = await db.select().from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.contactNumber, contactNumber)))
    .limit(1);

  if (existing.length > 0) {
    // Update contact name if we now have one
    if (resolvedName && !existing[0].contactName) {
      await db.update(conversations).set({ contactName: resolvedName }).where(eq(conversations.id, existing[0].id));
      return { ...existing[0], contactName: resolvedName };
    }
    return existing[0];
  }

  const result = await db.insert(conversations).values({
    userId,
    contactNumber,
    contactName: resolvedName ?? null,
    lastMessage: null,
    unreadCount: 0,
    isBurner: false,
  });
  const inserted = await db.select().from(conversations).where(eq(conversations.id, result[0].insertId)).limit(1);
  return inserted[0];
}

export async function updateConversationLastMessage(conversationId: number, text: string, incrementUnread = false) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { lastMessage: text, lastMessageAt: new Date() };
  if (incrementUnread) {
    const conv = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (conv.length > 0) updateData.unreadCount = (conv[0].unreadCount ?? 0) + 1;
  }
  await db.update(conversations).set(updateData).where(eq(conversations.id, conversationId));
}

export async function markConversationRead(conversationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ unreadCount: 0 }).where(eq(conversations.id, conversationId));
}

export async function updateConversationContactName(conversationId: number, name: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ contactName: name }).where(eq(conversations.id, conversationId));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getConversationMessages(conversationId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .then((rows) => rows.reverse());
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  return result[0].insertId;
}

export async function getMessageByTwilioSid(sid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(messages).where(eq(messages.twilioSid, sid)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Call Logs ────────────────────────────────────────────────────────────────

export async function getUserCallLogs(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(callLogs)
    .where(eq(callLogs.userId, userId))
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);
}

export async function createCallLog(data: InsertCallLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(callLogs).values(data);
  return result[0].insertId;
}

export async function updateCallLog(id: number, data: Partial<InsertCallLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(callLogs).set(data).where(eq(callLogs.id, id));
}

export async function getCallLogByTwilioSid(sid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(callLogs).where(eq(callLogs.twilioCallSid, sid)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Device Tokens ────────────────────────────────────────────────────────────

export async function upsertDeviceToken(data: InsertDeviceToken) {
  const db = await getDb();
  if (!db) return;
  // Remove old tokens for this user+platform, then insert new
  await db.delete(deviceTokens).where(
    and(eq(deviceTokens.userId, data.userId), eq(deviceTokens.platform, data.platform))
  );
  await db.insert(deviceTokens).values(data);
}

export async function getUserDeviceTokens(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId));
}

export async function getDeviceTokensByPhoneNumber(number: string) {
  const db = await getDb();
  if (!db) return [];
  const phoneNum = await db.select().from(phoneNumbers).where(eq(phoneNumbers.number, number)).limit(1);
  if (phoneNum.length === 0) return [];
  return db.select().from(deviceTokens).where(eq(deviceTokens.userId, phoneNum[0].userId));
}

// ─── Voicemails ───────────────────────────────────────────────────────────────

export async function getUserVoicemails(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(voicemails)
    .where(eq(voicemails.userId, userId))
    .orderBy(desc(voicemails.createdAt))
    .limit(limit);
}

export async function createVoicemail(data: InsertVoicemail) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(voicemails).values(data);
  return result[0].insertId;
}

export async function updateVoicemailTranscript(id: number, transcript: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(voicemails).set({ transcript }).where(eq(voicemails.id, id));
}

export async function markVoicemailListened(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(voicemails).set({ isListened: true }).where(eq(voicemails.id, id));
}

export async function deleteVoicemail(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(voicemails).where(eq(voicemails.id, id));
}

export async function getVoicemailByRecordingSid(recordingSid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(voicemails).where(eq(voicemails.recordingSid, recordingSid)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getUserContacts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts)
    .where(eq(contacts.userId, userId))
    .orderBy(contacts.name);
}

export async function getContactByNumber(userId: number, number: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts)
    .where(and(eq(contacts.userId, userId), eq(contacts.number, number)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contacts).values(data);
  return result[0].insertId;
}

export async function updateContact(id: number, data: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set({ ...data, updatedAt: new Date() }).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contacts).where(eq(contacts.id, id));
}

export async function toggleContactFavorite(id: number, isFavorite: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set({ isFavorite, updatedAt: new Date() }).where(eq(contacts.id, id));
}

/**
 * Bulk upsert contacts from device — skips duplicates by number.
 */
export async function bulkUpsertContacts(userId: number, contactList: { name: string; number: string; avatarColor: string }[]) {
  const db = await getDb();
  if (!db) return 0;
  let added = 0;
  for (const c of contactList) {
    const existing = await getContactByNumber(userId, c.number);
    if (!existing) {
      await db.insert(contacts).values({
        userId,
        name: c.name,
        number: c.number,
        avatarColor: c.avatarColor,
        isFavorite: false,
        isDeviceContact: true,
      });
      added++;
    }
  }
  return added;
}

// ─── Blocked Numbers ──────────────────────────────────────────────────────────

export async function getBlockedNumbers(userId: number): Promise<BlockedNumber[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blockedNumbers).where(eq(blockedNumbers.userId, userId));
}

export async function addBlockedNumber(userId: number, number: string, label?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(blockedNumbers).values({ userId, number, label });
}

export async function removeBlockedNumber(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(blockedNumbers).where(eq(blockedNumbers.id, id));
}

export async function isNumberBlocked(userId: number, number: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(blockedNumbers).where(
    and(eq(blockedNumbers.userId, userId), eq(blockedNumbers.number, number))
  );
  return rows.length > 0;
}

// ─── Spam Reports ─────────────────────────────────────────────────────────────
export async function getSpamScore(number: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(spamReports).where(eq(spamReports.number, number));
  return rows[0]?.reportCount ?? 0;
}

export async function reportSpam(number: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(spamReports)
    .values({ number, reportCount: 1, lastReportedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { reportCount: db.$count(spamReports) as unknown as number, lastReportedAt: new Date() } });
  // Simpler approach: increment manually
  const existing = await db.select().from(spamReports).where(eq(spamReports.number, number));
  if (existing.length > 0) {
    await db.update(spamReports).set({ reportCount: existing[0].reportCount + 1, lastReportedAt: new Date() }).where(eq(spamReports.number, number));
  }
}

// ─── User Settings ────────────────────────────────────────────────────────────
export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return rows[0] ?? null;
}

export async function upsertUserSettings(userId: number, data: Partial<InsertUserSettings>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userSettings)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

// ─── Porting Requests ─────────────────────────────────────────────────────────
export async function createPortingRequest(data: InsertPortingRequest): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(portingRequests).values(data);
}

export async function getUserPortingRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portingRequests).where(eq(portingRequests.userId, userId));
}

// ─── Phone Number Mode ──────────────────────────────────────────────────────────────
export async function updatePhoneNumberMode(
  id: number,
  mode: "active" | "forward" | "voicemail_only",
  forwardTo?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(phoneNumbers)
    .set({ mode, forwardTo: forwardTo ?? null })
    .where(eq(phoneNumbers.id, id));
}

// ─── Subscription / Usage ─────────────────────────────────────────────────────────────
export async function updateUserTier(
  userId: number,
  tier: "free" | "pro" | "max"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ subscriptionTier: tier }).where(eq(users.id, userId));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get the count of messages sent by a user in the current calendar month.
 * Used for Free plan usage limit enforcement.
 */
export async function getMonthlyMessageCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = await db.select().from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        eq(messages.isMe, true)
      )
    );
  // Filter in JS since drizzle mysql2 doesn't support gte on timestamp easily without sql tag
  return rows.filter((r) => r.createdAt >= startOfMonth).length;
}

// ─── DB Health ──────────────────────────────────────────────────────────────────
export async function isDbHealthy(): Promise<boolean> { const db = await getDb();
  if (!db) return false;
  try {
    await db.select().from(users).limit(1);
    return true;
  } catch {
    return false;
  }
}

// ─── Full-Text Message Search ──────────────────────────────────────────────────
export async function searchMessages(userId: number, query: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  // Get all user conversations first
  const userConvos = await db.select().from(conversations).where(eq(conversations.userId, userId));
  if (userConvos.length === 0) return [];
  const convoIds = userConvos.map((c) => c.id);
  const convoMap = new Map(userConvos.map((c) => [c.id, c]));

  // Search messages across all user conversations
  const allMessages = [];
  for (const convoId of convoIds) {
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, convoId))
      .orderBy(desc(messages.createdAt))
      .limit(200);
    allMessages.push(...msgs);
  }

  // Filter by query (case-insensitive)
  const lowerQuery = query.toLowerCase();
  const matched = allMessages
    .filter((m) => m.text.toLowerCase().includes(lowerQuery))
    .slice(0, limit)
    .map((m) => {
      const convo = convoMap.get(m.conversationId);
      return {
        messageId: m.id,
        conversationId: m.conversationId,
        text: m.text,
        isMe: m.isMe,
        createdAt: m.createdAt,
        contactName: convo?.contactName ?? convo?.contactNumber ?? "Unknown",
        contactNumber: convo?.contactNumber ?? "",
      };
    });

  return matched;
}
