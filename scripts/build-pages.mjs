/* Build a fully release-stamped GitHub Pages module graph.
 * Pages caches static .js/.css for several minutes. Stamp every ES module
 * import, not only the HTML entry point, to prevent mixed-version runtime.
 */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
const revision=(process.env.GITHUB_SHA||process.argv[2]||'local').slice(0,12).replace(/[^a-zA-Z0-9-]/g,'');
if(!revision)throw new Error('Missing valid release revision');
const root=new URL('../',import.meta.url);
const sourcePath=name=>new URL(name,root);
const out=new URL('../dist/',import.meta.url);
await mkdir(new URL('./src/',out),{recursive:true});
const html=(await readFile(sourcePath('index.html'),'utf8'))
 .replace(/(href=["']\.\/style\.css)(["'])/g,`$1?v=${revision}$2`)
 .replace(/(src=["']\.\/src\/app\.js)(["'])/g,`$1?v=${revision}$2`);
if(!html.includes(`app.js?v=${revision}`))throw Error('HTML module entry point was not stamped');
await writeFile(new URL('./index.html',out),html);
const app=(await readFile(sourcePath('src/app.js'),'utf8'))
 .replace(/(from\s+['"]\.\/engine\.js)(['"])/g,`$1?v=${revision}$2`)
 .replace(/(from\s+['"]\.\/scene\.js)(['"])/g,`$1?v=${revision}$2`);
if(!app.includes(`engine.js?v=${revision}`)||!app.includes(`scene.js?v=${revision}`))throw Error('ESM imports were not stamped');
await writeFile(new URL('./src/app.js',out),app);
for(const name of ['src/engine.js','src/scene.js','style.css','favicon.svg'])await copyFile(sourcePath(name),new URL(name,out));
console.log(`Cozy Bistro Pages release ${revision}: entrypoint and all ESM imports versioned`);
