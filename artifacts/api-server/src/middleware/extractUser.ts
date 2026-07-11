import type { NextFunction, Request, Response } from "express";
import { verifyToken, type AuthTokenPayload } from "../lib/jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

// Applique a TOUTES les routes /api/* sauf la liste PUBLIC_PATHS ci-dessous
// (voir index.ts). Ne jamais ajouter une route protegee a cette liste sans
// revue explicite — c'est le garde-fou central contre les routes non protegees.
export function extractUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non authentifie" });
    return;
  }

  try {
    req.user = verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    res.status(401).json({ error: "Token invalide ou expire" });
  }
}
