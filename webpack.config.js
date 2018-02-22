/*
 *  This code is under MIT licence, you can find the complete file here:
 *  https://github.com/WilderBase/wilderbase_core/blob/master/LICENSE
 */

const path = require('path');
const autoprefixer = require('autoprefixer');
const webpack = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');

process.env.NODE_ENV = 'development';

module.exports = {
	cache: true,
	devtool: 'source-map',
	devServer: {
		inline: true,
		port: 80
	},
	entry: [
		path.resolve('src/index.js'),
		path.resolve('src/wb_interface.js')
	],
	output: {
		path: path.resolve('build'),
		filename: 'static/js/bundle.js',
		sourceMapFilename: 'bundle.map',
		publicPath: './'
	},
	plugins: [
		new HtmlWebpackPlugin({
			inject: true,
			template: path.resolve('src/public/index.html'),
		}),
		new webpack.HotModuleReplacementPlugin()
	],
	module: {
		loaders: [{
			exclude: [
				/\.html$/,
				/\.(js)$/,
				/\.scss$/,
				/\.css$/,
				/\.json$/,
				/\.svg$/
			],
			loader: 'url',
			query: {
				limit: 10000,
				name: 'static/media/[name].[hash:8].[ext]'
			}
		}, {
			test: /\.css$/,
			loader: 'style!css?importLoaders=1!postcss'
		},{
			test: /\.scss$/,
			loader: 'style!css?importLoaders=1&localIdentName=[local]_[hash:base64:5]!postcss!sass'
		},{
			test: /\.(js)$/,
			include: [/(src|test)/]
		}]
	}
};
