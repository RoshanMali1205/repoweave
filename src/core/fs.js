'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const ignore = require('ignore');
const run = promisify(execFile);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const slash = p => p.split(path.sep).join('/');
const denyDirs = new Set(['.git','node_modules','dist','build','coverage','.angular','.next','.turbo','.cache','vendor','repoweave-kit','.repoweave','.agent-factory','.agent-system','.harness','.nx','out-tsc','bazel-out','.sass-cache','.pnpm-store','.parcel-cache','.swc','storybook-static','.vercel','.netlify']);
// Real secret files only, matched on the final path segment; first-party code such as credentials.service.ts stays in scope.
const sensitive = p => /(^|\/)(\.env(?:\.[^/]*)?|\.envrc|\.npmrc|\.yarnrc(?:\.yml)?|\.netrc|\.git-credentials|\.pgpass|\.htpasswd|id_(?:rsa|dsa|ecdsa|ed25519)|credentials(?:\.json)?|secrets\.(?:json|ya?ml))$|\.(pem|key|crt|cer|der|p8|p12|pfx|ppk|jks|keystore|kdbx)$/i.test(p);
function safe(root, rel) {
 if(typeof rel!=='string'||!rel||rel.includes('\\')||path.posix.isAbsolute(rel)||rel.split('/').includes('..')||rel.includes('\0')) throw Error('Unsafe relative path');
 root=path.resolve(root);const target=path.resolve(root,rel),inside=path.relative(root,target);
 if(!inside||inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside)) throw Error('Path outside workspace');
 let p=target;
 while(p!==root&&p!==path.dirname(p)) { try {const s=fs.lstatSync(p);if(s.isSymbolicLink()) throw Error('Symlink path is not supported: '+rel);}catch(e){if(e.code!=='ENOENT')throw e;}p=path.dirname(p); }
 return target;
}
function read(root, rel, limit=1024*1024) {
 const p=safe(root,rel); const s=fs.statSync(p); if(!s.isFile()||s.size>limit) throw Error('File exceeds read limit: '+rel);return fs.readFileSync(p,'utf8');
}
function current(root,rel) {try{return fs.readFileSync(safe(root,rel),'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function redact(text) {
 return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[REDACTED PRIVATE KEY]')
 .split('\n').map(l=> /(?:password|passwd|secret|api[_-]?key|access[_-]?token|authorization|connectionstring)\s*[=:]/i.test(l)?'[REDACTED SENSITIVE LINE]':l.replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g,'https://[REDACTED]@')).join('\n');
}
// core.longpaths lets Git for Windows list entries beyond MAX_PATH; other platforms ignore it.
const gitLs=dir=>run('git',['-c','core.longpaths=true','-C',dir,'ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:15000}).then(r=>r.stdout.split('\0').filter(Boolean));
async function gitFiles(root,prefix='',notes,depth=0) {
 const out=[];
 for(const f of await gitLs(path.join(root,prefix))) {
  const rel=prefix+f.replace(/\/$/,''),abs=path.join(root,rel);
  if(rel.split('/').some(x=>denyDirs.has(x)))continue;
  let st;try{st=fs.lstatSync(abs);}catch{out.push(rel);continue;}
  // Nested repositories and submodules are listed as a single directory entry.
  if(st.isDirectory()){if(depth<4)try{out.push(...await gitFiles(root,rel+'/',notes,depth+1));continue;}catch{}notes.push('Nested repository not inventoried: '+rel);}
  else out.push(rel);
 }
 return out;
}
function gitReason(e){if(e.code==='ENOENT')return 'Git was not found on PATH';const m=String(e.stderr||e.message||'').trim().split(/\r?\n/).find(Boolean)||'unknown error';return /not a git repository/i.test(m)?'Not a Git repository':'git ls-files failed ('+(e.killed?'timed out':m.slice(0,200))+')';}
async function inventory(root, cancel=()=>false) {
 let list,mode='git',notes=[],reason=null;
 try { list=await gitFiles(root,'',notes);if(!list.length){reason='Git listed no files (the folder may be ignored by an enclosing repository)';throw Error(reason);} }
 catch(e) {reason=reason||gitReason(e);mode='filesystem';list=[];notes=[];
  async function visit(dir, rules=[]) {
   if(cancel())throw Error('Scan cancelled');
   const rel=slash(path.relative(root,dir));
   const ig=path.join(dir,'.gitignore');
   if(fs.existsSync(ig)&&!fs.lstatSync(ig).isSymbolicLink())rules=[...rules,{base:rel,ig:ignore().add(fs.readFileSync(ig,'utf8'))}];
   for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    if(e.isSymbolicLink())continue;
    const f=path.join(dir,e.name),r=slash(path.relative(root,f));
    if(denyDirs.has(e.name)||sensitive(r))continue;
    let ignored=false;
    for(const rule of rules) {const local=rule.base?r.slice(rule.base.length+1):r;const test=rule.ig.test(local+(e.isDirectory()?'/':''));if(test.ignored)ignored=true;if(test.unignored)ignored=false;}
    if(ignored)continue;
    if(e.isDirectory())await visit(f,rules);else if(e.isFile())list.push(r);
    if(list.length>50000)throw Error('Inventory exceeds 50,000 files. Select a narrower workspace.');
   }
  }await visit(root);notes.push(reason+'; filesystem walk used with nested .gitignore rules. Global Git excludes are unavailable.');
 }
 const valid=[];
 for(const f of [...new Set(list)].sort()) {
  if(cancel())throw Error('Scan cancelled');
  if(f.split('/').some(x=>denyDirs.has(x))||sensitive(f))continue;
  try {if(fs.statSync(safe(root,f)).isFile())valid.push(f);}catch{notes.push('Skipped unavailable or symlink path: '+f);}
 }
 if(valid.length>50000)throw Error('Inventory exceeds 50,000 files. Select a narrower workspace.');
 return {files:valid,mode,notes};
}
module.exports={fs,path,hash,slash,safe,read,current,redact,inventory,sensitive};
