import { ServerPlugin } from '@entangled/webpack';
import { resolve } from 'path';
import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
import webpack, { HotModuleReplacementPlugin } from 'webpack';

declare namespace watch {
  interface Options {

  }
}

function watch(entry: string){
  entry = resolve(entry);

  const compiler = webpack({
    entry,
    mode: 'development',
    target: 'node',
    devtool: "source-map",
    output: {
      path: __dirname + '/dist',
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
      new ServerPlugin(),
      new HotModuleReplacementPlugin(),
      new RunScriptWebpackPlugin({
        autoRestart: false
      })
    ]
  });

  const callback = (
    err: Error | null | undefined,
    stats: webpack.Stats | undefined) => {

  }

  compiler.watch({}, callback);
}

export { watch }