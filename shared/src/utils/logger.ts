import { type ILogObj, type ISettingsParam, Logger } from "tslog";

/**
 * Log levels for the shared engine, aligned 1:1 with tslog's numeric levels.
 * `Silent` sits above `Fatal` so selecting it suppresses all output.
 */
export enum LogLevel {
	Silly = 0,
	Trace = 1,
	Debug = 2,
	Info = 3,
	Warn = 4,
	Error = 5,
	Fatal = 6,
	Silent = 7,
}

export const DEFAULT_LOG_LEVEL = LogLevel.Info;

let currentLevel: LogLevel = DEFAULT_LOG_LEVEL;

// Live loggers are tracked as WeakRefs so a runtime level change can be applied
// to already-created loggers without keeping them alive (they are created per
// parse/analysis and should remain collectable).
const loggers = new Set<WeakRef<Logger<ILogObj>>>();

/**
 * Creates a logger wired into the shared engine's global level control. Every
 * module in `shared` should obtain its logger from here instead of constructing
 * `new Logger()` directly, so {@link setLogLevel} can raise or lower verbosity
 * for the whole engine at runtime (e.g. from the viewer UI or the CLI).
 */
export function getLogger(settings?: ISettingsParam<ILogObj>): Logger<ILogObj> {
	// `minLevel` is forced last so the global level always wins over any caller settings.
	const logger = new Logger<ILogObj>({ ...settings, minLevel: currentLevel });
	loggers.add(new WeakRef(logger));
	return logger;
}

/** The current global log level for the shared engine. */
export function getLogLevel(): LogLevel {
	return currentLevel;
}

/**
 * Sets the global log level for the shared engine. Applies to loggers already
 * created and any created afterwards: tslog reads `minLevel` on every call, so
 * mutating a live logger's settings takes effect immediately. Dead WeakRefs are
 * pruned as they are encountered.
 */
export function setLogLevel(level: LogLevel): void {
	currentLevel = level;
	for (const ref of loggers) {
		const logger = ref.deref();
		if (logger) {
			logger.settings.minLevel = level;
		} else {
			loggers.delete(ref);
		}
	}
}
