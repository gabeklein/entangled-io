import path from 'path';
import { Project, SourceFile, ts } from 'ts-morph';
import { Compiler, SingleEntryPlugin } from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
const JsonpTemplatePlugin = require('webpack/lib/web/JsonpTemplatePlugin');

import { createManifest } from './manifest';

interface ReplacedModule {
  name: string;
  watchFiles: Set<string>;
  sourceFile: SourceFile;
  location: string;
  filename: string;
}

interface RequestInfo {
  requiredBy: string;
  rawRequest: string;
  resolvedRequest: string;
  type: string;
}

interface MicroserviceOptions {
  endpoint?: string;
  consumer?: string;
}

interface Options {
  test?: RegExp;
  options?: (request: RequestInfo) => MicroserviceOptions;
  endpoint?: string;
  consumer?: string;
  provider?: string;
}

/**
 * Default service-agent comes included with this plugin.
 * We get webpack to include it by resolving from here.
 * This way, it doesn't need to be a peer-dependency.
 */
const DEFAULT_AGENT = require.resolve("@entangled/fetch");

class ApiReplacementPlugin {
  /** Use name of class to register hooks. */
  name = this.constructor.name;

  /** Simple cache of requires tagged for replacement. */
  replacedModules = new Map<string, ReplacedModule>();

  /** Separate plugin will manage imaginary files for bundle. */
  virtualPlugin = new VirtualModulesPlugin();

  childCompiler!: Compiler;

  agent = DEFAULT_AGENT;

  tsProject: Project;

  constructor(public options: Options = {}){
    const tsConfigFilePath =
      ts.findConfigFile(process.cwd(), ts.sys.fileExists);

    this.tsProject = new Project({
      tsConfigFilePath,
      skipAddingFilesFromTsConfig: true
    });
  }

  apply(compiler: Compiler) {
    this.virtualPlugin.apply(compiler);
    this.applyAfterResolve(compiler);
    this.applyAfterCompile(compiler);
    this.applyWatchRun(compiler);
    this.applyChildCompiler(compiler);
  }

  loadRemoteModule(name: string, namespace?: string){
    const tsc = this.tsProject;
    const sourceFile = tsc.addSourceFileAtPath(name);

    tsc.resolveSourceFileDependencies();

    const location = path.dirname(name);
    const filename = path.join(location, `${namespace}.proxy.js`);

    const mod: ReplacedModule = {
      name,
      location,
      sourceFile,
      watchFiles: new Set(),
      filename
    };

    this.replacedModules.set(name, mod);
    this.writeReplacement(mod);

    return filename;
  }

  applyChildCompiler(compiler: Compiler){
    compiler.hooks.make.tap(this, (compilation) => {
      if(this.childCompiler)
        return;

      const options = {
        filename: "foobar.js",
        path: path.resolve(process.cwd(), "public")
      };

      const child = this.childCompiler =
        compilation.createChildCompiler(this.name, options, []);

      child.context = compiler.context;
      child.inputFileSystem = compiler.inputFileSystem;
      child.outputFileSystem = compiler.outputFileSystem;

      const fileContent = `console.log("doo z thing!!!")`;
      const base64 = Buffer.from(fileContent).toString('base64');
      const entry = `data:text/javascript;base64,${base64}`;

      new SingleEntryPlugin(compiler.context, entry).apply(child);
      new JsonpTemplatePlugin().apply(compiler);

      compilation.hooks.additionalAssets.tapAsync(this, onDone => {
        child.hooks.make.tap(this, (childCompilation) => {
            childCompilation.hooks.afterHash.tap(this, () => {
              childCompilation.hash = compilation.hash;
              childCompilation.fullHash = compilation.fullHash;
            });
          },
        );

        child.runAsChild((err, entries, childCompilation) => {
          if (err || !childCompilation)
            return onDone(err);

          if (childCompilation.errors.length > 0)
            return onDone(childCompilation.errors[0]);

          compilation.hooks.afterOptimizeAssets.tap(this, () => {
            compilation.assets = Object.assign(
              childCompilation.assets,
              compilation.assets,
            );

            compilation.namedChunkGroups = Object.assign(
              childCompilation.namedChunkGroups,
              compilation.namedChunkGroups,
            );

            // const childChunkFileMap = childCompilation.chunks.reduce(
            //   (chunkMap, chunk) => {
            //     chunkMap[chunk.name] = chunk.files;
            //     return chunkMap;
            //   },
            //   {},
            // );

            // compilation.chunks.forEach(chunk => {
            //   const childChunkFiles = childChunkFileMap[chunk.name];

            //   if (childChunkFiles) {
            //     chunk.files.push(
            //       ...childChunkFiles.filter(v => !chunk.files.includes(v)),
            //     );
            //   }
            // });
          });

          onDone();
        });
      });
    })
  }

  /**
   * As we resolve modules, if we run into one marked for 
   * override, we generate the replacement proxy implementation. 
   */
  applyAfterResolve(compiler: Compiler){
    compiler.hooks.normalModuleFactory.tap(this, (compilation) => {
      compilation.hooks.afterResolve.tap(this, (result) => {
        const { test } = this.options;
        const resolved = result.createData as any;
        const resource = resolved.resource;

        const info = this.replacedModules.get(resource);

        if(info){
          resolved.resource = resolved.userRequest = info.filename;
          return;
        }

        if(typeof test == "function"){
          // const info: RequestInfo = {
          //   requiredBy: result.contextInfo.issuer,
          //   rawRequest: result.request,
          //   resolvedRequest: resolved.resource,
          //   type: resolved.type
          // }
        }

        else if(test instanceof RegExp){
          const match = test.exec(resource);

          if(!match)
            return;

          if(!/\.tsx?$/.test(resource)){
            const relative = path.relative(process.cwd(), resource);
            throw new Error(`Tried to import ${relative} (as external) but is not typescript!`)
          }

          const namespace = match[1] || path.basename(resource.replace(/\.\w+$/, ""));
          const proxyModule = this.loadRemoteModule(resource, namespace);

          resolved.resource = resolved.userRequest = proxyModule;
        }
      })
    });
  }

  /**
   * After first compilation, we need to watch our server's source files.
   * During development, backend code might be linked;
   * we should refresh where API might change with new server logic.
   */
  applyAfterCompile(compiler: Compiler){
    compiler.hooks.afterCompile.tap(this, (compilation) => {
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
    compiler.hooks.watchRun.tap(this, (compilation) => {
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
  
  writeReplacement(mod: ReplacedModule){
    const output = createManifest(mod.sourceFile, mod.watchFiles);
    let endpoint = "http://localhost:8080";

    const data = JSON.stringify(output);

    if(/^[/A-Z]+$/.test(endpoint))
      endpoint = `process.env.${endpoint}`;

    const content =
      `module.exports = require("${this.agent}")(${data}, "${endpoint}")`;

    this.virtualPlugin.writeModule(mod.filename, content);
  }
}

module.exports = ApiReplacementPlugin;