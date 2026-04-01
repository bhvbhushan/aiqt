import type { Detector, DetectionContext, Finding } from "../types.js";

/**
 * Detects imports that aren't declared in the project's manifest files.
 *
 * JS/TS: Checks import declarations and require() calls against package.json deps.
 * Python: Checks import/from-import statements against requirements.txt / pyproject.toml deps.
 *
 * Skips:
 * - Relative imports (./foo, ../bar)
 * - Node builtins (fs, path, etc.) and node: protocol
 * - TypeScript path aliases (@/, ~/)
 * - Already-declared packages in dependencies/devDependencies
 * - Files when no manifest is found (can't know what's declared)
 */

const NODE_BUILTINS = new Set([
  "fs", "path", "crypto", "http", "https", "os", "util", "url",
  "stream", "events", "child_process", "buffer", "assert",
  "querystring", "zlib", "net", "tls", "dns", "cluster",
  "readline", "vm", "worker_threads", "perf_hooks", "async_hooks",
  "fs/promises", "stream/promises", "timers/promises",
  "module", "console", "process", "v8", "inspector",
  "diagnostics_channel", "trace_events", "string_decoder",
  "domain", "punycode", "constants", "sys", "tty", "dgram",
  "wasi",
]);

const PYTHON_BUILTINS = new Set([
  "os", "sys", "json", "re", "math", "datetime", "collections",
  "itertools", "functools", "pathlib", "typing", "abc", "io",
  "copy", "enum", "dataclasses", "logging", "unittest", "argparse",
  "subprocess", "shutil", "glob", "tempfile", "hashlib", "base64",
  "struct", "socket", "http", "urllib", "email", "html", "xml",
  "csv", "sqlite3", "threading", "multiprocessing", "asyncio",
  "contextlib", "traceback", "warnings", "importlib", "inspect",
  "pdb", "string", "textwrap", "unicodedata", "codecs", "pprint",
  "numbers", "decimal", "fractions", "random", "statistics", "time",
  "calendar", "operator", "pickle", "shelve", "marshal", "dbm",
  "gzip", "bz2", "lzma", "zipfile", "tarfile", "configparser",
  "secrets", "hmac", "ssl", "signal", "select", "selectors",
  "ctypes", "platform", "sysconfig", "site", "builtins", "_thread",
  "__future__", "types", "weakref", "array", "queue", "heapq",
  "bisect", "graphlib", "plistlib", "pty", "fcntl", "termios",
  "mmap", "resource", "grp", "pwd", "crypt", "tty",
]);

/**
 * Extract the package name from a JS/TS import specifier.
 * - `lodash` -> `lodash`
 * - `lodash/merge` -> `lodash`
 * - `@scope/pkg` -> `@scope/pkg`
 * - `@scope/pkg/sub` -> `@scope/pkg`
 */
function extractJsPackageName(specifier: string): string | null {
  if (!specifier) return null;

  // Scoped package
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return null;
  }

  // Unscoped: take first segment
  const slashIdx = specifier.indexOf("/");
  return slashIdx === -1 ? specifier : specifier.slice(0, slashIdx);
}

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../") || specifier === "." || specifier === "..";
}

function isNodeBuiltin(specifier: string): boolean {
  if (specifier.startsWith("node:")) return true;
  return NODE_BUILTINS.has(specifier);
}

function isPathAlias(specifier: string): boolean {
  return specifier.startsWith("@/") || specifier.startsWith("~/");
}

function isDeclaredJs(packageName: string, ctx: DetectionContext): boolean {
  return ctx.project.dependencies.has(packageName) || ctx.project.devDependencies.has(packageName);
}

