import { Node, Project, ts } from 'ts-morph';

import { CacheStrategy } from './types';

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
  path: string;
  watch: string[];
  exports: ExportItem[];
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

    for(const [ key, [ value ] ] of exports)
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

    return manifest;
  }

  clear(): void {
    this.cache.clear();
    this.modules.clear();
  }

  validateCache(id: string): boolean {
    const cached = this.cache.get(id);

    if (this.cacheStrategy === 'disabled' || !cached)
      return false;

    if (this.cacheStrategy === 'aggressive')
      return true;

    // For conservative strategy, check if watched files still exist and are valid
    try {
      for (const file of cached.watch)
        if (!this.getSourceFile(file))
          return false;

      return true;
    } catch (error) {
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

      for (const item of exports)
        if (item.type == "module")
          watch.push(item.path);

      const result: AgentModule = { exports, path, id, watch };

      this.cache.set(id, result);
      return result;
    } catch (error) {
      return undefined;
    }
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