import chalk from 'chalk';

export interface OutputOptions {
  json?: boolean;
  table?: boolean;
}

const COL_NAME = 16;
const COL_TYPE = 8;
const COL_STATUS = 14;
const COL_TOOLS = 6;

export function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputServers(
  servers: Array<{ name: string; type: string; status: string; detail: string; toolCount: number; error?: string }>,
  opts: OutputOptions = {}
): void {
  if (opts.json) {
    outputJSON(servers);
    return;
  }

  if (servers.length === 0) {
    console.log(chalk.yellow('No servers configured.'));
    return;
  }

  console.log(chalk.bold('\nConfigured MCP Servers:\n'));
  console.log(
    chalk.gray(
      `  ${'Name'.padEnd(COL_NAME)} ${'Type'.padEnd(COL_TYPE)} ${'Status'.padEnd(COL_STATUS)} ${'Tools'.padEnd(COL_TOOLS)} Detail`
    )
  );
  console.log(chalk.gray('  ' + '─'.repeat(70)));

  for (const s of servers) {
    const statusIcon =
      s.status === 'connected'
        ? chalk.green('● connected')
        : s.status === 'error'
          ? chalk.red('✗ error')
          : chalk.gray('○ disconnected');
    console.log(
      `  ${chalk.bold(s.name.padEnd(COL_NAME))} ${chalk.cyan(s.type.padEnd(COL_TYPE))} ${statusIcon.padEnd(COL_STATUS)} ${String(s.toolCount).padEnd(COL_TOOLS)} ${chalk.gray(s.detail)}`
    );
    if (s.error) {
      console.log(chalk.red(`    error: ${s.error}`));
    }
  }
  console.log();
}

export function outputTools(
  serverName: string,
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
  opts: OutputOptions = {}
): void {
  if (opts.json) {
    outputJSON({ server: serverName, tools });
    return;
  }

  console.log(chalk.bold(`\nTools from ${chalk.green(serverName)}:\n`));
  if (tools.length === 0) {
    console.log(chalk.gray('  (no tools available)'));
    return;
  }

  for (const tool of tools) {
    console.log(`  ${chalk.cyan(tool.name)}`);
    if (tool.description) {
      console.log(`    ${chalk.gray(tool.description)}`);
    }
    const schema = tool.inputSchema as { properties?: Record<string, unknown> } | undefined;
    if (schema?.properties) {
      const params = Object.keys(schema.properties).join(', ');
      console.log(chalk.gray(`    params: ${params}`));
    }
  }
  console.log();
}

export function outputToolResult(result: unknown, opts: OutputOptions = {}): void {
  if (opts.json) {
    outputJSON(result);
    return;
  }

  if (result === null || result === undefined) {
    console.log(chalk.gray('(no result)'));
    return;
  }

  if (typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r['content'])) {
      const text = (r['content'] as Array<{ type: string; text?: string; mimeType?: string; data?: string }>)
        .map((c) => {
          if (c.type === 'text' && c.text) return c.text;
          if (c.type === 'image') return chalk.gray(`[image: ${c.mimeType ?? 'unknown'}, base64 data omitted]`);
          if (c.type === 'resource') return chalk.gray(`[resource: ${JSON.stringify(c)}]`);
          return JSON.stringify(c, null, 2);
        })
        .join('\n');
      console.log(text);
      return;
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(String(result));
}
