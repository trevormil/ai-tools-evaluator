/**
 * A deliberately thin wrapper around `console` with levels. No dependency, no
 * transport — just leveled, prefixed lines that are cheap to inject/silence in
 * tests. (Global §6: logging is a thin console wrapper.)
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export type Logger = {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export function createLogger(min: LogLevel = "info"): Logger {
  const at = (level: LogLevel) => ORDER[level] >= ORDER[min];
  const stamp = (level: string, msg: string) =>
    `${new Date().toISOString()} [scanner] ${level.padEnd(5)} ${msg}`;
  return {
    debug: (m) => at("debug") && console.error(stamp("debug", m)),
    info: (m) => at("info") && console.error(stamp("info", m)),
    warn: (m) => at("warn") && console.error(stamp("warn", m)),
    error: (m) => at("error") && console.error(stamp("error", m)),
  };
}

/** A no-op logger for tests that don't care about output. */
export const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
