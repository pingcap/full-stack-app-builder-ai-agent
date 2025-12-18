import Koa from "koa";
import { scheduleGC } from "./gc.ts";
import { afterSupport } from "./koa/after.ts";
import { Logger, loggerSupport } from "./koa/logger.ts";
import { redisSupport } from "./koa/redis.ts";
import { requestId } from "./koa/request-id.ts";
import { auth } from "./middlewares/auth.ts";
import errorHandling from "./middlewares/error-handling.ts";
import { getFSStreamProvider } from "./providers/fs.ts";
import { getRedisStreamProvider } from "./providers/redis.ts";
import echoRouter from "./routes/echo/route.ts";
import streamsV2Router from "./routes/v2/streams.ts";
import env from "./utils/env.ts";
import { enableShutdownGracefully } from "./utils/shutdown-gracefully.ts";

export default function startApp() {
  const appLogger = new Logger({
    tags: ["app"],
  });

  const app = new Koa({
    asyncLocalStorage: true,
  });

  // place this first to catch all errors
  app.use(errorHandling);

  app.use(requestId());
  app.use(loggerSupport());
  app.use(afterSupport());
  app.use(redisSupport);

  app.use(auth);

  const fsProvider = getFSStreamProvider();
  app.use((context, next) => {
    Object.defineProperty(context, "streams", {
      value: Object.freeze({
        fs: fsProvider,
        redis: getRedisStreamProvider(context as any),
      }),
      writable: false,
      enumerable: true,
      configurable: false,
    });
    return next();
  });

  app.use(echoRouter.routes());
  app.use(streamsV2Router.routes());

  appLogger.log("info", "listening", env.PORT);

  const server = app.listen(env.PORT, env.HOST, () => {
    process.send?.("ready");
    appLogger.log("info", `ready on http://${env.HOST}:${env.PORT}`);
  });

  server.setTimeout(0);
  server.timeout = 0;
  server.keepAliveTimeout = 0;
  server.requestTimeout = 0;

  process.addListener("uncaughtException", (error, origin) => {
    if ("context" in error && error.context === "Socket closed.") {
      return;
    }

    appLogger.log("error", "uncaughtException", error);
    // process.exit(1);
  });

  if (env.GC) {
    scheduleGC();
  }

  enableShutdownGracefully(server);
}
