import path from "path";
import { Compiler, SingleEntryPlugin } from "webpack";
import VirtualModulesPlugin from "webpack-virtual-modules";
import ExternalNodeModulesPlugin from "./ExternalModules";

const JsonpTemplatePlugin = require('webpack/lib/web/JsonpTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');

const DEFAULT_RUNTIME = "@entangled/express";

interface MicroserviceOptions {
  namespace?: string;
  runtime?: string;
}

const EXISTS_FOR = new Set<Compiler>();

export default class MicroservicePlugin {
  constructor(
    public options: MicroserviceOptions
  ){}

  apply(compiler: Compiler){
    const NAME = this.constructor.name;
    const { namespace } = this.options;
    
    compiler.hooks.make.tap(NAME, (compilation) => {
      EXISTS_FOR.has(compiler);

      const filename = namespace ? `${namespace}.service.js` : "service.js";
      const { path } = compiler.options.output;

      const child =
        compilation.createChildCompiler(NAME, { filename, path }, []);

      EXISTS_FOR.add(compiler);

      this.applyEntryPoint(child);
      new NodeTargetPlugin().apply(child);
      new JsonpTemplatePlugin().apply(compiler);

      if(true)
        new ExternalNodeModulesPlugin(deps => {}).apply(child);

      compilation.hooks.additionalAssets.tapAsync(NAME, onDone => {
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

  applyEntryPoint(compiler: Compiler){
    const {
      runtime = DEFAULT_RUNTIME
    } = this.options;

    const virtual = new VirtualModulesPlugin();
    const entry = path.resolve(compiler.context, "./microservice.js");
    const content = `require("${runtime}").default({ })`;

    virtual.apply(compiler);
    virtual.writeModule(entry, content);

    new SingleEntryPlugin(compiler.context, entry).apply(compiler);
  }
}