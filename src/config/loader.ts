import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { ConfigSchema, type Config } from './schema.js';
import { ConfigError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{env:([^}]+)\}/g, (_, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      logger.warn(`Environment variable '${varName}' is not set`);
      return '';
    }
    return envValue;
  });
}

function interpolateObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(val);
    }
    return result;
  }
  return obj;
}

function loadConfigFile(filePath: string): unknown {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    throw new ConfigError(
      `Failed to parse config file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function mergeConfigs(base: unknown, override: unknown): unknown {
  if (base === null || base === undefined) return override;
  if (override === null || override === undefined) return base;
  if (typeof base !== 'object' || typeof override !== 'object') return override;
  if (Array.isArray(base) || Array.isArray(override)) return override;

  const result = { ...(base as Record<string, unknown>) };
  for (const [key, val] of Object.entries(override as Record<string, unknown>)) {
    if (
      key in result &&
      typeof result[key] === 'object' &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      result[key] = mergeConfigs(result[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function loadConfig(configPath?: string): Config {
  const userConfigPath = join(homedir(), '.mcp-cli', 'config.json');
  const userConfig = loadConfigFile(userConfigPath);

  const projectConfigPath = resolve(process.cwd(), 'mcp.json');
  const projectConfig = loadConfigFile(projectConfigPath);

  let explicitConfig: unknown = null;
  if (configPath) {
    explicitConfig = loadConfigFile(resolve(configPath));
    if (explicitConfig === null) {
      throw new ConfigError(`Config file not found: ${configPath}`);
    }
  }

  let merged = mergeConfigs(userConfig, projectConfig);
  if (explicitConfig) {
    merged = mergeConfigs(merged, explicitConfig);
  }

  if (merged === null) {
    merged = {};
  }

  const interpolated = interpolateObject(merged);

  const result = ConfigSchema.safeParse(interpolated);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigError(`Invalid config:\n${issues}`);
  }

  logger.debug(`Config loaded: ${Object.keys(result.data.servers).length} servers`);
  return result.data;
}
