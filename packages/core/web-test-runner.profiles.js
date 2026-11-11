import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import { transform as esbuildTransform } from 'esbuild';
import ts from 'typescript';

// Each profile compiles the test files the way one real project setup would: an emitter, a decorator convention, and
// class-field semantics (Set, or [[Define]]). `src` is always compiled the way the published build compiles it, since a
// project consumes Impulse's `dist`, not its source, through its own emitter.

const root = path.dirname(fileURLToPath(import.meta.url));

/** The compiler options `rollup.config.js` builds `dist` with, minus the ones about writing files. */
function libraryOptions() {
  const configPath = path.join(root, 'tsconfig.build.json');
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root, undefined, configPath);
  for (const key of ['declaration', 'declarationMap', 'noEmit', 'outDir', 'rootDir', 'sourceMap']) delete options[key];
  return options;
}

function tsc(compilerOptions) {
  return async (code, fileName) => ts.transpileModule(code, {
    fileName,
    compilerOptions: { ...compilerOptions, inlineSourceMap: true, inlineSources: true },
  }).outputText;
}

function esbuild(target, compilerOptions) {
  return async (code, fileName) => {
    const result = await esbuildTransform(code, {
      loader: 'ts',
      target,
      sourcefile: fileName,
      sourcemap: 'inline',
      // The transform API reads no tsconfig from disk, so these are the only options it sees.
      tsconfigRaw: { compilerOptions },
    });
    return result.code;
  };
}

function babel(plugins) {
  return async (code, fileName) => {
    const result = await transformAsync(code, {
      filename: fileName,
      babelrc: false,
      configFile: false,
      sourceMaps: 'inline',
      plugins: ['@babel/plugin-transform-typescript', ...plugins],
    });
    return result.code;
  };
}

export const PROFILES = {
  'esbuild-legacy': esbuild('es2020', { experimentalDecorators: true, useDefineForClassFields: false }),
  // impulse_view_components
  'tsc-legacy': tsc({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    experimentalDecorators: true,
    useDefineForClassFields: false,
  }),
  // ambiki: the class-properties transform defines fields, so decorated fields are [[Define]]d too.
  'babel-legacy': babel([
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    '@babel/plugin-transform-class-properties',
  ]),
};

/**
 * A web-test-runner plugin that serves every `.ts` file as JavaScript: `src` compiled like the published build, and
 * everything else (the tests) compiled by the named profile.
 */
export function profilePlugin(name) {
  const compileTest = PROFILES[name];
  if (!compileTest) {
    throw new Error(`Unknown test profile "${name}". Expected one of: ${Object.keys(PROFILES).join(', ')}.`);
  }
  const compileLibrary = tsc(libraryOptions());

  return {
    name: `profile-${name}`,
    resolveMimeType(context) {
      if (context.path.endsWith('.ts')) return 'js';
    },
    transformCacheKey() {
      return name;
    },
    async transform(context) {
      if (!context.path.endsWith('.ts')) return;
      const fileName = path.join(root, context.path);
      const compile = context.path.startsWith('/src/') ? compileLibrary : compileTest;
      return { body: await compile(context.body, fileName) };
    },
  };
}
