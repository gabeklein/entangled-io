export type Recursive<T = any> = {
  [key: string]: T | Recursive<T>
};