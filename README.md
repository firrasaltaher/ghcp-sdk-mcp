# mcp-cli

A TypeScript CLI tool for consuming [MCP (Model Context Protocol)](https://modelcontextprotocol.io) servers from the terminal, powered by the [GitHub Copilot SDK](https://www.npmjs.com/package/@github/copilot-sdk) for AI-orchestrated tool calling.

## Features

- **AI-powered queries** – send natural language prompts; Copilot decides which MCP tools to call
- **Direct tool calls** – call any MCP tool directly with JSON arguments
- **Interactive REPL** – persistent session with conversation history
- **Multiple transport types** – `stdio` (local processes) and `http` (remote servers)
- **Config merging** – user-global config merged with per-project `mcp.json`
- **Env var interpolation** – `${env:VAR_NAME}` syntax in config values
- **Tool approval policies** – `prompt`, `auto`, or `allowlist`
- **JSON output** – all commands support `--json` for scripting

---

## Quick Start

```bash
# Install globally (after npm pack / publish)
npm install -g mcp-cli

# Or run from source
npm install
npm run build
node dist/index.js --help
```

### 1. Run the setup wizard

```bash
mcp setup
```

This walks you through selecting popular MCP servers and writes a `mcp.json` config file in the current directory.

### 2. List servers and tools

```bash
mcp list servers        # show configured servers
mcp list tools          # list all tools from all servers
mcp list tools github   # list tools from the "github" server only
```

### 3. Ask a question

```bash
mcp ask "What are the open issues in my repo labeled 'bug'?"
```

### 4. Call a tool directly

```bash
mcp call github list_issues --args '{"owner":"my-org","repo":"my-repo","state":"open"}'
```

### 5. Start interactive REPL

```bash
mcp repl
mcp repl --model gpt-4o
```

---

## Installation

### Requirements

- Node.js 18+
- npm 9+

### From source

```bash
git clone <repo>
cd ghcp-sdk-mcp
npm install
npm run build
npm link          # makes `mcp` available globally
```

---

## Configuration

Configuration is loaded from three locations and **merged in order** (later overrides earlier):

| Priority | Location | Description |
|----------|----------|-------------|
| 1 (lowest) | `~/.mcp-cli/config.json` | User-global config |
| 2 | `./mcp.json` | Per-project config |
| 3 (highest) | `--config <path>` | Explicit path flag |

### mcp.json format

```json
{
  "servers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      }
    },
    "mslearn": {
      "type": "http",
      "url": "https://learn.microsoft.com/api/mcp"
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  },
  "defaults": {
    "model": "gpt-4.1",
    "toolApproval": "prompt",
    "timeout": 30000,
    "allowlist": ["github.list_issues", "filesystem.read_file"]
  }
}
```

### Server types

#### `stdio` – local process

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
  }
}
```

#### `http` – remote server

```json
{
  "type": "http",
  "url": "https://learn.microsoft.com/api/mcp",
  "headers": {
    "Authorization": "Bearer ${env:API_KEY}"
  }
}
```

### Defaults

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"gpt-4.1"` | AI model for `ask` / `repl` |
| `toolApproval` | `"prompt"` \| `"auto"` \| `"allowlist"` | `"prompt"` | Tool call approval policy |
| `timeout` | number (ms) | `30000` | Connection and tool call timeout |
| `allowlist` | string[] | — | Tools auto-approved when policy is `"allowlist"` |

### Environment variable interpolation

Use `${env:VAR_NAME}` anywhere in string values:

```json
{
  "env": {
    "GITHUB_TOKEN": "${env:GITHUB_TOKEN}",
    "API_KEY": "${env:SOME_SECRET}"
  }
}
```

A warning is printed if the variable is unset.

---

## Commands

### Global flags

```
-d, --debug          Enable debug logging (shows SDK internals)
    --config <path>  Use a specific config file instead of mcp.json
    --json           Output all results as JSON (for scripting)
-y, --yes            Auto-approve all tool calls
-V, --version        Show version
-h, --help           Show help
```

### `mcp setup`

Interactive wizard to configure servers.

```bash
mcp setup            # writes ./mcp.json
mcp setup --global   # writes ~/.mcp-cli/config.json
```

### `mcp list servers`

Show all configured servers (no connection required).

```bash
mcp list servers
mcp list servers --json
```

### `mcp list tools [server]`

