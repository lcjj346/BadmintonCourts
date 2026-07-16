import pino from "pino";

export const logger = pino({
  redact: {
    paths: ["phone", "*.phone", "batchToken", "*.batchToken", "req.url"],
    censor: "[redacted]",
  },
});
