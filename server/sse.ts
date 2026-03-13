/**
 * Server-Sent Events (SSE) for real-time message delivery.
 *
 * Clients connect to GET /api/sse?conversationId=<id>&userId=<id>
 * and receive events when new messages arrive in that conversation.
 *
 * The webhook SMS handler calls notifyConversation() to push events.
 */

import type { Express, Request, Response } from "express";

type SSEClient = {
  userId: number;
  conversationId: number;
  res: Response;
};

// In-memory registry of connected SSE clients
const clients: Set<SSEClient> = new Set();

/**
 * Notify all SSE clients watching a conversation that a new message arrived.
 */
export function notifyConversation(conversationId: number, message: {
  id?: number;
  text: string;
  isMe: boolean;
  createdAt?: Date;
  mediaUrl?: string | null;
}): void {
  const payload = JSON.stringify({
    type: "new_message",
    conversationId,
    message: {
      ...message,
      createdAt: message.createdAt?.toISOString() ?? new Date().toISOString(),
    },
  });

  for (const client of clients) {
    if (client.conversationId === conversationId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
}

/**
 * Notify all SSE clients for a user that a new conversation was created or updated.
 */
export function notifyUserConversations(userId: number): void {
  const payload = JSON.stringify({ type: "conversations_updated" });
  for (const client of clients) {
    if (client.userId === userId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
}

/**
 * Register the SSE route on the Express app.
 */
export function registerSSERoutes(app: Express): void {
  /**
   * GET /api/sse
   * Query params: conversationId (number), userId (number)
   *
   * Opens a persistent SSE connection. The client receives:
   * - { type: "connected" } on connect
   * - { type: "new_message", conversationId, message } when a new message arrives
   * - { type: "conversations_updated" } when the conversation list changes
   * - { type: "ping" } every 30s to keep the connection alive
   */
  app.get("/api/sse", (req: Request, res: Response) => {
    const conversationId = parseInt(req.query.conversationId as string, 10);
    const userId = parseInt(req.query.userId as string, 10);

    if (isNaN(conversationId) || isNaN(userId)) {
      res.status(400).json({ error: "conversationId and userId are required" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    const client: SSEClient = { userId, conversationId, res };
    clients.add(client);

    console.log(`[SSE] Client connected: userId=${userId}, conversationId=${conversationId}. Total: ${clients.size}`);

    // Send connected event
    res.write(`data: ${JSON.stringify({ type: "connected", conversationId })}\n\n`);

    // Heartbeat every 30 seconds to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
      } catch {
        clearInterval(heartbeat);
        clients.delete(client);
      }
    }, 30_000);

    // Clean up on disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(client);
      console.log(`[SSE] Client disconnected: userId=${userId}. Total: ${clients.size}`);
    });
  });

  /**
   * GET /api/sse/status
   * Returns the number of connected SSE clients (for debugging).
   */
  app.get("/api/sse/status", (_req: Request, res: Response) => {
    res.json({ connectedClients: clients.size });
  });
}
