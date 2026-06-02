import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { ConversationSession } from "../models/Conversation.js";

const router = Router();
router.use(authMiddleware);

/** List recent translation history */
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const docs = await ConversationSession.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      sessions: docs.map((d) => ({
        id: d.clientId,
        messages: d.messages,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (err) {
    console.error("[history]", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

/** Append a single message to a session (or create) */
router.post("/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message?.sentence) {
      return res.status(400).json({ error: "sessionId and message.sentence required" });
    }

    const doc = await ConversationSession.findOneAndUpdate(
      { userId: req.userId, clientId: sessionId },
      {
        $push: { messages: message },
        $set: { updatedAt: Date.now() },
        $setOnInsert: { createdAt: Date.now() },
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, sessionId: doc.clientId, messageCount: doc.messages.length });
  } catch (err) {
    console.error("[history/message]", err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

export default router;
