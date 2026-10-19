'use strict';
const {hash,read}=require('./fs');
const {block}=require('./template');
const file='.repoweave/semantic.json',limit=256*1024;
// One spec drives both validation and the shipped JSON Schema (draft 2020-12 subset: type, properties, required, items, maxItems, maxLength, pattern, enum, minimum, maximum).
const text=(n=1000)=>({type:'string',maxLength:n});
const list=(items,n)=>({type:'array',items,maxItems:n});
const obj=(properties,required)=>({type:'object',additionalProperties:false,properties,...(required?{required}:{})});
const relPath={type:'string',maxLength:300,pattern:'^(?![\\\\/])(?![A-Za-z]:)(?!(?:.*/)?\\.\\.(?:/|$))[^\\\\\\u0000<>|"*?]+$'};
const slug={type:'string',maxLength:40,pattern:'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$'};
const spec=obj({
 version:{enum:[1]},
 reviewedAt:text(40),
 architecture:obj({summary:text(4000)}),
 conventions:obj({list:list(text(300),40),naming:text(500),lineLength:{type:'integer',minimum:40,maximum:400},rxjs:text(500)}),
 ui:obj({precedence:text(1000),mapping:list(obj({need:text(80),use:text(120),avoid:text(120)},['need','use']),60),sharedComponents:list(obj({name:text(120),use:text(300)},['name']),80),icons:text(500)}),
 i18n:obj({pattern:text(1000),keyNaming:text(300)}),
 services:obj({httpPattern:text(1000),coreServices:list(obj({name:text(120),responsibility:text(300)},['name']),80),errorHandling:text(500),caching:text(1000)}),
 styles:obj({breakpoints:text(1000),layoutOffsets:text(500),tokenImport:text(500)}),
 testing:obj({mockingStyle:text(1000),coverageTarget:text(100),skipPatterns:list(text(120),40)}),
 migrations:list(obj({path:relPath,plan:relPath,notes:text(1000)},['path']),20),
 docs:obj({designDocDir:relPath,syncRule:text(500)}),
 branding:obj({source:text(500),fontFamily:text(200),palette:list(obj({name:text(80),value:text(80),token:text(80),usage:text(200)},['name','value']),120),typography:list(obj({level:text(40),size:text(20),weight:text(20),lineHeight:text(20),color:text(40),usage:text(200)},['level']),30),components:list(obj({component:text(80),rule:text(500)},['component','rule']),80),rules:list(text(300),40)}),
 domains:list(obj({slug,name:text(80),triggers:list(text(80),20),overview:text(2000),sourceOfTruth:relPath,architecture:text(2000),keyFiles:list(relPath,40),acceptanceCriteria:list(text(300),60),constraints:list(text(300),40),designLink:{type:'string',maxLength:500,pattern:'^https://[^\\s<>"]+$'},translationKeys:list(text(80),200),tests:text(1000)},['slug','name','overview']),20)
},['version']);
function schema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'https://repoweave.local/semantic.schema.json',title:'RepoWeave semantic review',description:'User- and host-owned results of the semantic architecture review. RepoWeave reads this file and never writes it.',...spec};}
function check(s,v,at,errors){
 if(errors.length>=8)return;
 if(s.enum){if(!s.enum.includes(v))errors.push(at+': must be one of '+s.enum.join(', '));return;}
 if(s.type==='object'){
  if(!v||typeof v!=='object'||Array.isArray(v)){errors.push(at+': must be an object');return;}
  for(const k of Object.keys(v))if(!Object.prototype.hasOwnProperty.call(s.properties,k))errors.push(at+'.'+k+': unknown property');
  for(const k of s.required||[])if(v[k]===undefined)errors.push(at+'.'+k+': required');
  for(const [k,sub] of Object.entries(s.properties))if(v[k]!==undefined)check(sub,v[k],at+'.'+k,errors);
 } else if(s.type==='array'){
  if(!Array.isArray(v)){errors.push(at+': must be an array');return;}
  if(v.length>s.maxItems)errors.push(at+': at most '+s.maxItems+' items');
  v.slice(0,s.maxItems).forEach((x,i)=>check(s.items,x,at+'['+i+']',errors));
 } else if(s.type==='string'){
  if(typeof v!=='string'){errors.push(at+': must be a string');return;}
  if(v.length>s.maxLength)errors.push(at+': at most '+s.maxLength+' characters');
  else if(s.pattern&&!new RegExp(s.pattern,'u').test(v))errors.push(at+': invalid format');
 } else if(s.type==='integer'){
  if(!Number.isInteger(v)||v<s.minimum||v>s.maximum)errors.push(at+': must be an integer between '+s.minimum+' and '+s.maximum);
 }
}
function validate(data){
 const errors=[];check(spec,data,'$',errors);
 const slugs=(Array.isArray(data?.domains)?data.domains:[]).map(d=>d?.slug);
 const dup=slugs.find((s,i)=>s&&slugs.indexOf(s)!==i);if(dup)errors.push('$.domains: duplicate slug '+dup);
 if(errors.length)throw Error(file+' is invalid: '+errors.join('; ')+'. See .repoweave/semantic.schema.json.');
 return data;
}
function load(root){
 let t;try{t=read(root,file,limit);}catch(e){if(e.code==='ENOENT')return null;throw Error(file+': '+e.message);}
 let data;try{data=JSON.parse(t.replace(/^\uFEFF/,''));}catch(e){throw Error(file+' is not valid JSON: '+e.message);}
 return {data:validate(data),hash:hash(t),path:file};
}
// Values are untrusted text: single-line, no control characters, and no HTML comment markers that could break managed blocks.
const clean=s=>String(s).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').replace(/\s*\r?\n\s*/g,' ').replace(/<!--/g,'&lt;!--').replace(/-->/g,'--&gt;').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;').replace(/[`|]/g,c=>'\\'+c).trim();
const cell=s=>clean(s??'');
const table=(head,rows)=>rows?.length?block('| '+head.map(h=>h[0]).join(' | ')+' |\n|'+head.map(()=>'---').join('|')+'|\n'+rows.map(r=>'| '+head.map(h=>cell(r[h[1]])).join(' | ')+' |').join('\n')):null;
const bullets=(l,f=x=>clean(x))=>l?.length?block(l.map(x=>'- '+f(x)).join('\n')):null;
const code=p=>'`'+String(p).replace(/[\u0000-\u0008\u000b-\u001f\u007f`|<>]/g,'').trim()+'`';
const text=v=>v?clean(v):null;
function domainContext(d){
 return {slug:d.slug,name:clean(d.name),triggers:(d.triggers||[]).map(clean),overview:clean(d.overview),sourceOfTruth:d.sourceOfTruth||null,architecture:text(d.architecture),
  keyFiles:bullets(d.keyFiles,code),acceptanceCriteria:d.acceptanceCriteria?.length?block(d.acceptanceCriteria.map((x,i)=>(i+1)+'. '+clean(x)).join('\n')):null,
  constraints:bullets(d.constraints),designLink:d.designLink||null,translationKeys:(d.translationKeys||[]).map(clean),tests:text(d.tests)};
}
// Maps semantic.json onto the semantic.* placeholders documented in resources/templates/CONTRACT.md.
function context(data){
 if(!data)return {};const d=data,b=d.branding||{};
 return {architecture:{summary:text(d.architecture?.summary)},
  conventions:{list:bullets(d.conventions?.list),naming:text(d.conventions?.naming),lineLength:d.conventions?.lineLength??null,rxjs:text(d.conventions?.rxjs)},
  ui:{precedence:text(d.ui?.precedence),mapping:table([['Need','need'],['Use','use'],['Not','avoid']],d.ui?.mapping),sharedComponents:table([['Component','name'],['Use for','use']],d.ui?.sharedComponents),icons:text(d.ui?.icons)},
  i18n:{pattern:text(d.i18n?.pattern),keyNaming:text(d.i18n?.keyNaming)},
  services:{httpPattern:text(d.services?.httpPattern),coreServices:table([['Service','name'],['Responsibility','responsibility']],d.services?.coreServices),errorHandling:text(d.services?.errorHandling),caching:text(d.services?.caching)},
  styles:{breakpoints:text(d.styles?.breakpoints),layoutOffsets:text(d.styles?.layoutOffsets),tokenImport:text(d.styles?.tokenImport)},
  testing:{mockingStyle:text(d.testing?.mockingStyle),coverageTarget:text(d.testing?.coverageTarget),skipPatterns:(d.testing?.skipPatterns||[]).map(clean)},
  migrations:bullets(d.migrations,m=>code(m.path)+(m.plan?' — plan '+code(m.plan):'')+(m.notes?': '+clean(m.notes):'')),
  docs:{designDocDir:d.docs?.designDocDir||null,syncRule:text(d.docs?.syncRule)},
  branding:{source:text(b.source),fontFamily:text(b.fontFamily),palette:table([['Name','name'],['Value','value'],['Token','token'],['Usage','usage']],b.palette),typography:table([['Level','level'],['Size','size'],['Weight','weight'],['Line height','lineHeight'],['Colour','color'],['Usage','usage']],b.typography),components:table([['Component','component'],['Rule','rule']],b.components),notes:bullets(b.rules)},
  domains:(d.domains||[]).map(domainContext)};
}
module.exports={file,limit,schema,validate,load,context,clean};
