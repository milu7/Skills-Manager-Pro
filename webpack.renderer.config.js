const rules = require('./webpack.renderer.rules');

module.exports = {
  target: 'web',
  module: { rules },
  resolve: { extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'] },
  devtool: 'source-map'
};