function detectJavaScriptUndeclaredImports(ctx: DetectionContext): Finding[] {
  const findings: Finding[] = [];
  const root = ctx.root.root();

  // 1. Find import declarations: import x from 'pkg'
  const importDecls = root.findAll({ rule: { kind: "import_statement" } });
  for (const importNode of importDecls) {
    const sourceNode = importNode.children().find((ch) => ch.kind() === "string");
    if (!sourceNode) continue;

    const specifier = sourceNode.text().slice(1, -1); // Remove quotes
    if (!specifier) continue;
    if (isRelativeImport(specifier)) continue;
    if (isNodeBuiltin(specifier)) continue;
    if (isPathAlias(specifier)) continue;

    const packageName = extractJsPackageName(specifier);
    if (!packageName) continue;
    if (isDeclaredJs(packageName, ctx)) continue;

    const range = importNode.range();
    findings.push({
      detectorId: "undeclared-import",
      message: `Import '${packageName}' is not declared in project dependencies`,
      severity: "error",
      file: ctx.file.path,
      line: range.start.line + 1,
      column: range.start.column + 1,
      endLine: range.end.line + 1,
      endColumn: range.end.column + 1,
      suggestion: `Add '${packageName}' to your package.json dependencies`,
    });
  }

  // 2. Find require() calls: const x = require('pkg')
  const callExprs = root.findAll({ rule: { kind: "call_expression" } });
  for (const call of callExprs) {
    const children = call.children();
    const fn = children[0];
    if (!fn || fn.kind() !== "identifier" || fn.text() !== "require") continue;

    const args = children.find((ch) => ch.kind() === "arguments");
    if (!args) continue;

    const argNodes = args.children().filter(
      (ch) => ch.kind() !== "(" && ch.kind() !== ")" && ch.kind() !== ",",
    );
    if (argNodes.length !== 1) continue;

    const arg = argNodes[0];
    if (arg.kind() !== "string") continue;

    const specifier = arg.text().slice(1, -1);
    if (!specifier) continue;
    if (isRelativeImport(specifier)) continue;
    if (isNodeBuiltin(specifier)) continue;
    if (isPathAlias(specifier)) continue;

    const packageName = extractJsPackageName(specifier);
    if (!packageName) continue;
    if (isDeclaredJs(packageName, ctx)) continue;

    const range = call.range();
    findings.push({
      detectorId: "undeclared-import",
      message: `Import '${packageName}' is not declared in project dependencies`,
      severity: "error",
      file: ctx.file.path,
      line: range.start.line + 1,
      column: range.start.column + 1,
      endLine: range.end.line + 1,
      endColumn: range.end.column + 1,
      suggestion: `Add '${packageName}' to your package.json dependencies`,
    });
  }

  return findings;
}

function detectPythonUndeclaredImports(ctx: DetectionContext): Finding[] {
  const findings: Finding[] = [];
  const root = ctx.root.root();

  // Find import_statement: `import X` or `import X.Y`
  const importStmts = root.findAll({ rule: { kind: "import_statement" } });
  for (const importNode of importStmts) {
    const children = importNode.children();
    // children: "import", dotted_name | aliased_import
    const nameNode = children.find(
      (ch) => ch.kind() === "dotted_name" || ch.kind() === "aliased_import",
    );
    if (!nameNode) continue;

    let fullName: string;
    if (nameNode.kind() === "aliased_import") {
      const dottedName = nameNode.children().find((ch) => ch.kind() === "dotted_name");
      fullName = dottedName ? dottedName.text() : nameNode.text();
    } else {
      fullName = nameNode.text();
    }

    const topLevel = fullName.split(".")[0];
    if (PYTHON_BUILTINS.has(topLevel)) continue;
    if (ctx.project.dependencies.has(topLevel)) continue;

    const range = importNode.range();
    findings.push({
      detectorId: "undeclared-import",
      message: `Import '${topLevel}' is not declared in project dependencies`,
      severity: "error",
      file: ctx.file.path,
      line: range.start.line + 1,
      column: range.start.column + 1,
      endLine: range.end.line + 1,
      endColumn: range.end.column + 1,
      suggestion: `Add '${topLevel}' to your requirements.txt or pyproject.toml`,
    });
  }

  // Find import_from_statement: `from X import Y` or `from X.Y import Z`
  const fromImports = root.findAll({ rule: { kind: "import_from_statement" } });
  for (const importNode of fromImports) {
    const text = importNode.text();
    // Skip relative imports: from . import X, from .. import X, from .module import X
    if (/^from\s+\./.test(text)) continue;

    const children = importNode.children();
    // children: "from", dotted_name, "import", ...
    const nameNode = children.find((ch) => ch.kind() === "dotted_name");
    if (!nameNode) continue;

    const fullName = nameNode.text();
    const topLevel = fullName.split(".")[0];
    if (PYTHON_BUILTINS.has(topLevel)) continue;
    if (ctx.project.dependencies.has(topLevel)) continue;

    const range = importNode.range();
    findings.push({
      detectorId: "undeclared-import",
      message: `Import '${topLevel}' is not declared in project dependencies`,
      severity: "error",
      file: ctx.file.path,
      line: range.start.line + 1,
      column: range.start.column + 1,
      endLine: range.end.line + 1,
      endColumn: range.end.column + 1,
      suggestion: `Add '${topLevel}' to your requirements.txt or pyproject.toml`,
    });
  }

  return findings;
}

export const undeclaredImport: Detector = {
  id: "undeclared-import",
  meta: {
    name: "Undeclared Import",
    description:
      "Detects imports of packages not declared in project manifest files (package.json, requirements.txt, etc.)",
    severity: "error",
    category: "correctness",
    languages: ["javascript", "typescript", "tsx", "python"],
  },
  detect(ctx: DetectionContext): Finding[] {
    // If no manifests found, skip entirely — we can't know what's declared
    if (ctx.project.manifests.length === 0) {
      return [];
    }

    if (ctx.file.language === "python") {
      return detectPythonUndeclaredImports(ctx);
    }
    return detectJavaScriptUndeclaredImports(ctx);
  },
};
