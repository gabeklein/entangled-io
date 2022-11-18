import { DevServerPlugin } from '@entangled/webpack';
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
}

export { serve }