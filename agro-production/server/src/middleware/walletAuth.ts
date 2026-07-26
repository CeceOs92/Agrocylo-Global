import type { NextFunction, Request, Response } from 'express';
import { verifySession, AuthError } from '../services/walletAuthService.js';

export interface WalletRequest extends Request {
  walletAddress?: string;
  sessionToken?: string;
}

export function requireWallet(
  req: WalletRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.header('authorization');

  if (!authHeader) {
    res.status(401).json({ message: 'Authentication required. Provide Authorization: Bearer <session_token>.' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ message: 'Invalid Authorization header format. Expected: Bearer <session_token>.' });
    return;
  }

  const sessionToken = parts[1];
  verifySession(sessionToken)
    .then((session) => {
      req.walletAddress = session.walletAddress;
      req.sessionToken = session.sessionToken;
      next();
    })
    .catch((err: unknown) => {
      if (err instanceof AuthError) {
        res.status(err.status).json({ message: err.message });
        return;
      }
      res.status(401).json({ message: 'Authentication failed.' });
    });
}
