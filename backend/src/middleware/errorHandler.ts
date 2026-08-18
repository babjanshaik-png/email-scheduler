import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        code,
        statusCode,
      },
      url: req.url,
      method: req.method,
    },
    '🔥 Unhandled Exception in API Request'
  );

  res.status(statusCode).json({
    status: 'error',
    code,
    message: statusCode === 500 ? 'An unexpected internal server error occurred.' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
