import pino from "pino";

export const logger = pino({
  redact: {
    paths: ["phone", "*.phone", "editToken", "*.editToken", "req.url"],
    censor: "[redacted]",
  },
});
