import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const router = Router();

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Email and password (6+ chars) required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split("@")[0],
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    });
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

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
