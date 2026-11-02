import {build} from 'esbuild';
const common={bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true,define:{'process.env.NODE_ENV':'"production"','global':'globalThis'},logLevel:'info'};
await build({...common,entryPoints:['src/nft-client.js'],outfile:'dist/chain-client.js'});
await build({...common,entryPoints:['src/stake-client.js'],outfile:'dist/stake-client.js'});
