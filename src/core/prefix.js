'use strict';
const MAX=40;
const SAFE=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RESERVED=/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;
function slugify(raw){
 if(raw==null)return '';
 let s=String(raw).trim().replace(/^@[^/\s]+[/\\]/,'');
 s=s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 if(s.length>MAX)s=s.slice(0,MAX).replace(/-+$/g,'');
 return s;
}
function isSafePrefix(s){return typeof s==='string'&&s.length>0&&s.length<=MAX&&SAFE.test(s)&&!RESERVED.test(s);}
// An explicit override is rejected when it contains a path metacharacter or does not slug to a single safe segment. Empty means derive.
function agentPrefix(override,packageName,folderName){
 if(override!=null&&String(override).trim()!==''){
  const raw=String(override).trim();
  if(/[\\/\0:]|\.\./.test(raw))throw Error('Unsafe agent prefix');
  const s=slugify(raw);
  if(!isSafePrefix(s))throw Error('Unsafe agent prefix');
  return s;
 }
 return [packageName,folderName].map(slugify).find(isSafePrefix)||'project';
}
function derivePrefix(packageName,folderName){return agentPrefix('',packageName,folderName);}
module.exports={slugify,isSafePrefix,agentPrefix,derivePrefix,MAX};
