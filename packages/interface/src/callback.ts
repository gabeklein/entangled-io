import { v4 } from 'uuid'

export abstract class CallableTransport {
  localCache = new Map<string, Function>();

  gc = new FinalizationRegistry((id: string) => this.release(id));

  /**
   * Calls the remote function with the given ID and arguments.
   */
  abstract call(id: string, args: any[]): Promise<any>;

  /**
   * Captures a function callable by remote and returns its ID.
   * The function will be kept alive until release is called.
   */
  register(fn: Function) {
    const id = v4();
    this.localCache.set(id, fn);
    return id;
  }

  /**
   * Received a call from remote to invoke the function with the given ID and arguments.
   */
  invoke(id: string, args: any[]) {
    const fn = this.localCache.get(id);
    if(fn) return fn(...args);
    throw new Error(`Callback '${id}' is no longer available`);
  }

  /**
   * Received a call from remote that the function with the given ID can be released.
   */
  release(id: string) {
    this.localCache.delete(id);
  }

  /**
   * Creates a proxy function that calls the remote function with the given ID.
   * The remote will be notified when the proxy is garbage collected, releasing the function.
   */
  proxy(id: string) {
    async function proxy(this: any, ...args: any[]){
      return Promise.resolve().then(() => {
        return this.invoke
      });
    }

    this.gc.register(proxy, id);
    return proxy;
  }
}