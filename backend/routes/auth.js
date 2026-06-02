import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
} from "../services/tokens.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
const BCRYPT_ROUNDS = 12;
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_DAYS || 7);

async function issueSession(user, res) {
  user.pruneRefreshTokens();
  const refreshToken = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

  user.refreshTokens.push({ tokenHash, expiresAt, deviceId: "web" });
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  await user.save();

  res.cookie("refreshToken", refreshToken, refreshCookieOptions());

  return {
    token: signAccessToken(user),
    user: { id: user._id, email: user.email, displayName: user.displayName },
  };
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Email and password (6+ chars) required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split("@")[0],
    });

    const session = await issueSession(user, res);
    res.status(201).json(session);
  } catch (err) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const session = await issueSession(user, res);
    res.json(session);
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "User not found" });

    const tokenHash = hashToken(refreshToken);
    user.pruneRefreshTokens();
    const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
    if (!stored) {
      return res.status(401).json({ error: "Refresh token revoked" });
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    const session = await issueSession(user, res);
    res.json({ token: session.token });
  } catch (err) {
    console.error("[auth/refresh]", err);
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const user = await User.findById(req.userId);
    if (user && refreshToken) {
      const tokenHash = hashToken(refreshToken);
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
      await user.save();
    }
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[auth/logout]", err);
    res.status(500).json({ error: "Logout failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = hashToken(resetToken);
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      if (process.env.NODE_ENV !== "production") {
        console.info("[auth/forgot-password] dev reset token:", resetToken);
      }
    }

    res.json({ ok: true, message: "If that email exists, a reset link was sent." });
  } catch (err) {
    console.error("[auth/forgot-password]", err);
    res.status(500).json({ error: "Request failed" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: "Token and password (6+ chars) required" });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.refreshTokens = [];
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    res.status(500).json({ error: "Reset failed" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash -refreshTokens");
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
    res.status(500).json({ error: "Failed to load profile" });
  }
});

export default router;
