import { DevServerPlugin } from '@entangled/webpack';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import webpack from 'webpack';

declare namespace serve {
  interface Options {

  }
}

function serve(entry: string, opts: {}){
  const compiler = webpack({
    entry,
    mode: 'development',
    target: 'node',
    devtool: "source-map",
    output: {
      path: resolve("dist"),
      filename: 'server.js',
    },
    resolve: {
      extensions: ['.ts'],
    },
    module: {
      rules: [
        {
          test: /\.ts?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                "@babel/typescript"
              ]
            }
          }
        }
      ],
    },
    plugins: [
      new DevServerPlugin()
    ]
  });

  const callback = (
    err: Error | null | undefined,
    stats: webpack.Stats | undefined) => {

    // debugger
  }

  compiler.watch({}, callback);

  setTimeout(editFile, 1000);
}

async function editFile(){
  const helloFile = resolve("./src/hello.ts");
  let file = await readFile(helloFile, "utf-8");

  file = file.replace(/Test #(\d+)/, (_, capture) => {
    return `Test #${Number(capture) + 1}`;
  });

  await writeFile(helloFile, file);
}

export { serve }