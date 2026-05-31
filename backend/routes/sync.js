import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { ConversationSession } from "../models/Conversation.js";

const router = Router();
router.use(authMiddleware);

/** Push local sessions to cloud (merge by clientId) */
router.post("/push", async (req, res) => {
  try {
    const { sessions } = req.body;
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: "sessions array required" });
    }

    let upserted = 0;
    for (const sess of sessions) {
      if (!sess.id) continue;
      await ConversationSession.findOneAndUpdate(
        { userId: req.userId, clientId: sess.id },
        {
          userId: req.userId,
          clientId: sess.id,
          messages: sess.messages ?? [],
          createdAt: sess.createdAt ?? Date.now(),
          updatedAt: sess.updatedAt ?? Date.now(),
        },
        { upsert: true, new: true }
      );
      upserted++;
    }

    res.json({ ok: true, upserted });
  } catch (err) {
    console.error("[sync/push]", err);
    res.status(500).json({ error: "Sync push failed" });
  }
});

/** Pull all cloud sessions for this user */
router.get("/pull", async (req, res) => {
  try {
    const docs = await ConversationSession.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const sessions = docs.map((d) => ({
      id: d.clientId,
      messages: d.messages,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    res.json({ sessions });
  } catch (err) {
    console.error("[sync/pull]", err);
    res.status(500).json({ error: "Sync pull failed" });
  }
});

export default router;
