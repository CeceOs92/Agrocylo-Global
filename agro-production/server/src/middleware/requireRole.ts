import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/client.js';

export interface RoleRequest extends Request {
  walletAddress?: string;
  role?: string;
}

export function requireRole(requiredRole: string) {
  return async (req: RoleRequest, res: Response, next: NextFunction): Promise<void> => {
    const walletAddress = req.header('x-wallet-address');
    if (!walletAddress) {
      res.status(401).json({ message: 'Missing x-wallet-address header' });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        select: { role: true },
      });

      if (!user || user.role !== requiredRole) {
        res.status(403).json({ message: `${requiredRole} access required` });
        return;
      }

      req.walletAddress = walletAddress;
      req.role = user.role;
      next();
    } catch (err) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}
