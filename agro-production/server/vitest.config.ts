import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      RPC_URL: "https://soroban-testnet.stellar.org",
      JWT_SECRET: "test-secret-key-that-is-long-enough-for-validation-32chars",
      PRODUCTION_CONTRACT_ID: "test-production-contract",
      ESCROW_CONTRACT_ID: "test-escrow-contract",
      PRODUCTION_ESCROW_CONTRACT_ID: "test-production-contract",
      BASKET_CONTRACT_ID: "test-basket-contract",
    },
  },
});
