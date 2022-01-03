import path from 'path';
import { Project, ts } from 'ts-morph';
import { Compiler } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { getSchemaFromSource } from './scanner2';
import { Options, ReplacedModule } from './types';

/**
 * Default service-agent comes included with this plugin.
 * We get webpack to include it by resolving from here.
 * This way, it doesn't need to be a peer-dependency.
 */
const DEFAULT_AGENT = require.resolve("@entangled/fetch");

class ApiReplacementPlugin {
  /** Use name of class to register hooks. */
  name = this.constructor.name;

  /** Name of module client will use to consume service. */
  agent: string;

  /** List of modules this plugin should replace with SA. */
  replaceModules: string[];

  /** Simple cache of requires tagged for replacement. */
  replacedModules = new Map<string, ReplacedModule>();

  /** Separate plugin will manage imaginary files for bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  tsProject: Project;

  /**
   * @param modules - List of modules we want to "polyfill" on the client.
   * @param opts
   */
  constructor(modules: string[], opts: Options = {}){
    this.agent = opts.agent || DEFAULT_AGENT;
    this.replaceModules = modules;

    const tsConfigFilePath =
      ts.findConfigFile(process.cwd(), ts.sys.fileExists);

    this.tsProject = new Project({
      tsConfigFilePath,
      skipAddingFilesFromTsConfig: true
    });
  }

  apply(compiler: Compiler) {
    this.loadRemoteModules();

    this.virtualPlugin.apply(compiler);
    this.applyPriorResolve(compiler);
    this.applyPostCompile(compiler);
    this.applyWatchRun(compiler);
  }

  loadRemoteModules(){
    const modules = this.replaceModules;
    const mods = this.replacedModules;

    modules.forEach((name) => {
      const info = this.loadRemoteModule(name, mods.size);

      mods.set(name, info as ReplacedModule);
    })
  }

  loadRemoteModule(name: string, filename: string | number){
    const tsc = this.tsProject;
    const contents = `import * from "${name}"`;
    const file = tsc.createSourceFile(`./${filename}.ts`, contents);

    tsc.resolveSourceFileDependencies();

    const target = file.getImportDeclarationOrThrow(() => true);
    const sourceFile = target.getModuleSpecifierSourceFileOrThrow();
    
    const filePath = sourceFile.getFilePath();
    const location = path.dirname(filePath);

    return {
      name,
      location,
      sourceFile,
      watchFiles: new Set()
    }
  }

  /**
   * As we resolve modules, if we run into one marked for 
   * override, we generate the replacement proxy implementation. 
   */
  applyPriorResolve(compiler: Compiler){
    compiler.hooks.normalModuleFactory.tap(this.name, (compilation) => {
      compilation.hooks.beforeResolve.tap(this.name, (result) => {
        const { request } = result;

        const target = this.replacedModules.get(request);

        if(!target)
          return;

        if(!target.filename)
          this.writeReplacement(target);

        result.request = target.filename!;
      })
    });
  }

  /**
   * After first compilation, we need to watch our server's source files.
   * During development, backend code might be linked;
   * we should refresh where API might change with new server logic.
   */
  applyPostCompile(compiler: Compiler){
    compiler.hooks.afterCompile.tap(this.name, (compilation) => {
      // This may also be called by html-webpack-plugin but we'll want to skip that.
      // If `compilation.name` was defined by that plugin, we can bailout.
      if((compilation as any).name)
        return;

      this.replacedModules.forEach(mod => {
        mod.watchFiles.forEach(file => {
          compilation.fileDependencies.add(file)
        })
      })
    })
  }

  /**
   * Where files server have updated, regenerate API polyfill for compilation.
   */
  applyWatchRun(compiler: Compiler){
    compiler.hooks.watchRun.tap(this.name, (compilation) => {
      const { watchFileSystem } = compilation as any;
      const watcher = watchFileSystem.watcher || watchFileSystem.wfs.watcher;
      const filesUpdated = Object.keys(watcher.mtimes || {});

      this.replacedModules.forEach(mod => {
        let updates = 0;

        for(const name of filesUpdated)
          if(mod.watchFiles.has(name))
            updates++;

        if(updates)
          this.writeReplacement(mod);
      })
    })
  }
  
  writeReplacement(target: ReplacedModule){
    const { sourceFile, location, name } = target;
    let { output, endpoint } = getSchemaFromSource(sourceFile!, name);

    const filename = path.join(location!, "service_agent.js");
    const data = JSON.stringify(output);

    if(/^[/A-Z]+$/.test(endpoint))
      endpoint = `process.env.${endpoint}`;

    const content =
      `module.exports = require("${this.agent}")(${data}, "${endpoint}")`;

    this.virtualPlugin.writeModule(filename, content);
    target.filename = filename;
  }
}

module.exports = ApiReplacementPlugin;