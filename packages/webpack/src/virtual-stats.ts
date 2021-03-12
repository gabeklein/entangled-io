import constants from "constants"

let inode = 45000000;

interface StatOpts {
  length: number;
  mode: number;
  time: number;
  dev?: number;
}

export default class VirtualStats {
  dev = 8675309
  uid = 1000
  gid = 1000
  nlink = 0
  rdev = 0
  blksize = 4096
  ino = inode++;
  
  mode: number;
  size: number;
  blocks: number;
    
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;

  constructor(opts: StatOpts){
    const { length, mode, time } = opts;

    this.mode = mode;
    this.size = length;
    this.blocks = Math.floor(this.size / 4096);

    this.atime = 
    this.mtime = 
    this.ctime = 
    this.birthtime = 
      new Date(time);
  }

  private modeIs(property: number) {
    return ((this.mode & constants.S_IFMT) === property);
  };

  isDirectory() {
    return this.modeIs(constants.S_IFDIR);
  };

  isFile() {
    return this.modeIs(constants.S_IFREG);
  };

  isBlockDevice() {
    return this.modeIs(constants.S_IFBLK);
  };

  isCharacterDevice() {
    return this.modeIs(constants.S_IFCHR);
  };

  isSymbolicLink() {
    return this.modeIs(constants.S_IFLNK);
  };

  isFIFO() {
    return this.modeIs(constants.S_IFIFO);
  };

  isSocket() {
    return this.modeIs(constants.S_IFSOCK);
  };
}