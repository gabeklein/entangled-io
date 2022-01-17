import path from "path";
import { Compilation, Compiler, EntryPlugin } from "webpack";
import VirtualModulesPlugin from "webpack-virtual-modules";
import ExternalNodeModulesPlugin from "./ExternalModules";

const AssignLibraryPlugin = require('webpack/lib/library/AssignLibraryPlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');

interface MicroserviceOptions {
  output?: string;
  adapter: string;
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
    const { adapter } = this.options;

    const lines = this.stuff
      .map(([name, request]) => {
        return `"${name}": require("${request}")`;
      })
      .join(",\n");
    
    return `module.exports = require("${adapter}").default({\n${lines}\n})`;
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

      const settings = {
        filename: path.basename(output),
        path: path.dirname(output),
        library: {
          type: 'commonjs2',
        },
      }

      const child = compilation.createChildCompiler(NAME, settings, []);
      const entry = path.resolve(child.context, "./.service/index.js");
      const modulePlugin = new VirtualModulesPlugin();

      modulePlugin.apply(child);
      new EntryPlugin(child.context, entry).apply(child);
      new NodeTargetPlugin().apply(child);
      new AssignLibraryPlugin({
        type: "commonjs2",
        prefix: ["module", "exports"],
        declare: false,
        unnamed: "assign"
      }).apply(child);

      if(true)
        new ExternalNodeModulesPlugin(deps => {}).apply(child);

      compilation.hooks.processAssets.tapAsync({
        name: NAME,
        stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      }, (_assets, onDone) => {
        modulePlugin.writeModule(entry, this.generate());

        child.hooks.make.tap(NAME, (childCompilation) => {
            childCompilation.hooks.afterHash.tap(NAME, () => {
              childCompilation.hash = compilation.hash;
              childCompilation.fullHash = compilation.fullHash;
            });
          },
        );

        child.runAsChild((err, entries, childCompilation) => {
          if(!childCompilation)
            throw new Error("runAsChild did not yield a compilation");

          const errors = childCompilation.getErrors();

          if (err || !childCompilation)
            return onDone(err);

          if (errors.length > 0)
            return onDone(errors[0]);

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