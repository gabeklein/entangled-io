import './parse'
import { Module } from './module';

export { Entangled } from "./types";

export function collateTypes(root: string){
  return new Module(root);
}