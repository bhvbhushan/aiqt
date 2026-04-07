import type { SgNode } from "@ast-grep/napi";
import type { Lang } from "./types.js";

export interface ImportInfo {
  node: SgNode;
  /** The module/package being imported (e.g., "react", "os.path") */
  source: string;
  /** Full import statement text */
  text: string;
}

export interface FunctionInfo {
  node: SgNode;
  /** Function name, or "<anonymous>" for unnamed arrow functions */
  name: string;
  /** Number of parameters (excludes self/cls for Python) */
  params: number;
  /** The function body AST node */
  body: SgNode | null;
  /** AST node kind (e.g., "function_declaration", "arrow_function") */
  kind: string;
}

export interface ClassInfo {
  node: SgNode;
  name: string;
  methods: string[];
}

export interface ExportInfo {
  node: SgNode;
  name: string;
  kind: "function" | "class" | "variable" | "type" | "default";
}

/**
 * Extract the npm package name from an import specifier.
 * `lodash/merge` → `lodash`, `@scope/pkg/sub` → `@scope/pkg`
 */
export function extractJsPackageName(specifier: string): string | null {
  if (!specifier) return null;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  const slashIdx = specifier.indexOf("/");
  return slashIdx === -1 ? specifier : specifier.slice(0, slashIdx);
}

/** Find all import declarations in a file. */
export function findImports(root: SgNode, language: Lang): ImportInfo[] {
  if (language === "python") return findPythonImports(root);
  return findJsImports(root);
}

function findJsImports(root: SgNode): ImportInfo[] {
  const results: ImportInfo[] = [];
  const nodes = root.findAll({ rule: { kind: "import_statement" } });
  for (const node of nodes) {
    const sourceNode = node.children().find((ch) => ch.kind() === "string");
    if (!sourceNode) continue;
    const source = sourceNode.text().slice(1, -1);
    results.push({ node, source, text: node.text() });
  }
  return results;
}

function findPythonImports(root: SgNode): ImportInfo[] {
  const results: ImportInfo[] = [];

  // `import X` or `import X.Y`
  for (const node of root.findAll({ rule: { kind: "import_statement" } })) {
    const nameNode = node.children().find(
      (ch) => ch.kind() === "dotted_name" || ch.kind() === "aliased_import",
    );
    if (!nameNode) continue;
    let source: string;
    if (nameNode.kind() === "aliased_import") {
      const dotted = nameNode.children().find((ch) => ch.kind() === "dotted_name");
      source = dotted ? dotted.text() : nameNode.text();
    } else {
      source = nameNode.text();
    }
    results.push({ node, source, text: node.text() });
  }

  // `from X import Y`
  for (const node of root.findAll({ rule: { kind: "import_from_statement" } })) {
    const nameNode = node.children().find((ch) => ch.kind() === "dotted_name");
    if (!nameNode) continue;
    results.push({ node, source: nameNode.text(), text: node.text() });
  }

  return results;
}

/** Find all function/method declarations in a file. */
export function findFunctions(root: SgNode, language: Lang): FunctionInfo[] {
  if (language === "python") return findPythonFunctions(root);
  return findJsFunctions(root);
}

function findJsFunctions(root: SgNode): FunctionInfo[] {
  const results: FunctionInfo[] = [];

  for (const kind of ["function_declaration", "method_definition", "arrow_function"] as const) {
    for (const node of root.findAll({ rule: { kind } })) {
      const name = getJsFunctionName(node);
      const params = countJsParams(node);
      const body = node.children().find((c) => c.kind() === "statement_block") ?? null;
      results.push({ node, name, params, body, kind });
    }
  }

  return results;
}

function getJsFunctionName(node: SgNode): string {
  const kind = node.kind();

  if (kind === "function_declaration") {
    return node.children().find((ch) => ch.kind() === "identifier")?.text() ?? "<anonymous>";
  }

  if (kind === "method_definition") {
    const nameNode = node.children().find(
      (ch) => ch.kind() === "property_identifier" || ch.kind() === "identifier",
    );
    return nameNode?.text() ?? "<anonymous>";
  }

  if (kind === "arrow_function") {
    const parent = node.parent();
    if (parent?.kind() === "variable_declarator") {
      return parent.children().find((ch) => ch.kind() === "identifier")?.text() ?? "<anonymous>";
    }
    if (parent?.kind() === "pair") {
      const nameNode = parent.children().find(
        (ch) => ch.kind() === "property_identifier" || ch.kind() === "string",
      );
      return nameNode?.text() ?? "<anonymous>";
    }
    return "<anonymous>";
  }

  return "<anonymous>";
}

