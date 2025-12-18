import { config } from "dotenv";
import { z } from "zod";
import { Logger } from "../koa/logger.ts";

config({ override: true, path: [".env", ".env.local"] });

const envLogger = new Logger({
  tags: ["config"],
});

const envSchema = z.object({
  DATA_PATH: z.string().default(".data"),

  // server
  PORT: z.coerce.number().int().max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),

  REDIS_URL: z
    .url()
    .regex(/^rediss?:/)
    .default("redis://localhost:6379"),

  REDIS_PASSWORD: z.string().optional(),

  REDIS_DATABASE: z.coerce.number().int().default(0),

  API_AUTH_TOKEN: z.string().optional(),

  GC: z
    .enum(["0", "1"])
    .default("1")
    .transform((v) => v !== "0"),

  // gc interval (ms)
  GC_INTERVAL: z.coerce
    .number()
    .int()
    .default(60 * 1000),

  // gc cycle timeout (ms)
  GC_TIMEOUT: z.coerce.number().int().default(1000),

  // how many streams to check in each GC cycle
  GC_BATCH_SIZE: z.coerce.number().int().default(1000),

  // force gc max age (ms)
  GC_STREAM_MAX_AGE: z.coerce
    .number()
    .int()
    .default(60 * 100000),

  WEBHOOK_URLS: z
    .string()
    .transform((urls) => urls.split(","))
    .optional(),
});

const env = envSchema.parse(process.env);

envLogger.info(process.execArgv.join(" "));
envLogger.info(env);

export default env;
