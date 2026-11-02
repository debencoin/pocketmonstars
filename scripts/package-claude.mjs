// Packaging entrypoint delegates to Python's standard-library ZIP implementation.
import {spawnSync} from 'node:child_process';
const out=process.argv[2];if(!out)throw Error('Provide an absolute output ZIP path');
const code=`from pathlib import Path
import zipfile,hashlib,json,sys
root=Path.cwd(); target=Path(sys.argv[1]); files=[]
for name in ['README.md','START_HERE_CLAUDE.md','ARTWORK.md','SOLANA_DESIGN.md','package.json','package-lock.json','.gitignore']:
 files.append(root/name)
for folder in ['dist','src','protocol','scripts','tests']:
 files.extend(p for p in (root/folder).rglob('*') if p.is_file() and p.name!='protocol-source.zip' and p.suffix!='.zip')
manifest={}; target.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(files):
  rel=p.relative_to(root).as_posix(); data=p.read_bytes()
  if rel=='dist/index.html': data=data.replace(b'protocol-source.zip',b'CLAUDE_HANDOFF.md').replace(b'Download protocol and devnet source',b'Read the Claude handoff guide')
  z.writestr('PocketMonstars-MVP/'+rel,data);manifest[rel]=hashlib.sha256(data).hexdigest()
 handoff=(root/'START_HERE_CLAUDE.md').read_bytes();z.writestr('PocketMonstars-MVP/dist/CLAUDE_HANDOFF.md',handoff);manifest['dist/CLAUDE_HANDOFF.md']=hashlib.sha256(handoff).hexdigest()
 z.writestr('PocketMonstars-MVP/FILE_MANIFEST.json',json.dumps(manifest,indent=2))
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 for name,sha in manifest.items():assert hashlib.sha256(z.read('PocketMonstars-MVP/'+name)).hexdigest()==sha
 assert len([n for n in manifest if n.startswith('dist/art/') and n.endswith('.png')])==9
 assert not any('/node_modules/' in n or '/.git/' in n or '/.env' in n or '/.openai/' in n for n in z.namelist())
print(json.dumps({'file':str(target),'size_bytes':target.stat().st_size,'verified_files':len(manifest),'creature_artwork':9}))`;
const r=spawnSync('python3',['-c',code,out],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
