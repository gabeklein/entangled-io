import path from "path";
import { Compiler, EntryPlugin } from "webpack";
import VirtualModulesPlugin from "webpack-virtual-modules";
import ExternalNodeModulesPlugin from "./ExternalModules";

const JsonpTemplatePlugin = require('webpack/lib/web/JsonpTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');

const DEFAULT_RUNTIME = "@entangled/express";

interface MicroserviceOptions {
  output?: string;
  namespace?: string;
  runtime?: string;
}

const EXISTS_FOR = new Set<Compiler>();

export default class MicroservicePlugin {
  constructor(
    public options: MicroserviceOptions
  ){}

  stuff = [] as [string, string][];

  /** Add client request to microservice for provisioning. */
  include(request: string, namespace: string){
    this.stuff.push([namespace, request]);
  }

  generate(){
    const {
      runtime = DEFAULT_RUNTIME
    } = this.options;

    const lines = this.stuff
      .map(([name, request]) => {
        return `"${name}": require("${request}")`;
      })
      .join(",\n");
    
    return `require("${runtime}").default({\n${lines}\n})`;
  }

  apply(compiler: Compiler){
    const NAME = this.constructor.name;
    
    compiler.hooks.make.tap(NAME, (compilation) => {
      if(EXISTS_FOR.has(compiler))
        return;

      EXISTS_FOR.add(compiler);

      const output = path.resolve(
        compiler.options.output.path || ".",
        this.options.output || "service.js",  
      );

      const filename = path.basename(output);
      const pathname = path.dirname(output);
      const settings = {
        filename,
        path: pathname
      }

      const child =
        compilation.createChildCompiler(NAME, settings, []);

      const entry = path.resolve(child.context, "./.service/index.js");

      const modulePlugin = new VirtualModulesPlugin();
      const entryPlugin = new EntryPlugin(child.context, entry);

      modulePlugin.apply(child);
      entryPlugin.apply(child);

      new NodeTargetPlugin().apply(child);
      new JsonpTemplatePlugin().apply(compiler);

      if(true)
        new ExternalNodeModulesPlugin(deps => {}).apply(child);

      compilation.hooks.processAssets.tapAsync(NAME, (_assets, onDone) => {
        modulePlugin.writeModule(entry, this.generate());

        child.hooks.make.tap(NAME, (childCompilation) => {
            childCompilation.hooks.afterHash.tap(NAME, () => {
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

          compilation.hooks.afterOptimizeAssets.tap(NAME, () => {
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
}