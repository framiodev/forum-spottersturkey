const path = require('path');
const webpack = require('webpack');
const config = require('flarum-webpack-config')();

// Modül kaynakları paketin js/ dizininin dışında (modules/<ad>/js/src) durduğu için
// Node'un yukarı doğru node_modules araması bu dizine ulaşamıyor. Çözümleme kökünü
// açıkça bildiriyoruz.
config.resolve = config.resolve || {};
config.resolve.modules = [path.resolve(__dirname, 'node_modules'), 'node_modules'];

config.plugins.push(
  new webpack.optimize.LimitChunkCountPlugin({
    maxChunks: 1,
  })
);

module.exports = config;
