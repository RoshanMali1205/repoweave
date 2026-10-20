'use strict';
const {fs,path,hash,safe,current,read}=require('./fs');
const YAML=require('yaml'),TOML=require('@iarna/toml');
const start='<!-- repoweave:start -->',end='<!-- repoweave:end -->';
const manifestPath='.repoweave/manifest.json';
function managed(text){const a=text?.indexOf(start)??-1,b=text?.indexOf(end)??-1;if(a<0&&b<0)return null;if(a<0||b<a||text.indexOf(start,a+start.length)>=0||text.indexOf(end,b+end.length)>=0)throw Error('Malformed or duplicate RepoWeave block');return text.slice(a,b+end.length)+'\n';}
function allowed(p){return p.startsWith('.repoweave/')||/^\.github\/(agents|skills|instructions|prompts|hooks)\//.test(p)||p==='.github/copilot-instructions.md'||/^\.claude\/(agents|skills|rules)\//.test(p)||p==='.claude/settings.json'||/^\.codex\/agents\//.test(p)||/^\.agents\/skills\//.test(p)||['AGENTS.md','CLAUDE.md'].includes(p);}
function snapshot(kind,text){if(text==null)return null;if(kind==='block'){try{const block=managed(text);if(block)return block;}catch{return text;}}return text;}
function decide(entry,choice){
 if(!entry||(entry.status!=='conflict'&&entry.status!=='kept'))throw Error('That file is not waiting for a choice.');
 if(choice==='keep'){if(entry.before==null)throw Error('Nothing on disk to keep for '+entry.path);entry.status='kept';entry.reason='Keeping your edit.';return entry;}
 if(choice==='take'){if(entry.kind==='hook-settings')throw Error('Existing Claude settings are not replaced. Keep your settings and merge the proposed hook by hand.');entry.status=entry.before==null?'create':'update';entry.reason='Will replace this file with the RepoWeave proposal.';return entry;}
 throw Error('Unknown conflict choice.');
}
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
  if(prev?.kept&&before!==null&&hash(snapshot(f.kind,before))===prev.hash){status='kept';reason='Keeping your edit. Choose Use proposal when you want the RepoWeave version.';}
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
function recordFor(e){
 const body=e.status==='kept'?snapshot(e.kind,e.before):e.kind==='block'?managed(e.content):e.content;
 if(body==null)throw Error('Kept file is missing: '+e.path);
 const rec={hash:hash(body),kind:e.kind,refs:e.refs||[]};if(e.status==='kept')rec.kept=true;return rec;
}
function apply(root,p){
 if(p.entries.some(e=>e.status==='conflict'))throw Error('Resolve preview conflicts before applying. No files written.');
 const validation=validateFiles(p.entries);if(!validation.ok)throw Error('Generated file validation failed: '+JSON.stringify(validation.errors));
 if(current(root,manifestPath)!==p.baseManifest)throw Error('Manifest changed since preview. Preview again.');
 // Inputs and all output snapshots are rechecked immediately before writes.
 for(const [f,h] of Object.entries(p.inputHashes)){if(hash(read(root,f,8*1024*1024))!==h)throw Error('Project changed since scan: '+f+'. Analyze again.');}
 for(const e of p.entries)if(current(root,e.path)!==e.before)throw Error('File changed since preview: '+e.path);
 const changes=p.entries.filter(e=>e.status==='create'||e.status==='update');
 const recordKept=p.entries.some(e=>e.status==='kept'&&!p.previous?.files?.[e.path]?.kept);
 if(!changes.length&&!recordKept)return {changed:0,retained:p.retained,validation,kept:p.entries.filter(e=>e.status==='kept').length};
 fs.mkdirSync(safe(root,'.repoweave'),{recursive:true});
 const lock=safe(root,'.repoweave/write.lock');let fd;
 try{fd=fs.openSync(lock,'wx');}catch{throw Error('Another write or unfinished transaction exists (.repoweave/write.lock). Run RepoWeave: Recover Interrupted Write before retrying.');}
 const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+hash(String(Math.random())).slice(0,6);const backup='.repoweave/backups/'+id;
 const done=[];let preserveLock=false;
 const manifest={version:1,profileFingerprint:p.profileFingerprint,targets:p.targets,files:{...(p.previous?.files||{})}};
 for(const e of p.entries)manifest.files[e.path]=recordFor(e);
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
  return {changed:changes.length,backup,retained:p.retained,validation,kept:p.entries.filter(e=>e.status==='kept').length};
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
function latestBackup(root){
 const dir=path.join(root,'.repoweave/backups');
 if(!fs.existsSync(dir))return null;
 const names=fs.readdirSync(dir).filter(name=>name&&!name.startsWith('.')).sort();
 return names.length?'.repoweave/backups/'+names[names.length-1]:null;
}
function inspectTransaction(root){
 let locked=false;try{locked=fs.existsSync(safe(root,'.repoweave/write.lock'));}catch{locked=false;}
 if(!locked)return {locked:false};
 const backup=latestBackup(root);let journal=null,journalError=null;
 if(backup){try{const text=current(root,backup+'/journal.json');journal=text?JSON.parse(text):null;if(journal&&typeof journal.state!=='string')throw Error('Unreadable backup journal');}catch(e){journalError=e.message;}}
 return {locked:true,backup,journal,journalError};
}
function recoverTransaction(root){
 const info=inspectTransaction(root);
 if(!info.locked)return {action:'none',message:'No unfinished write.'};
 if(info.journalError)throw Error(info.journalError);
 const state=info.journal?.state;
 if(state==='committed'||state==='rolled-back'){fs.unlinkSync(safe(root,'.repoweave/write.lock'));return {action:'cleared-lock',state,message:'Removed a leftover lock. The last write was already '+state+'.'};}
 if(state!=='prepared'||!Array.isArray(info.journal.operations))throw Error('The write lock has no usable journal. Inspect .repoweave/write.lock before removing it.');
 for(const op of info.journal.operations){if(op?.existed&&current(root,info.backup+'/'+op.path)===null)throw Error('Backup missing for '+(op.path||'unknown')+'. The lock was left in place.');}
 for(const op of [...info.journal.operations].reverse()){
  if(!op||typeof op.path!=='string'||!allowed(op.path))throw Error('Journal path is not a harness file.');
  const file=safe(root,op.path);
  if(!op.existed){if(fs.existsSync(file))fs.unlinkSync(file);}
  else {const bak=current(root,info.backup+'/'+op.path);if(bak===null)throw Error('Backup missing for '+op.path+'. The lock was left in place.');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bak);}
 }
 fs.writeFileSync(safe(root,info.backup+'/journal.json'),JSON.stringify({state:'rolled-back',reason:'Recovered an interrupted write.'},null,2));
 fs.unlinkSync(safe(root,'.repoweave/write.lock'));
 return {action:'rolled-back',files:info.journal.operations.length,message:'Restored files from the interrupted write and removed the lock.'};
}
const pruneRoots=['.github/agents','.github/skills','.github/instructions','.github/prompts','.github/hooks','.claude/agents','.claude/skills','.claude/rules','.codex/agents','.agents/skills','.repoweave/prompts','.repoweave/rules','.repoweave/scripts'];
function pruneEmpty(root,file){
 let dir=path.posix.dirname(file);
 while(dir&&dir!=='.'&&pruneRoots.some(prefix=>dir===prefix||dir.startsWith(prefix+'/'))){
  const abs=safe(root,dir);if(!fs.existsSync(abs)||fs.readdirSync(abs).length)break;fs.rmdirSync(abs);dir=path.posix.dirname(dir);
 }
}
function removeHarness(root){
 const m=installed(root);if(!m)return {removed:[],kept:[],message:'No installed harness.'};
 const info=inspectTransaction(root);
 if(info.locked&&info.journal?.state==='prepared')throw Error('An interrupted write is still locked. Recover it before removing the harness.');
 const removed=[],kept=[];
 for(const [p,e] of Object.entries(m.files)){
  if(p===manifestPath)continue;
  if(!allowed(p))throw Error('Manifest path not allowed');
  const text=current(root,p);
  if(text===null){removed.push(p);continue;}
  if(e.kind==='block'){
   let block;try{block=managed(text);}catch{kept.push({path:p,reason:'Managed block is malformed. Left the file in place.'});continue;}
   if(!block){kept.push({path:p,reason:'No RepoWeave block was found. Left the file in place.'});continue;}
   const next=text.replace(block.trimEnd(),'').replace(/^\n+/,'').replace(/\n{3,}/g,'\n\n').trim();
   if(!next)fs.unlinkSync(safe(root,p));else fs.writeFileSync(safe(root,p),next.endsWith('\n')?next:next+'\n');
   removed.push(p);pruneEmpty(root,p);continue;
  }
  if(e.kept||hash(text)!==e.hash){kept.push({path:p,reason:e.kept?'Kept because you chose to keep your edit.':'Content differs from the generated file. Left it in place.'});continue;}
  fs.unlinkSync(safe(root,p));removed.push(p);pruneEmpty(root,p);
 }
 const manifestFile=safe(root,manifestPath);if(fs.existsSync(manifestFile))fs.unlinkSync(manifestFile);removed.push(manifestPath);
 if(info.locked&&info.journal?.state!=='prepared'){try{fs.unlinkSync(safe(root,'.repoweave/write.lock'));}catch{}}
 return {removed,kept,message:'Removed '+removed.length+' harness files.'+(kept.length?' Left '+kept.length+' edited files in place.':'')};
}
module.exports={plan,apply,validateInstalled,validateFiles,managed,allowed,decide,inspectTransaction,recoverTransaction,removeHarness};
