/* eslint-disable import/unambiguous, import/no-commonjs */
const {rollup} = require('rollup');
const babel = require('rollup-plugin-babel');
const eslint = require('rollup-plugin-eslint');
const uglify = require('rollup-plugin-uglify');

const inputOptions = {
    input: 'src/index.js',
    plugins: [
        eslint(),
        babel(),
        uglify(),
    ],
};

const build = async () => {
    const bundle = await rollup(inputOptions);

    bundle.write({format: 'cjs', file: 'dist/index.js', sourcemap: true});
    bundle.write({format: 'es', file: 'dist/index.mjs', sourcemap: true});
};

build();
