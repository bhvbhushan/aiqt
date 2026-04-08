import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Resolve the absolute path to dist/context.js from the vibecop package. */
function resolveContextScript(): string {
  // After bundling: this code runs from dist/cli.js, context.js is a sibling
  const sibling = new URL("./context.js", import.meta.url);
  if (existsSync(sibling)) return sibling.pathname;

  // Running from source (dev): dist/context.js relative to src/init.ts
  const fromSource = new URL("../dist/context.js", import.meta.url);
  if (existsSync(fromSource)) return fromSource.pathname;

  // Last resort: resolve from cwd (local dev without build)
  const { resolve } = require("node:path") as typeof import("node:path");
  return resolve("dist/context.js");
}

function contextCommands(): { pre: string; post: string; compact: string } {
  const script = resolveContextScript();
  return {
    pre: `bun ${script} --pre`,
    post: `bun ${script} --post`,
    compact: `bun ${script} --compact`,
  };
}

interface DetectedTool {
  name: string;
  detected: boolean;
  reason: string;
}

interface GeneratedFile {
  path: string;
  description: string;
}

const SCAN_CMD = "npx vibecop scan --diff HEAD --format agent";

function detectTools(cwd: string): DetectedTool[] {
  const tools: DetectedTool[] = [];

  tools.push({
    name: "Claude Code",
    detected: existsSync(join(cwd, ".claude")),
    reason: existsSync(join(cwd, ".claude"))
      ? ".claude/ directory found"
      : "not found",
  });

  tools.push({
    name: "Cursor",
    detected: existsSync(join(cwd, ".cursor")),
    reason: existsSync(join(cwd, ".cursor"))
      ? ".cursor/ directory found"
      : "not found",
  });

  tools.push({
    name: "Codex CLI",
    detected: existsSync(join(cwd, ".codex")),
    reason: existsSync(join(cwd, ".codex"))
      ? ".codex/ directory found"
      : "not found",
  });

  let aiderInstalled = false;
  try {
    execSync("which aider", { stdio: "pipe" });
    aiderInstalled = true;
  } catch {
    aiderInstalled = false;
  }
  tools.push({
    name: "Aider",
    detected: aiderInstalled,
    reason: aiderInstalled ? "aider installed" : "not found",
  });

  tools.push({
    name: "Windsurf",
    detected: existsSync(join(cwd, ".windsurf")),
    reason: existsSync(join(cwd, ".windsurf"))
      ? ".windsurf/ directory found"
      : "not found",
  });

  tools.push({
    name: "GitHub Copilot",
    detected: existsSync(join(cwd, ".github")),
    reason: existsSync(join(cwd, ".github"))
      ? ".github/ directory found"
      : "not found",
  });

  const clineDetected =
    existsSync(join(cwd, ".cline")) || existsSync(join(cwd, ".clinerules"));
  tools.push({
    name: "Cline",
    detected: clineDetected,
    reason: clineDetected
      ? existsSync(join(cwd, ".cline"))
        ? ".cline/ directory found"
        : ".clinerules found"
      : "not found",
  });

  return tools;
}

