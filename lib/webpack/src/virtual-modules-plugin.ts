/**
 * Largely adapted from webpack-virtual-modules by sysgears.
 * https://github.com/sysgears/webpack-virtual-modules
 */

import path from 'path';
import { Compiler } from 'webpack';

import VirtualStats from './virtual-stats';

export default class EntangledVirtualModulePlugin {
  compiler!: Compiler & { inputFileSystem: any }
  _watcher!: any;

  apply(compiler: Compiler){
    const NAME = this.constructor.name;

    this.compiler = compiler;

    compiler.hooks.afterEnvironment.tap(NAME, () => {
      if(!("_writeVirtualFile" in compiler.inputFileSystem))
        this.patchFileSystem();
    });
    
    compiler.hooks.watchRun.tap(NAME, (watcher: any) => {
      this._watcher = watcher.compiler || watcher;
    });
  }

  writeModule(filePath: string, contents: string){
    if(!this.compiler)
      throw new Error("Compiler instance does not exist yet.");

    const length = contents ? contents.length : 0;
    const time = Date.now();
    const stats = new VirtualStats({ time, length, mode: 33188 });
    
    const modulePath = getModulePath(filePath, this.compiler);

    // When using the WatchIgnorePlugin (https://github.com/webpack/webpack/blob/52184b897f40c75560b3630e43ca642fcac7e2cf/lib/WatchIgnorePlugin.js),
    // the original watchFileSystem is stored in `wfs`. The following "unwraps" the ignoring
    // wrappers, giving us access to the "real" watchFileSystem.
    let finalWatchFileSystem = this._watcher && this._watcher.watchFileSystem;

    while(finalWatchFileSystem?.wfs)
      finalWatchFileSystem = finalWatchFileSystem.wfs;

    this.compiler.inputFileSystem._writeVirtualFile(modulePath, stats, contents);

    if(!finalWatchFileSystem?.watcher.fileWatchers.length)
      return

    for(const fileWatcher of finalWatchFileSystem.watcher.fileWatchers)
      if(fileWatcher.path === modulePath)
        fileWatcher.emit("change", time, null);
  }

  patchFileSystem(){
    const ifs = this.compiler.inputFileSystem;
    const purge_super = ifs.purge;

    const files = {} as { 
      [file: string]: { stats: VirtualStats, contents: string }
    };

    ifs.purge = function(){
      purge_super.apply(this);
      for(const file in files){
        const data = files[file];
        this._writeVirtualFile(file, data.stats, data.contents);
      }
    };

    ifs._writeVirtualFile = function(
      file: string, stats: VirtualStats, contents: string){

      files[file] = { stats, contents };

      setData(this._statStorage, file, [null, stats]);
      setData(this._readFileStorage, file, [null, contents]);

      const segments = file.split(/[\\/]/);
      const minCount = segments[0] ? 1 : 0;
      
      for(let count = segments.length - 1; count > minCount; count--){
        const dir = segments.slice(0, count).join(path.sep) || path.sep;

        try {
          ifs.readdirSync(dir);
        } 
        catch(e) {
          const dirStats = new VirtualStats({
            time: Date.now(),
            mode: 16877,
            length: stats.size
          });
          setData(this._readdirStorage, dir, [null, []]);
          setData(this._statStorage, dir, [null, dirStats]);
        }

        const dirData = getData(this._readdirStorage, dir);
        const filename = segments[count];

        if(dirData[1].includes(filename))
          break;
        else {
          const files = dirData[1].concat([filename]).sort();
          setData(this._readdirStorage, dir, [null, files]);
        }
      }
    }
  }
}

function getModulePath(filePath: string, { context }: Compiler){
  return path.isAbsolute(filePath) ? filePath : path.join(context, filePath);
}

function getData({data}: any, key: string){
  if(data instanceof Map)
    return data.get(key);
  else
    return data[key];
}

function setData({data}: any, key: string, value: any){
  if(data instanceof Map)
    data.set(key, value);
  else
    data[key] = value;
}