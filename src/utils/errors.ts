export class ConfigError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string, public readonly serverName?: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class ToolError extends Error {
  constructor(message: string, public readonly toolName?: string) {
    super(message);
    this.name = 'ToolError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs?: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function formatError(err: unknown, debug = false): string {
  if (err instanceof ConfigError) {
    return `Configuration error${err.field ? ` (${err.field})` : ''}: ${err.message}\nCheck your mcp.json config file.`;
  }
  if (err instanceof ConnectionError) {
    return `Connection error${err.serverName ? ` for server '${err.serverName}'` : ''}: ${err.message}\nEnsure the server is running and accessible.`;
  }
  if (err instanceof ToolError) {
    return `Tool error${err.toolName ? ` (${err.toolName})` : ''}: ${err.message}`;
  }
  if (err instanceof TimeoutError) {
    return `Timeout${err.timeoutMs ? ` after ${err.timeoutMs}ms` : ''}: ${err.message}\nIncrease the timeout in config or check server health.`;
  }
  if (err instanceof Error) {
    return debug ? `${err.message}\n${err.stack}` : err.message;
  }
  return String(err);
}
