#!/usr/bin/env bun
/**
 * Context optimization entry point.
 * Called by Claude Code hooks to intercept Read tool calls and provide
 * AST skeleton caching for token reduction on re-reads.
 *
 * Usage (from hooks):
 *   bun dist/context.js --pre    # PreToolUse Read handler
 *   bun dist/context.js --post   # PostToolUse Read handler
 *   bun dist/context.js --compact # PostCompact handler
 *   bun dist/context.js stats    # Print stats
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import {
  openDb,
  getSkeleton,
  upsertSkeleton,
  hasSessionRead,
  recordSessionRead,
  incrementStats,
  pruneOldSessions,
} from "./context/cache.js";
import { hashFile, estimateTokens, isSupportedExtension, isFileEligible } from "./context/session.js";
import { extractSkeleton, languageForExtension } from "./context/skeleton.js";
import { benchmark, formatBenchmark } from "./context/benchmark.js";
import { printStats } from "./context/stats.js";

interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    offset?: number;
    limit?: number;
  };
  session_id?: string;
}

interface PreHookResponse {
  updatedInput?: {
    file_path: string;
    limit?: number;
    offset?: number;
  };
  additionalContext?: string;
}

function findProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    try {
      const entries = new Set(readdirSync(dir));
      if (entries.has(".vibecop.yml") || entries.has(".git")) return dir;
    } catch {}
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────

function handlePre(input: HookInput): void {
  const filePath = input.tool_input?.file_path;
  if (!filePath) {
    console.log("{}");
    return;
  }

  // Skip non-supported file types
  if (!isSupportedExtension(filePath)) {
    console.log("{}");
    return;
  }

  // Skip partial reads (offset/limit already specified by user/agent)
  if (input.tool_input.offset !== undefined && input.tool_input.offset > 0) {
    console.log("{}");
    return;
  }

  const sessionId = input.session_id;
  if (!sessionId) {
    console.log("{}");
    return;
  }

  const projectRoot = findProjectRoot();

  try {
    const db = openDb(projectRoot);
    try {
      const resolvedPath = resolve(filePath);
      const currentHash = hashFile(resolvedPath);
      if (!currentHash) {
        console.log("{}");
        return;
      }

      const previousRead = hasSessionRead(db, sessionId, resolvedPath);

      if (!previousRead) {
        // First read — check if we have a cached skeleton to inject as context
        const cached = getSkeleton(db, resolvedPath, currentHash);
        if (cached) {
          const response: PreHookResponse = {
            additionalContext: `[vibecop] File structure:\n${cached.skeleton}`,
          };
          console.log(JSON.stringify(response));
        } else {
          console.log("{}");
        }
        return;
      }

      // Re-read — check if file has changed
      if (previousRead.hash === currentHash) {
        // Unchanged: smart-limit to 30 lines + inject skeleton
        const cached = getSkeleton(db, resolvedPath, currentHash);
        const response: PreHookResponse = {
          updatedInput: {
            file_path: filePath,
            limit: 30,
          },
        };
        if (cached) {
          response.additionalContext =
            `[vibecop] File unchanged since last read. Structure:\n${cached.skeleton}`;
          // Tokens saved = full file - (30 lines + skeleton)
          // 30 lines ≈ 30 * 17 chars ≈ 510 chars ≈ 128 tokens
          const limitedTokens = 128 + cached.skeletonTokens;
          const saved = Math.max(0, cached.fullTokens - limitedTokens);
          incrementStats(db, sessionId, { cacheHits: 1, tokensSaved: saved });
        } else {
          incrementStats(db, sessionId, { cacheHits: 1 });
        }
        console.log(JSON.stringify(response));
      } else {
        // Changed: allow full read, note the change
        const response: PreHookResponse = {
          additionalContext: "[vibecop] File has changed since last read.",
        };
        console.log(JSON.stringify(response));
      }
    } finally {
      db.close();
    }
  } catch {
    // Never block the agent
    console.log("{}");
  }
}

function handlePost(input: HookInput): void {
  const filePath = input.tool_input?.file_path;
  if (!filePath) return;
  if (!isSupportedExtension(filePath)) return;

  const sessionId = input.session_id;
  if (!sessionId) return;

  const projectRoot = findProjectRoot();

  try {
    const db = openDb(projectRoot);
    try {
      const resolvedPath = resolve(filePath);

      if (!isFileEligible(resolvedPath)) return;

      const currentHash = hashFile(resolvedPath);
      if (!currentHash) return;

      // Record that this file was read in this session
      recordSessionRead(db, sessionId, resolvedPath, currentHash);
      incrementStats(db, sessionId, { totalReads: 1 });

      // Extract and cache skeleton if not already cached with this hash
      const existing = getSkeleton(db, resolvedPath, currentHash);
      if (!existing) {
        const ext = extname(resolvedPath);
        const lang = languageForExtension(ext);
        if (!lang) return;

        const source = readFileSync(resolvedPath, "utf-8");
        const skeleton = extractSkeleton(source, lang);
        if (skeleton) {
          const fullTokens = estimateTokens(source);
          const skeletonTokens = estimateTokens(skeleton);
          upsertSkeleton(db, resolvedPath, currentHash, skeleton, lang, fullTokens, skeletonTokens);
        }
      }
    } finally {
      db.close();
    }
  } catch {
    // Silent failure — never affect the agent
  }
}

function handleCompact(input: HookInput): void {
  const sessionId = input.session_id;
  if (!sessionId) return;

  const projectRoot = findProjectRoot();

  try {
    const db = openDb(projectRoot);
    try {
      // On compaction, prune old sessions
      pruneOldSessions(db, 7);
    } finally {
      db.close();
    }
  } catch {
    // Silent
  }
}

function handleStats(sessionId?: string): void {
  const projectRoot = findProjectRoot();
  try {
    const db = openDb(projectRoot);
    try {
      printStats(db, sessionId);
    } finally {
      db.close();
    }
  } catch (err) {
    console.error(`Failed to read stats: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (command === "stats") {
  handleStats(args[1]);
} else if (command === "benchmark") {
  console.log(formatBenchmark(benchmark(findProjectRoot())));
} else if (command === "--pre" || command === "--post" || command === "--compact") {
  try {
    const stdin = readFileSync("/dev/stdin", "utf-8");
    const input = JSON.parse(stdin) as HookInput;

    switch (command) {
      case "--pre":
        handlePre(input);
        break;
      case "--post":
        handlePost(input);
        break;
      case "--compact":
        handleCompact(input);
        break;
    }
  } catch {
    // Never block the agent — output passthrough on any error
    if (command === "--pre") console.log("{}");
  }
} else {
  console.error("Usage: vibecop context [--pre|--post|--compact|stats]");
  process.exit(1);
}
