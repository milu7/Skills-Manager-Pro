const rules = require('./webpack.renderer.rules');

// #12: production packages ship without source maps; development keeps them.
// electron-forge's webpack plugin invokes this config as a function with
// argv.mode = 'production' | 'development'.
module.exports = (_env, argv) => ({
  target: 'web',
  module: { rules },
  resolve: { extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'] },
  devtool: argv?.mode === 'production' ? false : 'source-map'
});
