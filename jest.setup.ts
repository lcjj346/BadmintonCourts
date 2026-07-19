import "@testing-library/jest-dom";

// next/jest loads env files via loadEnvConfig before this file runs — and since
// Jest sets NODE_ENV=test, .env.test (the dedicated test schema) wins over .env.
// This fallback only kicks in if no file provided a value, so `env.ts`'s
// import-time zod parse never throws in CI/sandbox setups.
process.env.IP_HASH_SALT ??= "test-salt";
