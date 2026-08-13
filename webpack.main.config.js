const path = require('node:path');
const rules = require('./webpack.rules');

module.exports = {
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
  devtool: 'source-map'
};
