import pino from 'pino';

export interface LoggerOptions {
  level: string;
  nodeEnv: string;
}

/**
 * Creates the application-wide structured JSON logger.
 * In development, pipes through pino-pretty for readability.
 * In production, emits raw JSON for log aggregators.
 */
export function createLogger(opts: LoggerOptions): pino.Logger {
  const transport =
    opts.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined;

  return pino({
    level: opts.level,
    transport,
    base: { service: 'shaavir-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      req: (req: { method?: string; url?: string; correlationId?: string }) => ({
        method: req.method,
        url: req.url,
        correlationId: req.correlationId,
      }),
      res: (res: { statusCode?: number }) => ({
        statusCode: res.statusCode,
      }),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-user-email"]',
        'body.password',
        'body.token',
        'body.ssoToken',
        'body.panNumber',
        'body.aadhaarNumber',
        'body.bankAccountNumber',
        'body.bankIFSC',
      ],
      censor: '[REDACTED]',
    },
  });
}
