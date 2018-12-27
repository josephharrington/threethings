const webpack = require('webpack');
const path = require('path');

module.exports = {
	module: {
		rules: [
			{
                test: /\.js$/,
				include: [path.resolve(__dirname, 'src')]
			},
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
                include: [path.resolve(__dirname, 'src')]
            }
		]
	},

    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ]
    },

	// mode: 'production',
	mode: 'development',

    devtool: 'source-map',

    devServer: {
        contentBase: path.resolve(__dirname, '.'),
    }
};
