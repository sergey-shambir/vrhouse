const path = require('path');

module.exports = {
    entry: './src/index.ts',
    mode: 'production',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader'
            }
        ]
    },
    resolve: {
        extensions: [
            ".js",
            ".ts",
            ".tsx"
        ]
    }
};
