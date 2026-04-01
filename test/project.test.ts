import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadProjectInfo } from "../src/project.js";

const FIXTURES_DIR = join(import.meta.dir, "fixtures", "project");

describe("loadProjectInfo", () => {
  test("parses package.json dependencies", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    expect(info.dependencies.has("express")).toBe(true);
    expect(info.dependencies.has("lodash")).toBe(true);
    expect(info.dependencies.has("react")).toBe(true);
  });

  test("parses package.json devDependencies", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    // typescript and jest should be in devDependencies
    expect(info.devDependencies.has("typescript")).toBe(true);
    expect(info.devDependencies.has("jest")).toBe(true);
  });

  test("handles scoped packages (@scope/pkg)", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    expect(info.dependencies.has("@scope/pkg")).toBe(true);
  });

  test("skips @types/* packages", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    expect(info.dependencies.has("@types/node")).toBe(false);
    expect(info.devDependencies.has("@types/node")).toBe(false);
    expect(info.devDependencies.has("@types/express")).toBe(false);
  });

  test("parses requirements.txt", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    expect(info.dependencies.has("requests")).toBe(true);
    expect(info.dependencies.has("flask")).toBe(true);
    expect(info.dependencies.has("numpy")).toBe(true);
    expect(info.dependencies.has("pandas")).toBe(true);
    expect(info.dependencies.has("pytest")).toBe(true);
    expect(info.dependencies.has("black")).toBe(true);
    expect(info.dependencies.has("django-rest-framework")).toBe(true);
  });

  test("skips comments and blank lines in requirements.txt", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    // Comments and -e flags should not appear as dependencies
    expect(info.dependencies.has("#")).toBe(false);
    expect(info.dependencies.has("-e")).toBe(false);
  });

  test("records manifest file paths", () => {
    const info = loadProjectInfo(FIXTURES_DIR);

    expect(info.manifests.length).toBeGreaterThan(0);
    expect(info.manifests.some((m) => m.endsWith("package.json"))).toBe(true);
    expect(info.manifests.some((m) => m.endsWith("requirements.txt"))).toBe(
      true,
    );
  });

  test("returns empty ProjectInfo when no manifest found", () => {
    // Use a path that definitely has no manifests
    const info = loadProjectInfo("/tmp/aiqt-nonexistent-dir-12345");

    expect(info.dependencies.size).toBe(0);
    expect(info.devDependencies.size).toBe(0);
    expect(info.manifests.length).toBe(0);
  });
});
