import { z } from 'zod';

export const StdioServerSchema = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

export const HttpServerSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export const ServerConfigSchema = z.discriminatedUnion('type', [
  StdioServerSchema,
  HttpServerSchema,
]);

export const DefaultsSchema = z.object({
  model: z.string().default('gpt-4.1'),
  toolApproval: z.enum(['prompt', 'auto', 'allowlist']).default('prompt'),
  timeout: z.number().default(30000),
  allowlist: z.array(z.string()).optional(),
});

export const ConfigSchema = z.object({
  servers: z.record(z.string(), ServerConfigSchema).default({}),
  defaults: DefaultsSchema.default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type StdioServerConfig = z.infer<typeof StdioServerSchema>;
export type HttpServerConfig = z.infer<typeof HttpServerSchema>;
export type DefaultsConfig = z.infer<typeof DefaultsSchema>;
export type Config = z.infer<typeof ConfigSchema>;
