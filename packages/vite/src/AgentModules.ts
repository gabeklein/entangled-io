import { Node, Project, ts } from 'ts-morph';

import { CacheStrategy } from './types';
import { AGENT_ID, VIRTUAL } from './ServiceAgentPlugin';

// ExportItem type moved from Parser
type ExportItem =
  | {
      name: string;
      type: "function";
      async: boolean;
    }
  | {
      name: string;
      type: "module";
      path: string;
    }
  | {
      name: string;
      type: "error";
    };

interface AgentModule {
  id: string;
  code: string;
  watch: string[];
}

interface CachedModule {
  path: string;
  id: string;
}

class AgentModules extends Project {
  private cache = new Map<string, AgentModule>();
  private modules = new Map<string, CachedModule>();
  private cacheStrategy: CacheStrategy;

  constructor(cacheStrategy: CacheStrategy = 'conservative') {
    super({
      skipAddingFilesFromTsConfig: true,
      tsConfigFilePath: ts.findConfigFile(
        process.cwd(),
        ts.sys.fileExists
      ),
    });
    this.cacheStrategy = cacheStrategy;
  }

  include(path: string, reload?: boolean){
    if(reload){
      const existingSourceFile = this.getSourceFile(path);

      if(existingSourceFile)
        this.removeSourceFile(existingSourceFile);
    }

    const sourceFile = this.addSourceFileAtPath(path);

    this.resolveSourceFileDependencies();

    const exports = sourceFile.getExportedDeclarations();
    const manifest = [] as ExportItem[];

    for(const [ key, [ value ] ] of exports){
      if(Node.isSourceFile(value))
        manifest.push({
          name: key,
          type: "module",
          path: value.getFilePath()
        });

      else if(Node.isFunctionDeclaration(value))
        manifest.push({
          name: key,
          type: "function",
          async: !!value.getAsyncKeyword()
        });

      else if(isErrorType(value))
        manifest.push({
          name: key,
          type: "error"
        });
    }

    return manifest;
  }

  clear(): void {
    this.cache.clear();
    this.modules.clear();
  }

  validateCache(id: string): boolean {
    if (this.cacheStrategy === 'disabled')
      return false;

    const cached = this.cache.get(id);

    if (!cached)
      return false;

    if (this.cacheStrategy === 'aggressive')
      return true;

    // For conservative strategy, check if watched files still exist and are valid
    try {
      for (const file of cached.watch)
        if (!this.fileExists(file))
          return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  fileExists(path: string): boolean {
    try {
      return !!this.getSourceFile(path);
    } catch {
      return false;
    }
  }

  get(id: string, reload: boolean = false): AgentModule | undefined {
    const cached = this.cache.get(id);

    if (cached && !reload && this.validateCache(id))
      return cached;

    const module = this.modules.get(id);

    if (!module)
      return;

    try {
      const { path, id: resolved } = module;
      const exports = this.include(resolved, reload);
      const watch = [resolved];
      const code = this.code(path, exports);

      for (const item of exports)
        if (item.type == "module")
          watch.push(item.path);

      const result: AgentModule = { code, id, watch };

      this.cache.set(id, result);
      return result;
    } catch (error) {
      return undefined;
    }
  }

  code(path: string, exports: ExportItem[]) {
    let handle = "";
    let code = "";

    for (const item of exports) {
      const { name } = item;

      if (item.type == "module") {
        const mod = VIRTUAL + name;

        this.modules.set(mod, {
          id: item.path,
          path: `${path}/${name}`,
        });

        code += `export * as ${name} from "${mod}";\n`;
        continue;
      }

      if (!handle) {
        handle = "rpc";
        code += `import * as agent from "${AGENT_ID}";\n`;
        code += `const ${handle} = agent.default("${path}");\n\n`;
      }

      switch (item.type) {
        case "function":
          code += item.async
            ? `export const ${name} = ${handle}("${name}");\n`
            : `export const ${name} = () => ${handle}("${name}", { async: false });\n`;
          break;

        case "error":
          code += `export const ${name} = ${handle}.error("${name}");\n`;
          break;
      }
    }

    return code;
  }

  set(key: string, info: CachedModule) {
    this.modules.set(key, info);
  }
}

function isErrorType(node: Node) {
  try {
    while (Node.isClassDeclaration(node)) {
      const exp = node.getExtendsOrThrow().getExpression();
      if (Node.isIdentifier(exp))
        node = exp.getSymbolOrThrow().getValueDeclarationOrThrow();
      else break;
    }
    if (
      Node.isVariableDeclaration(node) &&
      node.getText() == "Error:ErrorConstructor"
    )
      return true;
  } catch (err) {}
  return false;
}

export { AgentModules, AgentModule };