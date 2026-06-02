import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = Router();
router.use(authMiddleware);

router.patch("/me", async (req, res) => {
  try {
    const { displayName, avatarUrl } = req.body;
    const updates = {};
    if (typeof displayName === "string") updates.displayName = displayName.trim().slice(0, 80);
    if (typeof avatarUrl === "string") updates.avatarUrl = avatarUrl.trim().slice(0, 500);

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select(
      "-passwordHash -refreshTokens"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("[users/me]", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

export default router;
