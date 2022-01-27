import * as Interface from '@entangled/interface';

export function pack(data: any){
  return Interface.pack(data);
}

export function unpack(body: any){
  return Interface.unpack(body);
}