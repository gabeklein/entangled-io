import { createServer } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { resolve } from 'path'

const ENTRY = '\0virtual:entry';
const transport = resolve(__dirname, "index.ts");

async function createVirtualRunner(contextDir: string) {
  const trueEntry = resolve(contextDir, 'hello.ts')
  const ENTRY_MODULE = `
    import { serve } from '${transport}';
    import * as MODULE_EXPORTS from '${trueEntry}';
  
    serve(MODULE_EXPORTS);
  `

  const server = await createServer({
    root: contextDir,
    plugins: [{
      name: 'virtual-entry',
      load(id) {
        return id === ENTRY ? ENTRY_MODULE : null
      }
    }],
    server: {
      hmr: true
    }
  })

  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server)

  installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source),
  })

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
  })

  return async function start(entry: string){
    try {
      await runner.executeId(entry)
    } catch (error) {
      console.error('Error executing virtual entry:', error)
      throw error
    }

    return () => server.close()
  }
}

async function main() {
  // const args = process.argv.slice(2);
  const start = await createVirtualRunner(__dirname)
  const stop = await start(ENTRY)

  // Set up cleanup on process exit
  process.on('SIGINT', async () => {
    console.log('\nClosing server...')
    await stop()
    process.exit()
  })
}

main().catch(console.error)