const { resolve } = require("path");
const { MicroservicePlugin } = require("@entangled/webpack");

module.exports = {
  mode: "development",
  entry: "./src",
  devtool: false,
  resolve: {
    extensions: [".js", ".ts"]
  },
  output: {
    filename: "[name].js",
    publicPath: "/",
    path: resolve("public")
  },
  devServer: {
    historyApiFallback: true,
    host: "0.0.0.0",
    port: 3000,
    devMiddleware: {
      writeToDisk: true
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true,
        },
        exclude: [
          /node_modules/
        ]
      }
    ]
  },
  plugins: [
    new MicroservicePlugin({
      include: /service\/\w+.ts/,
      adapter: "@entangled/express",
      agent: "@entangled/fetch"
    })
  ]
}