/** Tiny structured logger. Replace with pino/winston later if needed. */
const COLORS = {
  info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', security: '\x1b[35m', reset: '\x1b[0m',
};

function out(level, ...args) {
  const ts = new Date().toISOString();
  const tag = `${COLORS[level] || ''}[${level.toUpperCase()}]${COLORS.reset}`;
  console.log(`${ts} ${tag}`, ...args);
}

export const log = {
  info:    (...a) => out('info', ...a),
  warn:    (...a) => out('warn', ...a),
  error:   (...a) => out('error', ...a),
  security:(...a) => out('security', ...a),
};
