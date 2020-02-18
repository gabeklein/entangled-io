const { resolve } = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ApiReplacementPlugin = require("@entangled/webpack")

const currentDir = process.cwd();
const dir = path => resolve(currentDir, path);

module.exports = {
  mode: "development",
  devtool: "source-map",
  entry: "./src",
  resolve: {
    modules: [
      dir("../../node_modules")
    ],
    extensions: [".ts", ".tsx", ".js"]
  },
  output: {
    filename: "[name].js",
    publicPath: "/",
    path: dir("public")
  },
  plugins: [
    new HtmlWebpackPlugin({ title: "Teleport Test" }),
    new ApiReplacementPlugin({ modules: ["@entangled/service"] })
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true
        },
        exclude: [
          dir("node_modules"), 
          dir("../../node_modules")
        ]
      }
    ]
  },
  devServer: {
    historyApiFallback: true,
    contentBase: dir("./public"),
    host: "0.0.0.0",
    port: 3000,
    hot: true
  }
}