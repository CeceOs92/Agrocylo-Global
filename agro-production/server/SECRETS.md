# Secrets Management & Rotation Runbook

## Overview

This document describes how secrets are managed, stored, and rotated for the Agrocylo Production Server.

## Secret Storage

Secrets are stored in the deployment platform's secret manager:
- **Environment**: AWS Secrets Manager / GitHub Secrets (depending on deployment platform)
- **Access**: Restricted to authorized operations and CI/CD pipelines
- **Rotation**: Follow the rotation procedures below

### Required Secrets in Production

The following environment variables are required in production:

- `JWT_SECRET`: Private key used to sign authentication tokens (min 32 chars)
- `RPC_URL`: Stellar RPC endpoint URL
- `PRODUCTION_CONTRACT_ID`: On-chain contract ID
- `ESCROW_CONTRACT_ID`: On-chain escrow contract ID
- `METRICS_API_KEY`: API key for `/metrics` endpoints (any value, must be non-empty in production)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Supabase admin operations

## JWT Secret Rotation

JWT secrets must be rotated periodically to minimize exposure if a key is compromised.

### Rotation Procedure (with Overlap Window)

The following procedure ensures active sessions continue working during rotation:

#### Step 1: Generate New JWT Secret

Generate a cryptographically random string ≥ 32 characters:

```bash
openssl rand -base64 32
```

#### Step 2: Set Up Overlap Window (5 minutes recommended)

Before deploying the rotation:

1. Record the current time: `T0`
2. Calculate overlap window end: `T0 + 5 minutes`
3. All tokens signed with OLD secret remain valid until the overlap window closes

#### Step 3: Deploy New Secret as PRIMARY

1. Update the deployment platform's secret manager with the new `JWT_SECRET`
2. Deploy the server with the new secret
3. **NEW tokens** will be signed with the new secret
4. **OLD tokens** (signed before deployment) continue to work if they were issued within the overlap window

#### Step 4: Monitor Session Continuity

During the 5-minute overlap window:
- Monitor application logs for authentication errors
- Confirm existing sessions remain valid
- Check that new logins work correctly

#### Step 5: Close Overlap Window

After the overlap window expires:
- OLD tokens become invalid (they expire naturally anyway)
- Only NEW tokens (signed with the new secret) are valid

### Technical Details

- **Token Format**: JWT (JSON Web Tokens)
- **Signing Algorithm**: HS256 (HMAC with SHA-256)
- **Token Lifetime**: Typically 24 hours (configurable per deployment)
- **Overlap Window**: 5 minutes (recommended; allows for clock skew and slow session re-login)
- **Implementation**: The overlap window is achieved by keeping both secrets briefly; new signatures use the new secret, but validation accepts both old and new

### Example Rotation Timeline

```
00:00 - Old secret in use, tokens signed with old secret
00:00 - New secret deployed to production
00:01 - Old tokens still valid (within overlap window)
00:05 - Overlap window closes
00:05+ - Only new tokens accepted
```

## Secrets Validation

The server validates secrets at startup:

```
✓ JWT_SECRET must be at least 32 characters long in production
✗ JWT_SECRET cannot be the development default value in production
✓ METRICS_API_KEY must be non-empty in production
✓ SUPABASE_SERVICE_ROLE_KEY must be non-empty in production
```

If any validation fails, the server **will not start**.

### Development

In development mode (`NODE_ENV=development`):
- `JWT_SECRET` defaults to `dev-secret-key-do-not-use-in-production`
- `METRICS_API_KEY` defaults to empty (no auth required)
- `SUPABASE_SERVICE_ROLE_KEY` defaults to empty

## Secret Scanning

The CI pipeline includes a secret-scanning step (TruffleHog) that runs on every PR and push:

```yaml
- name: Run TruffleHog secret scanning
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./agro-production/server
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
```

If secrets are detected in committed code:
1. **Immediately revoke** the exposed secret from the secret manager
2. **Generate a new secret** following the rotation procedure
3. **Force-push the fix** to remove the secret from git history (if already committed)
4. **Update all dependent systems** with the new secret

## Emergency Rotation

If a secret is suspected to be compromised:

1. **Generate a new secret immediately** (do not wait for scheduled rotation)
2. **Update the secret manager** in the deployment platform
3. **Deploy immediately** — do not wait for the next scheduled deployment
4. **Invalidate any tokens signed with the old secret** (if possible in your auth system)
5. **Notify security team** and document the incident

## Testing Rotations

This should be rehearsed in a staging/testing environment before performing in production:

1. Deploy with the old secret
2. Create some test sessions/tokens
3. Deploy with the new secret (with overlap window configured)
4. Verify old sessions still work
5. Create new sessions/tokens
6. Verify new tokens work
7. Let overlap window close
8. Verify old sessions are now rejected (or expire naturally)

**Status**: This runbook has been written and is technically complete. Testing a rotation in a real environment (step above) is a live process step that must be performed separately to confirm this runbook works as documented.
