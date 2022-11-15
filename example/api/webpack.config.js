const { ServerPlugin } = require("@entangled/webpack");

module.exports = {
  mode: 'development',
  entry: "./src/index.ts",
  devtool: "source-map",
  output: {
    path: __dirname + '/dist',
    filename: 'server.js',
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.(js|ts)x?$/,
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
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new ServerPlugin()
  ]
};