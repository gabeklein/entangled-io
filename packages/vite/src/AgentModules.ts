import { Parser } from './Parser';
import { Options } from './types';

const VIRTUAL = "\0virtual:entangle:";
const AGENT_ID = VIRTUAL.slice(0, -1);

interface AgentModule {
  id: string;
  code: string;
  watch: Set<string>;
}

interface CachedModule {
  path: string;
  id: string;
}

class AgentModules extends Parser {
  private cache = new Map<string, AgentModule>();
  private modules = new Map<string, CachedModule>();
  private cacheStrategy: Options['cacheStrategy'];

  constructor(cacheStrategy: Options['cacheStrategy'] = 'conservative') {
    super();
    this.cacheStrategy = cacheStrategy;
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
      const watch = new Set<string>([resolved]);
      const code = this.code(path, exports);

      for (const item of exports)
        if (item.type == "module")
          watch.add(item.path);

      const result: AgentModule = { code, id, watch };

      this.cache.set(id, result);
      return result;
    } catch (error) {
      return undefined;
    }
  }

  code(path: string, exports: Set<Parser.ExportItem>) {
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

export { AgentModules, AgentModule };