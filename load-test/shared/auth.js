/**
 * load-test/shared/auth.js
 *
 * Lightweight JWT builder using k6's built-in crypto.
 * Generates HS256 tokens compatible with the walletAuth middleware used by
 * both server/ and agro-production/server/.
 *
 * Usage:
 *   import { makeJwt, authHeader } from "../shared/auth.js";
 *   const token = makeJwt(ENV.TEST_WALLET_ADDRESS, ENV.JWT_SECRET);
 *   const headers = authHeader(token);
 */

import { hmac } from "k6/crypto";
import { ENV } from "./env.js";

/**
 * Base64URL encode a Uint8Array or string.
 * k6's encoding module returns standard base64; we strip padding and replace chars.
 */
function b64url(input) {
  // k6 built-in: encoding.b64encode returns standard base64 string
  const std = btoa(
    typeof input === "string"
      ? input
      : String.fromCharCode(...new Uint8Array(input)),
  );
  return std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build a signed HS256 JWT for the given wallet address.
 *
 * @param {string} walletAddress  – Stellar G-address of the virtual user.
 * @param {string} secret         – HMAC secret (must match server JWT_SECRET).
 * @param {number} [ttlSeconds]   – Token lifetime in seconds (default 1 hour).
 * @returns {string} Signed JWT string.
 */
export function makeJwt(walletAddress, secret, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      walletAddress,
      iat: now,
      exp: now + ttlSeconds,
    }),
  );

  const signingInput = `${header}.${payload}`;
  // k6 hmac() returns hex by default; we need raw bytes → base64url.
  const sigHex = hmac("sha256", secret, signingInput, "hex");

  // Convert hex string → Uint8Array → base64url
  const bytes = new Uint8Array(sigHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(sigHex.substr(i * 2, 2), 16);
  }
  const sig = b64url(bytes);

  return `${signingInput}.${sig}`;
}

/**
 * Return an HTTP headers object with a Bearer Authorization header.
 *
 * @param {string} token  – JWT returned by makeJwt().
 * @returns {object}
 */
export function authHeader(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Return headers with a wallet-address x-header variant (agro-production
 * server also accepts x-wallet-address for internal calls).
 */
export function walletHeader(walletAddress, token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-wallet-address": walletAddress,
  };
}

/**
 * Pre-build a buyer token and a seller token once per VU setup.
 * Re-using a single token per VU avoids repeated crypto work in the hot path.
 */
export function buildVuTokens() {
  return {
    buyerToken:  makeJwt(ENV.TEST_WALLET_ADDRESS,  ENV.JWT_SECRET),
    sellerToken: makeJwt(ENV.TEST_SELLER_ADDRESS, ENV.JWT_SECRET),
    buyerHeaders:  authHeader(makeJwt(ENV.TEST_WALLET_ADDRESS,  ENV.JWT_SECRET)),
    sellerHeaders: authHeader(makeJwt(ENV.TEST_SELLER_ADDRESS, ENV.JWT_SECRET)),
  };
}
