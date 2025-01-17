import { createServer } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { resolve } from 'path'
// import { transformModuleForHMR } from './transform'
import { createHmrEmitter, viteNodeHmrPlugin } from 'vite-node/hmr'
import { createHotContext, handleMessage } from 'vite-node/hmr'

const ENTRY = '\0virtual:entry'

async function createVirtualRunner(contextDir: string) {
  const ENTRY_MODULE = `
    import { hello } from "${resolve(contextDir, 'file1.ts')}"

    console.log('Hello from entry module!')
  
    setInterval(() => {
      console.log('Latest result:', hello())
    }, 2000)
  `

  const emitter = createHmrEmitter()
  const server = await createServer({
    root: contextDir,
    plugins: [
      viteNodeHmrPlugin(),
      {
        name: 'virtual-entry',
        load(id) {
          return id === ENTRY ? ENTRY_MODULE : null
        },
        // transform(code, id) {
        //   if (!id.startsWith('\0')) {
        //     const transformed = transformModuleForHMR({ moduleId: id, source: code })
        //     console.log(`Transformed module ${id} for HMR`)
        //     return transformed
        //   }
        // }
      }
    ],
    server: {
      hmr: true
    }
  })

  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server)

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
    createHotContext(runner, moduleId) {
      return createHotContext(runner, emitter, [moduleId], moduleId)
    }
  })

  server.emitter.on('message', (payload) => {
    handleMessage(runner, emitter, [], payload)
  })

  installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source),
  })

  return async function start(entry: string) {
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
  const context = resolve(__dirname, './src')
  const start = await createVirtualRunner(context)
  const stop = await start(ENTRY)

  process.on('SIGINT', async () => {
    console.log('\nClosing server...')
    await stop()
    process.exit()
  })
}

main().catch(console.error)