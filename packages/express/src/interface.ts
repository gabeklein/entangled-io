import { v4 } from 'uuid'
import { Interface } from '@entangled/interface';

export class ExpressInterface extends Interface {
  localCache = new Map<string, Function>();

  gc = new FinalizationRegistry((id: string) => this.release(id));

  pack(data: any){
    if(typeof data == "function"){
      const id = v4();
      this.localCache.set(id, data);
      return "\0Callback::" + id;
    }

    return super.pack(data);
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
}

export const i = new ExpressInterface();