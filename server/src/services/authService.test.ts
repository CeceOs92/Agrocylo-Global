import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_JWT_SECRET = vi.hoisted(() => 'test-jwt-secret-at-least-32-characters-long!!');

vi.mock('../config/index.js', () => ({
  config: { jwtSecret: TEST_JWT_SECRET },
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    nonce: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromPublicKey: vi.fn(),
  },
}));

import { buildSignInMessage, generateNonce, verifySignature, refreshAccessToken, logout } from './authService.js';
import { prisma } from '../config/database.js';
import { Keypair } from '@stellar/stellar-sdk';

const mockNonceUpsert = vi.mocked(prisma.nonce.upsert);
const mockNonceFindUnique = vi.mocked(prisma.nonce.findUnique);
const mockNonceDelete = vi.mocked(prisma.nonce.delete);
const mockRefreshTokenCreate = vi.mocked(prisma.refreshToken.create);
const mockRefreshTokenFindUnique = vi.mocked(prisma.refreshToken.findUnique);
const mockRefreshTokenDelete = vi.mocked(prisma.refreshToken.delete);
const mockRefreshTokenDeleteMany = vi.mocked(prisma.refreshToken.deleteMany);
const mockFromPublicKey = vi.mocked(Keypair.fromPublicKey);

const VALID_WALLET = 'GBSOMEWALLET123456';
const FUTURE_DATE_OBJ = new Date(Date.now() + 60_000);
const PAST_DATE_OBJ = new Date(Date.now() - 60_000);
const ISSUED_AT = new Date();

function challenge(overrides: Record<string, unknown> = {}) {
  return { nonce: 'some-nonce', createdAt: ISSUED_AT, expiresAt: FUTURE_DATE_OBJ, ...overrides } as any;
}

function message(row = challenge()) {
  return buildSignInMessage(VALID_WALLET, row.nonce, row.createdAt, row.expiresAt);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFromPublicKey.mockReturnValue({ verify: vi.fn().mockReturnValue(true) } as any);
  mockNonceFindUnique.mockResolvedValue(null);
});

describe('generateNonce', () => {
  it('returns a nonce for a valid Stellar address', async () => {
    mockNonceUpsert.mockResolvedValueOnce({} as any);

    const result = await generateNonce(VALID_WALLET);

    expect(result.nonce).toBeDefined();
    expect(result.message).toContain(`Wallet Address: ${VALID_WALLET}`);
    expect(typeof result.nonce).toBe('string');
    expect(result.nonce).toHaveLength(64);
    expect(mockNonceUpsert).toHaveBeenCalledOnce();
  });

  it('throws 400 for an invalid Stellar address', async () => {
    mockFromPublicKey.mockImplementationOnce(() => {
      throw new Error('Invalid key');
    });

    await expect(generateNonce('INVALID_ADDRESS')).rejects.toMatchObject({ status: 400 });
  });

  it('reuses an unexpired challenge instead of overwriting the wallet nonce', async () => {
    const row = challenge();
    mockNonceFindUnique.mockResolvedValueOnce(row);

    const result = await generateNonce(VALID_WALLET);

    expect(result.nonce).toBe(row.nonce);
    expect(mockNonceUpsert).not.toHaveBeenCalled();
  });
});

describe('verifySignature', () => {
  it('returns access and refresh tokens on valid signature', async () => {
    const row = challenge();
    mockNonceFindUnique.mockResolvedValueOnce(row);
    mockNonceDelete.mockResolvedValueOnce({} as any);
    mockRefreshTokenCreate.mockResolvedValueOnce({} as any);

    const result = await verifySignature(VALID_WALLET, 'dGVzdA==', message(row));

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(mockNonceFindUnique).toHaveBeenCalledTimes(1);
    expect(mockNonceDelete).toHaveBeenCalledTimes(1);
    expect(mockRefreshTokenCreate).toHaveBeenCalledTimes(1);
  });

  it('throws 400 for an invalid Stellar address', async () => {
    mockFromPublicKey.mockImplementationOnce(() => {
      throw new Error('Invalid');
    });

    await expect(verifySignature('INVALID', 'sig', 'message')).rejects.toMatchObject({ status: 400 });
  });

  it('throws 401 when no nonce exists for the wallet', async () => {
    mockNonceFindUnique.mockResolvedValueOnce(null);

    await expect(verifySignature(VALID_WALLET, 'sig', 'message')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when the nonce has expired', async () => {
    mockNonceFindUnique.mockResolvedValueOnce({
      nonce: 'old-nonce',
      createdAt: PAST_DATE_OBJ,
      expiresAt: PAST_DATE_OBJ,
    } as any);

    await expect(verifySignature(VALID_WALLET, 'sig', 'message')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when the signature is invalid', async () => {
    const row = challenge();
    mockNonceFindUnique.mockResolvedValueOnce(row);
    mockFromPublicKey
      .mockReturnValueOnce({ verify: vi.fn().mockReturnValue(true) } as any)
      .mockReturnValueOnce({ verify: vi.fn().mockReturnValue(false) } as any);

    await expect(verifySignature(VALID_WALLET, 'dGVzdA==', message(row))).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a message with a tampered structured field', async () => {
    const row = challenge();
    mockNonceFindUnique.mockResolvedValueOnce(row);
    await expect(
      verifySignature(VALID_WALLET, 'dGVzdA==', message(row).replace('agrocylo.global', 'evil.example')),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a challenge with an expired issued-at time', async () => {
    const row = challenge({ createdAt: new Date(Date.now() - 6 * 60 * 1000) });
    mockNonceFindUnique.mockResolvedValueOnce(row);
    await expect(verifySignature(VALID_WALLET, 'dGVzdA==', message(row))).rejects.toMatchObject({ status: 401 });
  });
});

describe('refreshAccessToken', () => {
  it('returns new tokens for a valid refresh token', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      walletAddress: VALID_WALLET,
      expiresAt: FUTURE_DATE_OBJ,
    } as any);
    mockRefreshTokenDelete.mockResolvedValueOnce({} as any);
    mockRefreshTokenCreate.mockResolvedValueOnce({} as any);

    const result = await refreshAccessToken('valid-refresh-token');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(mockRefreshTokenFindUnique).toHaveBeenCalledTimes(1);
    expect(mockRefreshTokenFindUnique).toHaveBeenCalledWith({
      where: { token: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(mockRefreshTokenDelete).toHaveBeenCalledTimes(1);
    expect(mockRefreshTokenCreate).toHaveBeenCalledTimes(1);
    expect(mockRefreshTokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ token: expect.not.stringMatching(/^valid-refresh-token$/) }),
    });
  });

  it('throws 401 for an unknown refresh token', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce(null);

    await expect(refreshAccessToken('bad-token')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 and deletes the token when it has expired', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      walletAddress: VALID_WALLET,
      expiresAt: PAST_DATE_OBJ,
    } as any);
    mockRefreshTokenDelete.mockResolvedValueOnce({} as any);

    await expect(refreshAccessToken('expired-token')).rejects.toMatchObject({ status: 401 });
    expect(mockRefreshTokenDelete).toHaveBeenCalledTimes(1);
  });
});

describe('logout', () => {
  it('deletes the refresh token from the database', async () => {
    mockRefreshTokenDeleteMany.mockResolvedValueOnce({ count: 1 } as any);

    await logout('some-refresh-token');

    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledOnce();
    expect(mockRefreshTokenDeleteMany).toHaveBeenCalledWith({
      where: { token: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
  });
});
