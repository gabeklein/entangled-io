import { createServer } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { resolve } from 'path'

const ENTRY = '\0virtual:entry'

// Server creation
async function createDevServer(contextDir: string) {
  const ENTRY_MODULE = `
    import { hello } from "${resolve(contextDir, 'file1.ts')}"
  
    setInterval(() => {
      console.log('Latest result:', hello())
    }, 1000)
  `

  const server = await createServer({
    root: contextDir,
    plugins: [{
      name: 'virtual-entry',
      load(id) {
        return id === ENTRY ? ENTRY_MODULE : null
      },
      handleHotUpdate({ file, modules }) {
        console.log(`Hot update detected for ${file}`)
        return modules
      }
    }],
    server: {
      hmr: true
    }
  })

  await server.pluginContainer.buildStart({})
  
  return {
    server,
    viteNode: new ViteNodeServer(server)
  }
}

// Runner creation
function createRunner({ root, base, viteNode }: { 
  root: string, 
  base: string, 
  viteNode: ViteNodeServer 
}) {
  // Track the latest modules
  const latestModules = new Map<string, any>()
  
  // Create module cache with closure-based proxying
  const moduleCache = new Map<string, any>()
  
  function shouldProxy(id: string) {
    return !id.includes('node_modules') && 
           !id.startsWith('\0') && 
           !id.endsWith('.json')
  }

  function createProxy(id: string, mod: any) {
    // Store the initial module
    latestModules.set(id, mod)

    // Create a proxy that always references the latest module
    return new Proxy(mod, {
      get(_, prop) {
        const currentMod = latestModules.get(id)
        if (!currentMod) return undefined

        const value = currentMod[prop]
        if (typeof value === 'function') {
          return function(...args: any[]) {
            const latestMod = latestModules.get(id)
            return latestMod[prop].apply(this, args)
          }
        }
        return value
      }
    })
  }

  // Extend Map to handle proxying
  const proxyCache = {
    get: moduleCache.get.bind(moduleCache),
    has: moduleCache.has.bind(moduleCache),
    delete: (id: string) => {
      moduleCache.delete(id)
      latestModules.delete(id)
    },
    set: (id: string, mod: any) => {
      if (!shouldProxy(id)) {
        return moduleCache.set(id, mod)
      }

      // Update latest modules
      latestModules.set(id, mod)

      // Create or reuse proxy
      if (!moduleCache.has(id)) {
        moduleCache.set(id, createProxy(id, mod))
      }

      return moduleCache.get(id)
    }
  }

  const runner = new ViteNodeRunner({
    root,
    base,
    moduleCache: proxyCache,
    fetchModule(id) {
      return viteNode.fetchModule(id)
    },
    resolveId(id, importer) {
      return viteNode.resolveId(id, importer)
    },
    createHotContext(runner: ViteNodeRunner, moduleId: string) {
      console.log('Creating hot context for:', moduleId)
      return {
        accept() {
          // No-op since proxies handle updates
          console.log('Module accepting HMR:', moduleId)
        },
        prune: () => {},
        dispose: () => {},
        decline: () => {},
        invalidate: () => {
          proxyCache.delete(moduleId)
        },
        data: {}
      }
    }
  })

  installSourcemapsSupport({
    getSourceMap: source => viteNode.getSourceMap(source),
  })

  return runner
}

// Main execution
async function main() {
  const contextDir = resolve(__dirname, './src')
  
  // Create server
  const { server, viteNode } = await createDevServer(contextDir)
  
  // Create runner
  const runner = createRunner({ 
    root: server.config.root,
    base: server.config.base,
    viteNode
  })

  // Execute entry
  try {
    await runner.executeId(ENTRY)
  } catch (error) {
    console.error('Error executing virtual entry:', error)
    throw error
  }

  // Handle cleanup
  process.on('SIGINT', async () => {
    console.log('\nClosing server...')
    await server.close()
    process.exit()
  })
}

main().catch(console.error)