import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "pro", "max"]).default("free").notNull(),
  avatarColor: varchar("avatarColor", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const phoneNumbers = mysqlTable("phone_numbers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  number: varchar("number", { length: 32 }).notNull(),
  countryCode: varchar("countryCode", { length: 4 }).notNull().default("US"),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  isBurner: boolean("isBurner").default(false).notNull(),
  burnerName: varchar("burnerName", { length: 64 }),
  burnerEmoji: varchar("burnerEmoji", { length: 8 }),
  burnerColor: varchar("burnerColor", { length: 16 }),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  /** Call forwarding destination number */
  forwardTo: varchar("forwardTo", { length: 32 }),
  /** Burner call handling mode */
  mode: mysqlEnum("mode", ["active", "forward", "voicemail_only"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type InsertPhoneNumber = typeof phoneNumbers.$inferInsert;

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactName: varchar("contactName", { length: 128 }),
  contactNumber: varchar("contactNumber", { length: 32 }).notNull(),
  lastMessage: text("lastMessage"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  unreadCount: int("unreadCount").default(0).notNull(),
  isBurner: boolean("isBurner").default(false).notNull(),
  /** Group messaging support */
  isGroup: boolean("isGroup").default(false).notNull(),
  groupName: varchar("groupName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  text: text("text").notNull(),
  isMe: boolean("isMe").default(true).notNull(),
  status: mysqlEnum("status", ["sent", "delivered", "read"]).default("sent").notNull(),
  twilioSid: varchar("twilioSid", { length: 64 }),
  /** MMS media URL */
  mediaUrl: varchar("mediaUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const callLogs = mysqlTable("call_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactName: varchar("contactName", { length: 128 }),
  contactNumber: varchar("contactNumber", { length: 32 }).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  status: mysqlEnum("status", ["completed", "missed", "rejected"]).notNull(),
  durationSeconds: int("durationSeconds").default(0).notNull(),
  twilioCallSid: varchar("twilioCallSid", { length: 64 }),
  /** Call recording (Max plan) */
  isRecorded: boolean("isRecorded").default(false).notNull(),
  recordingUrl: varchar("recordingUrl", { length: 512 }),
  recordingDuration: int("recordingDuration"),
  /** Spam score from spam_reports */
  spamScore: int("spamScore").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 512 }).notNull(),
  platform: mysqlEnum("platform", ["ios", "android", "web"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = typeof deviceTokens.$inferInsert;

// ─── Voicemails ───────────────────────────────────────────────────────────────

export const voicemails = mysqlTable("voicemails", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  callerNumber: varchar("callerNumber", { length: 32 }).notNull(),
  callerName: varchar("callerName", { length: 128 }),
  /** Twilio recording URL */
  recordingUrl: text("recordingUrl"),
  /** Twilio recording SID */
  recordingSid: varchar("recordingSid", { length: 64 }),
  /** Duration in seconds */
  durationSeconds: int("durationSeconds").default(0).notNull(),
  /** AI-generated transcript */
  transcript: text("transcript"),
  /** Whether the user has listened to this voicemail */
  isListened: boolean("isListened").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Voicemail = typeof voicemails.$inferSelect;
export type InsertVoicemail = typeof voicemails.$inferInsert;

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  number: varchar("number", { length: 32 }).notNull(),
  avatarColor: varchar("avatarColor", { length: 16 }),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  /** Whether imported from device contacts */
  isDeviceContact: boolean("isDeviceContact").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Blocked Numbers ──────────────────────────────────────────────────────────
export const blockedNumbers = mysqlTable("blocked_numbers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  number: varchar("number", { length: 32 }).notNull(),
  label: varchar("label", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BlockedNumber = typeof blockedNumbers.$inferSelect;
export type InsertBlockedNumber = typeof blockedNumbers.$inferInsert;

// ─── Spam Reports ─────────────────────────────────────────────────────────────
export const spamReports = mysqlTable("spam_reports", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 32 }).notNull().unique(),
  reportCount: int("reportCount").default(1).notNull(),
  lastReportedAt: timestamp("lastReportedAt").defaultNow().notNull(),
});
export type SpamReport = typeof spamReports.$inferSelect;

// ─── Porting Requests ─────────────────────────────────────────────────────────
export const portingRequests = mysqlTable("porting_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  number: varchar("number", { length: 32 }).notNull(),
  carrier: varchar("carrier", { length: 128 }).notNull(),
  accountPin: varchar("accountPin", { length: 32 }),
  billingAddress: text("billingAddress"),
  status: mysqlEnum("status", ["pending", "approved", "completed", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PortingRequest = typeof portingRequests.$inferSelect;
export type InsertPortingRequest = typeof portingRequests.$inferInsert;

// ─── User Settings (DND, Voicemail Greeting) ─────────────────────────────────
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dndEnabled: boolean("dndEnabled").default(false).notNull(),
  dndFrom: varchar("dndFrom", { length: 5 }).default("22:00").notNull(),
  dndUntil: varchar("dndUntil", { length: 5 }).default("08:00").notNull(),
  voicemailGreetingUrl: varchar("voicemailGreetingUrl", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
