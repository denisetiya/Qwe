export const LogLevel = {
  Trace: 0,
  Debug: 10,
  Info: 20,
  Warn: 30,
  Error: 40,
  Fatal: 50,
  Off: 100,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export type LogLevelName = 'Trace' | 'Debug' | 'Info' | 'Warn' | 'Error' | 'Fatal' | 'Off';

export function levelToName(level: LogLevel): LogLevelName {
  if (level <= LogLevel.Trace) return 'Trace';
  if (level <= LogLevel.Debug) return 'Debug';
  if (level <= LogLevel.Info) return 'Info';
  if (level <= LogLevel.Warn) return 'Warn';
  if (level <= LogLevel.Error) return 'Error';
  if (level <= LogLevel.Fatal) return 'Fatal';
  return 'Off';
}

export function nameToLevel(name: LogLevelName): LogLevel {
  return LogLevel[name];
}
