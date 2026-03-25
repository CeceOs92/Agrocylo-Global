import { Router } from 'express';
import type { Response } from 'express';
import { requireWallet, type WalletRequest } from '../middleware/walletAuth.js';
import {
  getProfile,
  createProfile,
  updateProfile,
  registerLocation,
  updateLocationVisibility,
} from '../services/profileService.js';
import logger from '../config/logger.js';

const router = Router();

/** GET /profile/:wallet — public profile lookup */
router.get('/profile/:wallet', async (req, res) => {
  try {
    const profile = await getProfile(req.params.wallet!);
    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }
    res.json(profile);
  } catch (error) {
    logger.error('Failed to get profile', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /profile — create profile (requires x-wallet-address) */
router.post('/profile', requireWallet, async (req: WalletRequest, res: Response) => {
  try {
    const { role, display_name, bio, avatar_url } = req.body;

    if (!role || !['farmer', 'buyer'].includes(role)) {
      res.status(400).json({ message: 'role must be "farmer" or "buyer"' });
      return;
    }
    if (!display_name?.trim()) {
      res.status(400).json({ message: 'display_name is required' });
      return;
    }

    const profile = await createProfile({
      wallet_address: req.walletAddress!,
      role,
      display_name: display_name.trim(),
      bio: bio?.trim(),
      avatar_url,
    });

    res.status(201).json(profile);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      res.status(409).json({ message: 'Profile already exists for this wallet' });
      return;
    }
    logger.error('Failed to create profile', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** PATCH /profile — update own profile (requires x-wallet-address) */
router.patch('/profile', requireWallet, async (req: WalletRequest, res: Response) => {
  try {
    const { display_name, bio, avatar_url } = req.body;
    const profile = await updateProfile(req.walletAddress!, {
      display_name,
      bio,
      avatar_url,
    });
    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }
    res.json(profile);
  } catch (error) {
    logger.error('Failed to update profile', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** POST /location — register or update location (requires x-wallet-address) */
router.post('/location', requireWallet, async (req: WalletRequest, res: Response) => {
  try {
    const { latitude, longitude, city, country, is_public } = req.body;

    await registerLocation({
      wallet_address: req.walletAddress!,
      latitude: Number(latitude),
      longitude: Number(longitude),
      city: city || null,
      country: country || null,
      is_public: is_public !== false,
    });

    res.status(201).json({ message: 'Location registered' });
  } catch (error) {
    logger.error('Failed to register location', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** PATCH /location — update location visibility (requires x-wallet-address) */
router.patch('/location', requireWallet, async (req: WalletRequest, res: Response) => {
  try {
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
      res.status(400).json({ message: 'is_public must be a boolean' });
      return;
    }
    await updateLocationVisibility(req.walletAddress!, is_public);
    res.json({ message: 'Location visibility updated' });
  } catch (error) {
    logger.error('Failed to update location', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
