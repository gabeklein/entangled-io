import { dirname } from 'path'
import { createServer, version as viteVersion } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { installSourcemapsSupport } from 'vite-node/source-map'

export async function start(file: string){
    // create vite server
  const server = await createServer({
    root: dirname(file),
    configFile: false,
    optimizeDeps: {
      // It's recommended to disable deps optimization
      disabled: true,
    }
  })
  // For old Vite, this is need to initialize the plugins.
  if (Number(viteVersion.split('.')[0]) < 6)
    await server.pluginContainer.buildStart({})

  // create vite-node server
  const node = new ViteNodeServer(server, {
    deps: {
      external: [/node_modules/],
      inline: [],
    }
  });

  // fixes stacktraces in Errors
  installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source),
  })

  // create vite-node runner
  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    // when having the server and runner in a different context,
    // you will need to handle the communication between them
    // and pass to this function
    fetchModule(id) {
      // console.log("fetchModule", id)
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      // console.log("resolveId", id, importer)
      return node.resolveId(id, importer)
    },
  })

  // execute the file
  await runner.executeFile(file)

  // close the vite server
  await server.close()
}