function countJsParams(node: SgNode): number {
  const params = node.children().find((ch) => ch.kind() === "formal_parameters");
  if (!params) return 0;
  return params.children().filter((ch) => {
    const k = ch.kind();
    return k !== "(" && k !== ")" && k !== ",";
  }).length;
}

function findPythonFunctions(root: SgNode): FunctionInfo[] {
  const results: FunctionInfo[] = [];

  for (const node of root.findAll({ rule: { kind: "function_definition" } })) {
    const nameNode = node.children().find((ch) => ch.kind() === "identifier");
    const name = nameNode?.text() ?? "<anonymous>";
    const body = node.children().find((ch) => ch.kind() === "block") ?? null;
    const params = countPyParams(node);
    results.push({ node, name, params, body, kind: "function_definition" });
  }

  return results;
}

function countPyParams(node: SgNode): number {
  const params = node.children().find((ch) => ch.kind() === "parameters");
  if (!params) return 0;
  return params.children().filter((ch) => {
    const k = ch.kind();
    if (k === "(" || k === ")" || k === ",") return false;
    const text = ch.text().split(":")[0].split("=")[0].trim();
    return text !== "self" && text !== "cls";
  }).length;
}

/** Find all class declarations in a file. */
export function findClasses(root: SgNode, language: Lang): ClassInfo[] {
  if (language === "python") return findPythonClasses(root);
  return findJsClasses(root);
}

function findJsClasses(root: SgNode): ClassInfo[] {
  const results: ClassInfo[] = [];

  for (const node of root.findAll({ rule: { kind: "class_declaration" } })) {
    const nameNode = node.children().find(
      (ch) => ch.kind() === "type_identifier" || ch.kind() === "identifier",
    );
    const name = nameNode?.text() ?? "<anonymous>";
    const methods: string[] = [];
    const classBody = node.children().find((ch) => ch.kind() === "class_body");
    if (classBody) {
      for (const member of classBody.findAll({ rule: { kind: "method_definition" } })) {
        const methodName = member.children().find(
          (ch) => ch.kind() === "property_identifier" || ch.kind() === "identifier",
        );
        if (methodName) methods.push(methodName.text());
      }
    }
    results.push({ node, name, methods });
  }

  return results;
}

function findPythonClasses(root: SgNode): ClassInfo[] {
  const results: ClassInfo[] = [];

  for (const node of root.findAll({ rule: { kind: "class_definition" } })) {
    const nameNode = node.children().find((ch) => ch.kind() === "identifier");
    const name = nameNode?.text() ?? "<anonymous>";
    const methods: string[] = [];
    for (const method of node.findAll({ rule: { kind: "function_definition" } })) {
      const methodName = method.children().find((ch) => ch.kind() === "identifier");
      if (methodName) methods.push(methodName.text());
    }
    results.push({ node, name, methods });
  }

  return results;
}

/** Find all export declarations (JS/TS only). */
export function findExports(root: SgNode, language: Lang): ExportInfo[] {
  if (language === "python") return [];

  const results: ExportInfo[] = [];

  for (const node of root.findAll({ rule: { kind: "export_statement" } })) {
    const children = node.children();
    const hasDefault = children.some((ch) => ch.kind() === "default");

    if (hasDefault) {
      results.push({ node, name: "default", kind: "default" });
      continue;
    }

    const funcDecl = children.find((ch) => ch.kind() === "function_declaration");
    if (funcDecl) {
      const name = funcDecl.children().find((ch) => ch.kind() === "identifier")?.text() ?? "<unknown>";
      results.push({ node, name, kind: "function" });
      continue;
    }

    const classDecl = children.find((ch) => ch.kind() === "class_declaration");
    if (classDecl) {
      const nameNode = classDecl.children().find(
        (ch) => ch.kind() === "type_identifier" || ch.kind() === "identifier",
      );
      results.push({ node, name: nameNode?.text() ?? "<unknown>", kind: "class" });
      continue;
    }

    const typeDecl = children.find((ch) =>
      ch.kind() === "type_alias_declaration" || ch.kind() === "interface_declaration",
    );
    if (typeDecl) {
      const name = typeDecl.children().find((ch) => ch.kind() === "type_identifier")?.text() ?? "<unknown>";
      results.push({ node, name, kind: "type" });
      continue;
    }

    const lexDecl = children.find((ch) => ch.kind() === "lexical_declaration");
    if (lexDecl) {
      const declarator = lexDecl.children().find((ch) => ch.kind() === "variable_declarator");
      const name = declarator?.children().find((ch) => ch.kind() === "identifier")?.text() ?? "<unknown>";
      results.push({ node, name, kind: "variable" });
      continue;
    }

    results.push({ node, name: "<unknown>", kind: "variable" });
  }

  return results;
}
