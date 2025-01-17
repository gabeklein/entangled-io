// hmr-registry.ts
type UpdateCallback = () => void
type Disposer = () => void

interface Registry {
  id: string
  updates: Set<UpdateCallback>
  dispose?: Disposer
}

const registries = new Map<string, Registry>()

// Maintains references to the latest version of each exported function
const latestImplementations = new Map<string, any>()

export function createRegistry(moduleId: string) {
  if (!registries.has(moduleId)) {
    registries.set(moduleId, {
      id: moduleId,
      updates: new Set(),
      dispose: undefined
    })
  }
  return registries.get(moduleId)!
}

export function createProxy<T extends Function>(
  moduleId: string,
  exportName: string,
  implementation: T
): T {
  // Register initial implementation
  latestImplementations.set(`${moduleId}:${exportName}`, implementation)

  // Create a proxy that always calls the latest implementation
  const proxy = new Proxy(implementation, {
    apply(_, thisArg, args) {
      const latest = latestImplementations.get(`${moduleId}:${exportName}`)
      return latest.apply(thisArg, args)
    }
  })

  return proxy
}

export function updateModule(
  moduleId: string,
  updates: Record<string, any>,
  dispose?: Disposer
) {
  const registry = registries.get(moduleId)
  if (!registry) return

  // Run dispose handlers from previous version if they exist
  registry.dispose?.()

  // Update implementations
  Object.entries(updates).forEach(([exportName, newImpl]) => {
    latestImplementations.set(`${moduleId}:${exportName}`, newImpl)
  })

  // Store new dispose handler
  registry.dispose = dispose

  // Notify listeners
  registry.updates.forEach(callback => callback())
}

export function addUpdateListener(
  moduleId: string, 
  callback: UpdateCallback
) {
  const registry = registries.get(moduleId)
  if (registry) {
    registry.updates.add(callback)
    return () => registry.updates.delete(callback)
  }
  return () => {}
}