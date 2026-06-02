import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_DAYS || 7);

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), type: "refresh", jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.type && payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload;
}

export function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const payload = jwt.verify(token, secret);
  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token");
  }
  return payload;
}

export function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  };
}
