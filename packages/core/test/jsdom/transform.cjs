const { transformSync } = require('esbuild');

/**
 * Compiles a test file, or Chai, to CommonJS for Jest. The test files use legacy decorators, as most Jest suites that
 * test an Impulse element do.
 */
module.exports = {
  process(code, fileName) {
    const result = transformSync(code, {
      loader: fileName.endsWith('.ts') ? 'ts' : 'js',
      format: 'cjs',
      target: 'es2020',
      sourcefile: fileName,
      sourcemap: 'inline',
      tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } },
    });
    return { code: result.code };
  },
};
