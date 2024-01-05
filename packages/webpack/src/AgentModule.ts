// import { SourceFile } from "ts-morph";
// import { Module } from "webpack";
// import { parse } from "./manifest";
// import ServiceAgentPlugin from "./ServiceAgentPlugin";

// const DEFAULT_AGENT = require.resolve("@entangled/fetch");
// const RawModule = require('webpack/lib/RawModule');

// class AgentModule extends RawModule {
//   watch = new Set<string>();
//   sourceFile: SourceFile;

//   constructor(
//     public parent: ServiceAgentPlugin,
//     public name: string,
//     request: string,
//     file: string){

//     super("", request, `Entangled adapter for ${request}`);

//     this.sourceFile =
//       parent.tsProject.addSourceFileAtPath(file);

//     parent.tsProject.resolveSourceFileDependencies();
//     parent.modules.add(this);

//     Object.defineProperty(this, "sourceStr", {
//       get: () => this.generate()
//     })
//   }

//   generate(){
//     const {
//       agent = DEFAULT_AGENT,
//       endpoint,
//       runtimeOptions
//     } = this.parent.options;

//     const output = parse(this.sourceFile, this.watch);
//     const opts: any = { endpoint, ...runtimeOptions };
//     const args: {}[] = [ output ];
          
//     if(this.name !== "default")
//       opts.namespace = this.name;

//     if(Object.values(opts).some(x => !!x))
//       args.push(opts);

//     const printArguments = JSON.stringify(args).slice(1, -1);
//     const code = `module.exports = require("${agent}").default(${printArguments})`;
//   }

// }

// export default AgentModule;