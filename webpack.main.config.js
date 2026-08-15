const path = require('node:path');
const rules = require('./webpack.rules');

// #12: production packages ship without source maps; development keeps them.
// electron-forge's webpack plugin invokes this config as a function with
// argv.mode = 'production' | 'development'.
module.exports = (_env, argv) => ({
  entry: './src/main.ts',
  target: 'electron-main',
  module: { rules },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      'better-sqlite3$': require.resolve('better-sqlite3/win32-x64')
    }
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, '.webpack/main')
  },
  devtool: argv?.mode === 'production' ? false : 'source-map'
});
