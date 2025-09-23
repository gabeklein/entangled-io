import { Interface } from '@entangled/interface';

export class FetchInterface extends Interface {
  gc = new FinalizationRegistry((id: string) => this.release(id));
}

export const i = new FetchInterface();