const path = require('path');
const webpack = require('webpack');
const config = require('flarum-webpack-config')();

config.resolve = config.resolve || {};
config.resolve.modules = [path.resolve(__dirname, 'node_modules'), 'node_modules'];

config.plugins.push(
  new webpack.optimize.LimitChunkCountPlugin({
    maxChunks: 1,
  })
);

module.exports = config;
