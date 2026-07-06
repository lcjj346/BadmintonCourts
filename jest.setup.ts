import "@testing-library/jest-dom";

// next/jest loads .env via loadEnvConfig before this file runs, so
// DATABASE_URL/DIRECT_URL/IP_HASH_SALT are normally already set from the
// real dev .env. This fallback only kicks in if .env is missing a value,
// so `env.ts`'s import-time zod parse never throws in CI/sandbox setups.
process.env.IP_HASH_SALT ??= "test-salt";
