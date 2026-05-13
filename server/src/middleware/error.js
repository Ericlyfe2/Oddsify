import { HttpError } from '../utils/httpError.js';
import { log } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'API route not found', path: req.originalUrl });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extras });
  }
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues?.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  log.error('unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
}
