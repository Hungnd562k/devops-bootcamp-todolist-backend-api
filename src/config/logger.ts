import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const service = process.env.SERVICE_NAME || 'todolist-backend-api';
const environment = process.env.NODE_ENV || 'development';
const maxPayloadBytes = Number(process.env.LOG_MAX_PAYLOAD_BYTES || 10_000);
const sensitiveFieldPattern =
  /authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key/i;

const sanitize = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveFieldPattern.test(key) ? '[REDACTED]' : sanitize(item, seen),
    ]),
  );
};

const limitPayload = (value: unknown): unknown => {
  const sanitized = sanitize(value);
  const serialized = JSON.stringify(sanitized);

  if (serialized === undefined) {
    return sanitized;
  }

  if (Buffer.byteLength(serialized) <= maxPayloadBytes) {
    return sanitized;
  }

  return {
    truncated: true,
    original_size_bytes: Buffer.byteLength(serialized),
    preview: serialized.slice(0, maxPayloadBytes),
  };
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: 'UnknownError',
    message: String(error),
  };
};

const write = (level: LogLevel, message: string, context: LogContext = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    environment,
    message,
    ...context,
  };

  const output = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(`${output}\n`);
    return;
  }

  process.stdout.write(`${output}\n`);
};

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, error?: unknown, context: LogContext = {}) =>
    write('error', message, {
      ...context,
      ...(error === undefined ? {} : { error: serializeError(error) }),
    }),
};

export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || randomUUID();
  const startedAt = process.hrtime.bigint();
  const requestPath = req.path;
  let responseBody: unknown;

  res.setHeader('x-request-id', requestId);

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response['json'];

  const originalSend = res.send.bind(res);
  res.send = ((body: unknown) => {
    if (responseBody === undefined) {
      responseBody = body;
    }
    return originalSend(body);
  }) as Response['send'];

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const context = {
      log_type: 'http_access',
      request_id: requestId,
      method: req.method,
      path: requestPath,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      response_size_bytes: Number(res.getHeader('content-length')) || 0,
      client_ip: req.ip,
      user_agent: req.header('user-agent'),
      request: {
        method: req.method,
        path: requestPath,
        original_url: req.originalUrl,
        query: limitPayload(req.query),
        headers: limitPayload(req.headers),
        body: limitPayload(req.body),
      },
      response: {
        status: res.statusCode,
        headers: limitPayload(res.getHeaders()),
        body: limitPayload(responseBody),
      },
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP request completed with server error', undefined, context);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP request completed with client error', context);
    } else {
      logger.info('HTTP request completed', context);
    }
  });

  next();
};
