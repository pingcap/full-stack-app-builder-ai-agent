import chalk from 'chalk';
import type { Middleware } from 'koa';
import { Writable } from 'node:stream';
import util from 'node:util';
import { isAbortError } from '../middlewares/error-handling.ts';
import type { RequestIdContextHelpers } from './request-id.ts';

export interface LoggerContextHelpers extends RequestIdContextHelpers {
  readonly logger: Logger;
  disableRequestLog: boolean;
}

export interface LoggerOptions {
  tags?: string[];
  target?: Writable;
  errorTarget?: Writable;
  levels?: Partial<Record<LoggerLevel, boolean>>;
}

export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
const loggerLevelsTag: Record<LoggerLevel, string> = {
  debug: chalk.grey('[DEBUG]'),
  info: '[INFO ]',
  warn: chalk.yellow.bold('[WARN ]'),
  error: chalk.red.bold('[ERROR]'),
};

export class Logger {
  tags: string[];
  target: Writable;
  errorTarget: Writable;
  levels: Record<LoggerLevel, boolean>;

  constructor ({ tags = [], target = process.stdout, errorTarget = process.stderr, levels }: LoggerOptions = {}) {
    this.tags = tags;
    this.target = target;
    this.errorTarget = errorTarget;
    this.levels = {
      debug: true,
      info: true,
      warn: true,
      error: true,
      ...levels,
    };
  }

  log (level: LoggerLevel, ...args: any[]) {
    if (!this.levels[level]) {
      return;
    }
    const message = args.map(arg => typeof arg === 'string' ? arg : util.inspect(arg, { colors: true, compact: args.length > 1 })).join(' ');
    const date = chalk.grey('[' + new Date().toISOString() + ']');
    const levelTag = loggerLevelsTag[level];
    (level === 'error' ? this.errorTarget : this.target).write(levelTag + date + this.tags.map(tag => `[${tag}]`).join('') + ': ' + message + '\n');
  }

  debug (...args: any[]) {
    this.log('debug', ...args);
  }

  info (...args: any[]) {
    this.log('info', ...args);
  }

  warn (...args: any[]) {
    this.log('warn', ...args);
  }

  error (...args: any[]) {
    this.log('error', ...args);
  }

  tag (tag: string) {
    return new Logger({
      tags: [...this.tags, tag],
      target: this.target,
      levels: this.levels,
    });
  }
}

export function loggerSupport<State, ResponseBody> () {
  const middleware: Middleware<State, LoggerContextHelpers, LoggerOptions> = async (ctx, next) => {
    const logger = new Logger({
      tags: ['request:' + ctx.requestId],
    });

    Object.defineProperty(ctx, 'logger', {
      value: logger,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(ctx, 'disableRequestLog', {
      value: false,
      enumerable: false,
      configurable: false,
      writable: true,
    });

    let aborted = false;

    try {
      return await next();
    } catch (e) {
      if (isAbortError(e)) {
        logger.log('warn', chalk.grey('---'), ctx.method, chalk.grey(ctx.url), 'aborted');
        aborted = true;
      }

      return Promise.reject(e);
    } finally {
      if (!ctx.disableRequestLog) {
        if (!aborted) {
          let statusC: string;
          if (ctx.status >= 400) {
            statusC = chalk.red(ctx.status.toString());
          } else if (ctx.status >= 300) {
            statusC = chalk.yellow(ctx.status.toString());
          } else {
            statusC = chalk.green(ctx.status.toString());
          }

          logger.log('info', statusC, ctx.method, chalk.grey(ctx.url));
        }
      }
    }
  };

  return middleware;
}

if (import.meta.filename === process.argv[1]) {
  const logger = new Logger();
  logger.log('debug', 'hello world');
  logger.log('info', 'hello world');
  logger.log('warn', 'hello world');
  logger.log('error', 'hello world', new Error('hello world'));

  logger.tag('test').log('debug', 'hello world', 3);
}