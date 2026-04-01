import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ProjectInfo } from "./types.js";

/**
 * Load project information by parsing manifest files.
 *
 * Walks up directories from `scanRoot` to find the nearest manifest.
 * Parses package.json, lock files, requirements.txt, and pyproject.toml.
 */
export function loadProjectInfo(scanRoot: string): ProjectInfo {
  const info: ProjectInfo = {
    dependencies: new Set(),
    devDependencies: new Set(),
    manifests: [],
  };

  const root = findProjectRoot(scanRoot);
  if (!root) {
    return info;
  }

  parsePackageJson(root, info);
  parseLockFiles(root, info);
  parseRequirementsTxt(root, info);
  parsePyprojectToml(root, info);

  return info;
}

/**
 * Walk up directories from `startDir` to find the nearest directory
 * containing a manifest file (package.json, requirements.txt, or pyproject.toml).
 */
function findProjectRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  const rootDir = resolve("/");

  while (dir !== rootDir) {
    const manifests = [
      "package.json",
      "requirements.txt",
      "pyproject.toml",
    ];
    for (const m of manifests) {
      if (existsSync(join(dir, m))) {
        return dir;
      }
    }
    const parentDir = dirname(dir);
    if (parentDir === dir) break;
    dir = parentDir;
  }

  return null;
}

function parsePackageJson(root: string, info: ProjectInfo): void {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return;

  info.manifests.push(pkgPath);

  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;

    if (isRecord(pkg.dependencies)) {
      for (const name of Object.keys(pkg.dependencies)) {
        if (!name.startsWith("@types/")) {
          info.dependencies.add(name);
        }
      }
    }

    if (isRecord(pkg.devDependencies)) {
      for (const name of Object.keys(pkg.devDependencies)) {
        if (!name.startsWith("@types/")) {
          info.devDependencies.add(name);
        }
      }
    }
  } catch {
    // Malformed package.json; skip silently
  }
}

function parseLockFiles(root: string, info: ProjectInfo): void {
  // package-lock.json
  const npmLockPath = join(root, "package-lock.json");
  if (existsSync(npmLockPath)) {
    info.manifests.push(npmLockPath);
    try {
      const raw = readFileSync(npmLockPath, "utf-8");
      const lock = JSON.parse(raw) as Record<string, unknown>;

      // npm v2+ lockfile format
      if (isRecord(lock.packages)) {
        for (const key of Object.keys(lock.packages)) {
          if (key === "") continue; // root package
          const name = extractPackageName(key.replace(/^node_modules\//, ""));
          if (name && !name.startsWith("@types/")) {
            info.dependencies.add(name);
          }
        }
      }
      // npm v1 lockfile format
      else if (isRecord(lock.dependencies)) {
        for (const name of Object.keys(lock.dependencies)) {
          if (!name.startsWith("@types/")) {
            info.dependencies.add(name);
          }
        }
      }
    } catch {
      // Malformed lock file; skip
    }
  }

  // yarn.lock - extract package names from lines like "name@version:"
  const yarnLockPath = join(root, "yarn.lock");
  if (existsSync(yarnLockPath)) {
    info.manifests.push(yarnLockPath);
    try {
      const raw = readFileSync(yarnLockPath, "utf-8");
      for (const line of raw.split("\n")) {
        // Match lines like: "lodash@^4.17.21":
        // or: lodash@^4.17.21:
        const match = line.match(/^"?(@?[^@\s"]+)@/);
        if (match?.[1]) {
          const name = match[1];
          if (!name.startsWith("@types/") && !name.startsWith("#")) {
            info.dependencies.add(name);
          }
        }
      }
    } catch {
      // Malformed lock file; skip
    }
  }

  // pnpm-lock.yaml - extract package names from the packages section
  const pnpmLockPath = join(root, "pnpm-lock.yaml");
  if (existsSync(pnpmLockPath)) {
    info.manifests.push(pnpmLockPath);
    try {
      const raw = readFileSync(pnpmLockPath, "utf-8");
      // Simple extraction: lines that look like package entries
      // e.g. "/lodash@4.17.21:" or "  lodash: 4.17.21"
      for (const line of raw.split("\n")) {
        const match = line.match(/^\s+'?\/?(@?[^@\s':]+)@/);
        if (match?.[1]) {
          const name = match[1];
          if (!name.startsWith("@types/")) {
            info.dependencies.add(name);
          }
        }
      }
    } catch {
      // Malformed lock file; skip
    }
  }
}

function parseRequirementsTxt(root: string, info: ProjectInfo): void {
  const reqPath = join(root, "requirements.txt");
  if (!existsSync(reqPath)) return;

  info.manifests.push(reqPath);

  try {
    const raw = readFileSync(reqPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      // Skip empty lines, comments, and option lines
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
        continue;
      }
      // Extract package name (before any version specifier)
      const match = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[a-zA-Z0-9_,]+\])?)/);
      if (match?.[1]) {
        // Strip extras like requests[security] -> requests
        const name = match[1].replace(/\[.*\]/, "");
        info.dependencies.add(name);
      }
    }
  } catch {
    // Malformed requirements.txt; skip
  }
}

function parsePyprojectToml(root: string, info: ProjectInfo): void {
  const tomlPath = join(root, "pyproject.toml");
  if (!existsSync(tomlPath)) return;

  info.manifests.push(tomlPath);

  try {
    const raw = readFileSync(tomlPath, "utf-8");
    // Basic TOML parsing: find [project.dependencies] or dependencies under [project]
    const lines = raw.split("\n");
    let inProjectSection = false;
    let inDepsArray = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Track sections
      if (trimmed.startsWith("[")) {
        inProjectSection = trimmed === "[project]";
        inDepsArray = false;
        continue;
      }

      if (inProjectSection && trimmed.startsWith("dependencies")) {
        const match = trimmed.match(/^dependencies\s*=\s*\[/);
        if (match) {
          inDepsArray = true;
          // Handle inline array items on the same line
          const items = trimmed.match(/"([^"]+)"/g) ?? [];
          for (const item of items) {
            const name = extractPythonPackageName(item.replace(/"/g, ""));
            if (name) info.dependencies.add(name);
          }
          if (trimmed.includes("]")) {
            inDepsArray = false;
          }
          continue;
        }
      }

      if (inDepsArray) {
        if (trimmed === "]") {
          inDepsArray = false;
          continue;
        }
        const nameMatch = trimmed.match(/"([^"]+)"/);
        if (nameMatch?.[1]) {
          const name = extractPythonPackageName(nameMatch[1]);
          if (name) info.dependencies.add(name);
        }
      }
    }
  } catch {
    // Malformed pyproject.toml; skip
  }
}

/**
 * Extract the base package name from a dependency string.
 * Handles scoped packages like @scope/pkg and subpath imports like lodash/merge.
 */
function extractPackageName(raw: string): string | null {
  if (!raw) return null;

  // Scoped package: @scope/pkg or @scope/pkg/subpath
  if (raw.startsWith("@")) {
    const parts = raw.split("/");
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return null;
  }

  // Unscoped: pkg or pkg/subpath
  const parts = raw.split("/");
  return parts[0] || null;
}

/**
 * Extract Python package name from a dependency specifier.
 * e.g. "requests>=2.25.0" -> "requests"
 */
function extractPythonPackageName(spec: string): string | null {
  const match = spec.match(/^([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