function generateConfigs(cwd: string, tools: DetectedTool[]): GeneratedFile[] {
  const generated: GeneratedFile[] = [];

  for (const tool of tools) {
    if (!tool.detected) continue;

    switch (tool.name) {
      case "Claude Code": {
        const settingsPath = join(cwd, ".claude", "settings.json");
        if (existsSync(settingsPath)) {
          generated.push({
            path: ".claude/settings.json",
            description: "already exists, skipped",
          });
        } else {
          mkdirSync(join(cwd, ".claude"), { recursive: true });
          const settings = {
            hooks: {
              PostToolUse: [
                {
                  matcher: "Edit|Write|MultiEdit",
                  hooks: [
                    {
                      type: "command",
                      command: SCAN_CMD,
                    },
                  ],
                },
              ],
            },
          };
          writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
          generated.push({
            path: ".claude/settings.json",
            description: "PostToolUse hook (blocks on findings)",
          });
        }
        break;
      }

      case "Cursor": {
        mkdirSync(join(cwd, ".cursor"), { recursive: true });
        const hooksPath = join(cwd, ".cursor", "hooks.json");
        const hooks = {
          hooks: {
            afterFileEdit: [{ command: SCAN_CMD }],
          },
        };
        writeFileSync(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
        generated.push({
          path: ".cursor/hooks.json",
          description: "afterFileEdit hook",
        });

        mkdirSync(join(cwd, ".cursor", "rules"), { recursive: true });
        const rulesPath = join(cwd, ".cursor", "rules", "vibecop.md");
        const rulesContent = `---
trigger: always_on
---

After every code edit, review vibecop findings and fix issues before proceeding.
Run: ${SCAN_CMD}
`;
        writeFileSync(rulesPath, rulesContent);
        generated.push({
          path: ".cursor/rules/vibecop.md",
          description: "always-on lint rule",
        });
        break;
      }

      case "Codex CLI": {
        mkdirSync(join(cwd, ".codex"), { recursive: true });
        const codexPath = join(cwd, ".codex", "hooks.json");
        const codexHooks = {
          hooks: {
            PostToolUse: [
              {
                matcher: "Edit|Write|MultiEdit",
                hooks: [
                  {
                    type: "command",
                    command: SCAN_CMD,
                  },
                ],
              },
            ],
          },
        };
        writeFileSync(codexPath, `${JSON.stringify(codexHooks, null, 2)}\n`);
        generated.push({
          path: ".codex/hooks.json",
          description: "PostToolUse hook (blocks on findings)",
        });
        break;
      }

      case "Aider": {
        const aiderPath = join(cwd, ".aider.conf.yml");
        const aiderContent = `lint-cmd:
  - "typescript: npx vibecop scan --format text"
  - "javascript: npx vibecop scan --format text"
  - "python: npx vibecop scan --format text"
auto-lint: true
`;
        writeFileSync(aiderPath, aiderContent);
        generated.push({
          path: ".aider.conf.yml",
          description: "lint-cmd per language",
        });
        break;
      }

      case "Windsurf": {
        mkdirSync(join(cwd, ".windsurf", "rules"), { recursive: true });
        const windsurfPath = join(cwd, ".windsurf", "rules", "vibecop.md");
        const windsurfContent = `---
trigger: always_on
---

After every code edit, review vibecop findings and fix issues before proceeding.
Run: ${SCAN_CMD}
`;
        writeFileSync(windsurfPath, windsurfContent);
        generated.push({
          path: ".windsurf/rules/vibecop.md",
          description: "always-on lint rule",
        });
        break;
      }

      case "GitHub Copilot": {
        mkdirSync(join(cwd, ".github"), { recursive: true });
        const copilotPath = join(cwd, ".github", "copilot-instructions.md");
        const vibecopSection = `
## vibecop

After every code edit, run \`${SCAN_CMD}\` and fix any findings before proceeding.
`;

        if (existsSync(copilotPath)) {
          const existing = readFileSync(copilotPath, "utf-8");
          if (existing.includes("vibecop")) {
            generated.push({
              path: ".github/copilot-instructions.md",
              description: "already contains vibecop, skipped",
            });
          } else {
            writeFileSync(copilotPath, existing + vibecopSection);
            generated.push({
              path: ".github/copilot-instructions.md",
              description: "appended vibecop instructions",
            });
          }
        } else {
          writeFileSync(copilotPath, vibecopSection);
          generated.push({
            path: ".github/copilot-instructions.md",
            description: "copilot instructions",
          });
        }
        break;
      }

      case "Cline": {
        const clinePath = join(cwd, ".clinerules");
        const clineContent = `After every code edit, run \`${SCAN_CMD}\` and fix any findings before proceeding.\n`;
        writeFileSync(clinePath, clineContent);
        generated.push({
          path: ".clinerules",
          description: "always-on lint rule",
        });
        break;
      }
    }
  }

  return generated;
}

function padEnd(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

function isBunAvailable(): boolean {
  try {
    execSync("bun --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function generateContextHooks(root: string): GeneratedFile[] {
  const generated: GeneratedFile[] = [];

  // Only Claude Code supports the hooks needed for context optimization
  if (!existsSync(join(root, ".claude"))) {
    console.log("  Context optimization requires Claude Code (.claude/ directory).");
    return generated;
  }

  const settingsPath = join(root, ".claude", "settings.json");
  let settings: Record<string, unknown> = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      console.log("  Warning: Could not parse .claude/settings.json");
      return generated;
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

  // Check for existing context hooks to avoid conflicts
  const preHooks = (hooks.PreToolUse ?? []) as Array<{ matcher?: string }>;
  const hasExistingReadHook = preHooks.some(
    (h) => h.matcher && /\bRead\b/.test(h.matcher),
  );

  if (hasExistingReadHook) {
    console.log("  Warning: Existing PreToolUse Read hook detected.");
    console.log("  Context optimization uses updatedInput which is single-consumer.");
    console.log("  Skipping to avoid conflicts. See docs/agent-integration.md.");
    generated.push({
      path: ".claude/settings.json",
      description: "context hooks skipped (existing Read hook)",
    });
    return generated;
  }

  // Resolve absolute paths to context.js
  const cmds = contextCommands();

  // Add context hooks
  hooks.PreToolUse = [
    ...(hooks.PreToolUse ?? []),
    {
      matcher: "Read",
      hooks: [{ type: "command", command: cmds.pre }],
    },
  ];

  hooks.PostToolUse = [
    ...(hooks.PostToolUse ?? []),
    {
      matcher: "Read",
      hooks: [{ type: "command", command: cmds.post }],
    },
  ];

  // PostCompact is a session-level event, no matcher
  const postCompact = (hooks.PostCompact ?? []) as unknown[];
  postCompact.push({
    hooks: [{ type: "command", command: cmds.compact }],
  });
  hooks.PostCompact = postCompact;

  settings.hooks = hooks;
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  generated.push({
    path: ".claude/settings.json",
    description: "context optimization hooks (Pre/Post Read, PostCompact)",
  });

  return generated;
}

export interface InitOptions {
  context?: boolean;
}

export async function runInit(cwd?: string, options?: InitOptions): Promise<void> {
  const root = cwd ?? process.cwd();
  const enableContext = options?.context ?? false;

  console.log("");
  console.log("  vibecop — agent integration setup");
  console.log("");

  if (enableContext) {
    // Context optimization mode
    if (!isBunAvailable()) {
      console.log("  Error: Context optimization requires the bun runtime.");
      console.log("  Install bun: https://bun.sh");
      console.log("");
      return;
    }

    console.log("  Setting up context optimization (beta)...");
    console.log("");

    const generated = generateContextHooks(root);

    if (generated.length > 0) {
      const maxPath = Math.max(...generated.map((g) => g.path.length));
      console.log("  Generated:");
      for (const file of generated) {
        console.log(
          `    ${padEnd(file.path, maxPath)}  — ${file.description}`,
        );
      }
      console.log("");
    }

    console.log("  Context optimization configured (beta).");
    console.log("  Re-run this command after upgrading vibecop or reinstalling deps.");
    console.log("  Run 'vibecop context stats' to see token savings.");
    console.log("");
    return;
  }

  // Standard init — detect tools and generate configs
  const tools = detectTools(root);
  const anyDetected = tools.some((t) => t.detected);

  if (!anyDetected) {
    console.log("  No supported AI coding tools detected.");
    console.log("  See docs/agent-integration.md for manual setup.");
    console.log("");
    return;
  }

  console.log("  Detected tools:");
  for (const tool of tools) {
    const icon = tool.detected ? "\u2713" : "\u2717";
    console.log(`    ${icon} ${tool.name} (${tool.reason})`);
  }
  console.log("");

  const generated = generateConfigs(root, tools);

  if (generated.length > 0) {
    const maxPath = Math.max(...generated.map((g) => g.path.length));
    console.log("  Generated:");
    for (const file of generated) {
      console.log(
        `    ${padEnd(file.path, maxPath)}  — ${file.description}`,
      );
    }
    console.log("");
  }

  console.log(
    "  Done! vibecop will now run automatically in your agent workflow.",
  );
  console.log("");
}