Connect to servers and list their tools.

```bash
mcp list tools              # all servers
mcp list tools github       # one server
mcp list tools --json
```

### `mcp ask <prompt>`

Send a natural language prompt to GitHub Copilot. Copilot uses the configured MCP servers as tools.

```bash
mcp ask "Summarize open PRs in my-org/my-repo"
mcp ask "What docs exist for the Azure SDK?" --model gpt-4o
mcp ask "List all .ts files in ./src" --yes      # auto-approve tools
mcp ask "..." --json                              # machine-readable output
```

Options:
- `-m, --model <model>` – override the default model

### `mcp call <server> <tool> [args]`

Call an MCP tool directly, bypassing Copilot orchestration.

```bash
# Pass args as positional JSON string
mcp call github list_issues '{"owner":"my-org","repo":"my-repo"}'

# Or use the --args flag
mcp call github list_issues --args '{"owner":"my-org","repo":"my-repo","state":"open"}'

# JSON output
mcp call filesystem read_file --args '{"path":"./README.md"}' --json
```

### `mcp repl`

Start an interactive session.

```bash
mcp repl
mcp repl --model gpt-4o
mcp repl --yes            # auto-approve all tool calls
```

Inside the REPL:
- Type any prompt and press Enter to chat with Copilot
- Type `exit` or `quit` (or press Ctrl+C) to exit

---

## Team Onboarding Guide

### Step 1 – Clone and install

```bash
git clone <repo>
cd ghcp-sdk-mcp
npm install && npm run build
npm link
```

### Step 2 – Set required environment variables

For the GitHub server, export your token:

```bash
export GITHUB_TOKEN=ghp_...
```

For Azure:

```bash
az login
```

### Step 3 – Configure servers

Run the setup wizard or copy a team-provided `mcp.json` into your project root:

```bash
mcp setup
```

Or create `mcp.json` manually – see [Configuration](#configuration) above.

### Step 4 – Verify connectivity

```bash
mcp list servers
mcp list tools
```

### Step 5 – Try a prompt

```bash
mcp ask "What open GitHub issues need triage?"
```

### Sharing config with your team

Commit `mcp.json` to source control (**without secrets**). Use `${env:VAR_NAME}` for all tokens and credentials – each developer sets their own environment variables locally.

---

## Troubleshooting

### Enable debug logging

```bash
mcp --debug list tools
mcp --debug ask "..."
```

Debug mode logs:
- SDK initialization and session creation
- MCP server connection attempts
- Tool calls and arguments
- Session IDs

### Common errors

#### `Configuration error: Config file not found`

No `mcp.json` found. Run `mcp setup` or create one manually.

#### `Connection error for server 'X': spawn npx ENOENT`

`npx` is not available. Ensure Node.js 18+ is installed and in `PATH`.

#### `Connection error: timed out after 30000ms`

The server took too long to start. Increase `timeout` in config:

```json
{ "defaults": { "timeout": 60000 } }
```

#### Tool calls are being denied

Check `toolApproval` setting:

```json
{ "defaults": { "toolApproval": "auto" } }
```

Or pass `--yes` to auto-approve for a single command.

#### `Environment variable 'X' is not set`

Set the missing variable before running, e.g.:

```bash
export GITHUB_TOKEN=ghp_...
mcp ask "..."
```

---

## Development

```bash
npm run dev          # run with tsx (no build step)
npm run build        # compile TypeScript → dist/
npm run typecheck    # type-check without emitting
npm run lint         # ESLint
```

### Project structure

```
src/
├── index.ts                  # CLI entry point (commander setup)
├── cli/
│   └── commands/
│       ├── ask.ts            # mcp ask
│       ├── call.ts           # mcp call
│       ├── list.ts           # mcp list servers / tools
│       ├── repl.ts           # mcp repl
│       └── setup.ts          # mcp setup
├── config/
│   ├── loader.ts             # config file merging + env interpolation
│   └── schema.ts             # Zod schemas
├── copilot/
│   └── agent.ts              # CopilotAgent wrapping @github/copilot-sdk
├── mcp/
│   ├── client-manager.ts     # MCP client lifecycle + tool calls
│   └── transport.ts          # stdio / HTTP transport factories
└── utils/
    ├── errors.ts             # typed error classes + formatError
    └── logger.ts             # chalk-based logger
```
