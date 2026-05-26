# Frontend Setup & Documentation

## Onboarding Guide

Target: Contributor onboarding < 20 minutes.

### Setup

```bash
cd client
npm install
npm run dev
```

### Wallet Setup

1. **Freighter Setup:** Install Freighter extension, create a testnet wallet.
2. **Fund Wallet:** Use Stellar Laboratory to fund.
3. **Network Config:** Ensure network is set to Testnet.

### API Config & Environment Variables

Make sure these are present in `.env.local`:
```
PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
PUBLIC_API_URL=http://localhost:3000
```

### Troubleshooting & Geolocation Debugging

- **Geolocation issues:** The onboarding flow handles timeout, permission denied, and reverse-geocoding fetch failures. 
- You can manually enter location data if geocoding fails.
- During development, `console.error` logs async geolocation failures.
