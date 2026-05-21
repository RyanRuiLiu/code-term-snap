import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const extensionBuild = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info'
};

const webviewBuild = {
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  outfile: 'media/webview/main.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  logLevel: 'info'
};

async function build() {
  if (isWatch) {
    const extensionContext = await esbuild.context(extensionBuild);
    const webviewContext = await esbuild.context(webviewBuild);

    await Promise.all([extensionContext.watch(), webviewContext.watch()]);
    console.log('Watching for changes...');
    return;
  }

  await Promise.all([esbuild.build(extensionBuild), esbuild.build(webviewBuild)]);
  console.log('Build complete.');
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});