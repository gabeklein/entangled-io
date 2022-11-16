import { LoaderContext } from 'webpack';

export default function hotModuleLoader(
  this: LoaderContext<any>, source: string) {
  
  // console.log('The request path: ', this.resourcePath);

  return source += `\nif(module.hot) module.hot.accept();`
}