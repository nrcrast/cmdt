import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LOG_LEVEL, getLogger, getLogLevel, LogLevel, setLogLevel } from "../src/utils/logger.js";

describe("shared logger level control", () => {
	afterEach(() => {
		setLogLevel(DEFAULT_LOG_LEVEL);
	});

	it("defaults to Info", () => {
		expect(getLogLevel()).toBe(LogLevel.Info);
	});

	it("applies the current level to newly created loggers", () => {
		setLogLevel(LogLevel.Warn);
		const logger = getLogger();
		expect(logger.settings.minLevel).toBe(LogLevel.Warn);
	});

	it("updates the level of loggers created before the change", () => {
		setLogLevel(LogLevel.Info);
		const logger = getLogger();
		expect(logger.settings.minLevel).toBe(LogLevel.Info);

		setLogLevel(LogLevel.Error);
		expect(logger.settings.minLevel).toBe(LogLevel.Error);
	});

	it("honors caller settings while forcing the global level", () => {
		setLogLevel(LogLevel.Debug);
		const logger = getLogger({ prefix: ["scoped"] });
		expect(logger.settings.prefix).toEqual(["scoped"]);
		expect(logger.settings.minLevel).toBe(LogLevel.Debug);
	});
});
