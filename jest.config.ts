import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/e2e/", "<rootDir>/e2e-load/", "<rootDir>/.next/", "<rootDir>/src/lib/__tests__/helpers/",
  ],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  globalSetup: "<rootDir>/jest.global-setup.ts",
};

export default createJestConfig(config);
