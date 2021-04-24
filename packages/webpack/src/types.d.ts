import { SourceFile } from 'ts-morph';

export interface ReplacedModule {
  name: string;
  watchFiles: Set<string>;
  sourceFile?: SourceFile;
  location?: string;
  filename?: string;
}

export interface Options {
  endpoint?: string;
  agent?: string;
}

export type Recursive<T = any> = {
  [key: string]: T | Recursive<T>
};