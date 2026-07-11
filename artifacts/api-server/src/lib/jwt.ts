import jwt from "jsonwebtoken";

export interface AuthTokenPayload {
  sub: string; // user id
  licenceId: string | null; // null = platform owner (cross-tenant)
  role: "SUPER_ADMIN" | "COMMERCIAL" | "TERRAIN" | "COMPTABILITE";
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET manquant (voir .env.example)");
  return secret;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getSecret()) as AuthTokenPayload;
}
