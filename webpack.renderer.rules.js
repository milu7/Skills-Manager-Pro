module.exports = [
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: { transpileOnly: true }
    }
  },
  {
    test: /\.css$/,
    use: ['style-loader', 'css-loader', 'postcss-loader']
  },
  {
    test: /\.(png|jpe?g|gif|svg|woff2?)$/i,
    type: 'asset/resource'
  }
];
