'use strict';
const {fs,path,hash,safe,current,read}=require('./fs');
const YAML=require('yaml'),TOML=require('@iarna/toml');
const start='<!-- repoweave:start -->',end='<!-- repoweave:end -->';
const manifestPath='.repoweave/manifest.json';
function managed(text){const a=text?.indexOf(start)??-1,b=text?.indexOf(end)??-1;if(a<0&&b<0)return null;if(a<0||b<a||text.indexOf(start,a+start.length)>=0||text.indexOf(end,b+end.length)>=0)throw Error('Malformed or duplicate RepoWeave block');return text.slice(a,b+end.length)+'\n';}
function allowed(p){return p.startsWith('.repoweave/')||/^\.github\/(agents|skills|instructions|prompts|hooks)\//.test(p)||p==='.github/copilot-instructions.md'||/^\.claude\/(agents|skills|rules)\//.test(p)||p==='.claude/settings.json'||/^\.codex\/agents\//.test(p)||/^\.agents\/skills\//.test(p)||['AGENTS.md','CLAUDE.md'].includes(p);}
function installed(root){const v=current(root,manifestPath);if(!v)return null;const d=JSON.parse(v);if(d.version!==1||!d.files||typeof d.files!=='object')throw Error('Unsupported RepoWeave manifest; preserve it and inspect manually.');return d;}
function plan(root,generated){
 const previous=installed(root),baseManifest=current(root,manifestPath);const entries=[];
 for(const f of generated.files){
  if(!allowed(f.path))throw Error('Path is not a harness output: '+f.path);safe(root,f.path);
  const before=current(root,f.path),prev=previous?.files[f.path];let content=f.content,status=before===null?'create':'update',reason='';
  try {
   if(f.kind==='block'){
    const old=managed(before);if(old){if(!prev||hash(old)!==prev.hash){status='conflict';reason='Managed block was changed outside RepoWeave.';}content=before.replace(old.trimEnd(),f.content.trimEnd());}
    else if(before!==null)content=before+(before.endsWith('\n')?'':'\n')+'\n'+f.content;
   } else if(f.kind==='hook-settings') {
    // Never replace existing settings on first install: preserve the file and surface the exact addition for manual merge.
    if(before!==null&&(!prev||hash(before)!==prev.hash)){status='conflict';reason='Existing Claude settings need a manual merge of the proposed hook. Other settings must be preserved.';}
   } else if(before!==null&&before!==content&&(!prev||hash(before)!==prev.hash)) {status='conflict';reason='File was not created by RepoWeave or has been hand-edited.';}
  }catch(e){status='conflict';reason=e.message;}
  if(before===content&&status!=='conflict')status='unchanged';
  entries.push({...f,content,before,status,reason});
 }
 const retained=Object.keys(previous?.files||{}).filter(p=>!entries.some(e=>e.path===p));
 return {...generated,entries,baseManifest,previous,retained};
}
function validateFiles(files){
 const errors=[],paths=new Set(files.map(f=>f.path));
 for(const f of files){try{
  if(f.path.endsWith('.json'))JSON.parse(f.content);
  else if(f.path.endsWith('.toml')){const d=TOML.parse(f.content);if(!d.name||!d.description||!d.developer_instructions)throw Error('Missing agent metadata');}
  else if(f.content.startsWith('---\n')){const j=f.content.indexOf('\n---',4);if(j<0)throw Error('Frontmatter not closed');const d=YAML.parse(f.content.slice(4,j));if(!d||typeof d!=='object')throw Error('Invalid frontmatter');if(/SKILL\.md$/.test(f.path)&&(!d.name||!d.description))throw Error('Missing skill metadata');}
  for(const r of f.refs||[])if(!paths.has(r))throw Error('Unresolved reference: '+r);
 }catch(e){errors.push({path:f.path,message:e.message});}}
 return {ok:errors.length===0,files:files.length,errors};
}
function apply(root,p){
 if(p.entries.some(e=>e.status==='conflict'))throw Error('Resolve preview conflicts before applying. No files written.');
 const validation=validateFiles(p.entries);if(!validation.ok)throw Error('Generated file validation failed: '+JSON.stringify(validation.errors));
 if(current(root,manifestPath)!==p.baseManifest)throw Error('Manifest changed since preview. Preview again.');
 // Inputs and all output snapshots are rechecked immediately before writes.
 for(const [f,h] of Object.entries(p.inputHashes)){if(hash(read(root,f,8*1024*1024))!==h)throw Error('Project changed since scan: '+f+'. Analyze again.');}
 for(const e of p.entries)if(current(root,e.path)!==e.before)throw Error('File changed since preview: '+e.path);
 const changes=p.entries.filter(e=>e.status==='create'||e.status==='update');
 if(!changes.length)return {changed:0,retained:p.retained,validation};
 fs.mkdirSync(safe(root,'.repoweave'),{recursive:true});
 const lock=safe(root,'.repoweave/write.lock');let fd;
 try{fd=fs.openSync(lock,'wx');}catch{throw Error('Another write or unfinished transaction exists (.repoweave/write.lock). Inspect the journal before retrying.');}
 const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+hash(String(Math.random())).slice(0,6);const backup='.repoweave/backups/'+id;
 const done=[];let preserveLock=false;
 const manifest={version:1,profileFingerprint:p.profileFingerprint,targets:p.targets,files:{...(p.previous?.files||{})}};
 for(const e of p.entries)manifest.files[e.path]={hash:hash(e.kind==='block'?managed(e.content):e.content),kind:e.kind,refs:e.refs};
 const operations=[...changes,{path:manifestPath,content:JSON.stringify(manifest,null,2)+'\n',before:p.baseManifest}];
 try {
  fs.mkdirSync(safe(root,backup),{recursive:true});
  fs.writeFileSync(safe(root,backup+'/journal.json'),JSON.stringify({state:'prepared',operations:operations.map(e=>({path:e.path,existed:e.before!==null}))},null,2));
  for(const e of operations){
   if(e.before!==null){const b=safe(root,backup+'/'+e.path);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,e.before,{flag:'wx'});}
   const file=safe(root,e.path);fs.mkdirSync(path.dirname(file),{recursive:true});
   const tmp=file+'.repoweave-tmp-'+id;fs.writeFileSync(tmp,e.content,{flag:'wx'});try{fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}done.push(e);
  }
  fs.writeFileSync(safe(root,backup+'/journal.json'),JSON.stringify({state:'committed',paths:operations.map(e=>e.path)},null,2));
  return {changed:changes.length,backup,retained:p.retained,validation};
 }catch(error){
  const rollbackErrors=[];
  for(const e of done.reverse()){try{const file=safe(root,e.path);if(e.before===null)fs.unlinkSync(file);else fs.writeFileSync(file,e.before);}catch(e2){rollbackErrors.push(e2.message);}}
  if(rollbackErrors.length){preserveLock=true;throw Error(error.message+'; rollback incomplete: '+rollbackErrors.join('; '));}
  try{fs.writeFileSync(safe(root,backup+'/journal.json'),JSON.stringify({state:'rolled-back',reason:error.message},null,2));}catch{}
  throw error;
 }finally{fs.closeSync(fd);if(!preserveLock)fs.unlinkSync(lock);}
}
function validateInstalled(root){
 const m=installed(root);if(!m)return {ok:false,files:0,errors:[{path:manifestPath,message:'No installed harness'}]};
 const entries=[],errors=[];
 for(const [p,e] of Object.entries(m.files))try{if(!allowed(p))throw Error('Manifest path not allowed');const t=current(root,p);if(t===null)throw Error('Missing file');if(hash(e.kind==='block'?managed(t):t)!==e.hash)errors.push({path:p,message:'Content differs from generated version; review intentional edits.'});entries.push({path:p,content:t,refs:e.refs});}catch(error){errors.push({path:p,message:error.message});}
 const v=validateFiles(entries);return {...v,ok:v.ok&&!errors.length,errors:v.errors.concat(errors)};
}
module.exports={plan,apply,validateInstalled,validateFiles,managed,allowed};
