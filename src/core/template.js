'use strict';
const {derivePrefix}=require('./prefix');
// Only tags rooted in these namespaces are interpreted; any other {{...}} (Angular interpolation, JSX style objects) is literal text.
const roots=['repo','project','semantic'];
const PATH=/^(?:repo|project|semantic)(?:\.[A-Za-z_][\w-]*)+$/;
// Comments may contain one level of {{...}} (for example a target name using {{repo.prefix}}).
const TAG=/\{\{(!(?:[^{}]|\{\{[^{}]*\}\})*?|[^{}]*?)\}\}/g;
const isBlockTag=t=>/^(?:!|#if\s|else$|\/if$)/.test(t.trim());
const unknown=p=>`[unknown: ${p} — verify in semantic review]`;
// Pre-built Markdown produced by RepoWeave code from escaped parts; JSON input can never construct one.
class Block{constructor(text){this.text=text;}}
const block=t=>new Block(t);
function lookup(ctx,p){let v=ctx;for(const k of p.split('.')){if(v===null||typeof v!=='object'||!Object.prototype.hasOwnProperty.call(v,k))return undefined;v=v[k];}return v;}
const truthy=v=>!(v===undefined||v===null||v===false||v===''||v===0||(Array.isArray(v)&&!v.length)||(v instanceof Block&&!v.text));
function format(v,p,esc){
 if(v instanceof Block)return v.text;
 if(v===undefined||v===null||v==='')return unknown(p);
 if(Array.isArray(v))return v.length?v.map(x=>format(x,p,esc)).join(', '):'none detected';
 if(typeof v==='boolean')return v?'yes':'no';
 if(typeof v==='number')return String(v);
 if(typeof v==='string')return esc(v.replace(/\r?\n/g,' '));
 throw Error('Placeholder resolves to a non-scalar value: '+p);
}
function parse(text){
 // A block tag alone on its line consumes that line, so conditionals leave no blank lines.
 const src=text.replace(/^[ \t]*(\{\{(?:!(?:[^{}]|\{\{[^{}]*\}\})*?|#if [^{}]*?|else|\/if)\}\})[ \t]*\r?\n/gm,'$1');
 const root={type:'root',body:[]},stack=[root];let last=0;
 const top=()=>stack[stack.length-1],push=n=>(top().inElse?top().alt:top().body).push(n);
 for(const m of src.matchAll(TAG)){
  const tag=m[1].trim();let x;
  const literal=!isBlockTag(tag)&&!PATH.test(tag);
  if(literal&&!roots.some(r=>tag.startsWith(r+'.')))continue;
  if(m.index>last)push({type:'text',value:src.slice(last,m.index)});last=m.index+m[0].length;
  if(tag.startsWith('!'))continue;
  if((x=/^#if\s+(\S+)$/.exec(tag))){if(!PATH.test(x[1]))throw Error('Invalid condition path: '+x[1]);const n={type:'if',path:x[1],body:[],alt:[]};push(n);stack.push(n);}
  else if(tag==='else'){if(top().type!=='if'||top().inElse)throw Error('Unexpected {{else}}');top().inElse=true;}
  else if(tag==='/if'){if(top().type!=='if')throw Error('Unexpected {{/if}}');stack.pop();}
  else if(PATH.test(tag))push({type:'value',path:tag});
  else throw Error('Invalid placeholder: {{'+tag+'}}');
 }
 if(last<src.length)push({type:'text',value:src.slice(last)});
 if(stack.length>1)throw Error('Unclosed {{#if '+top().path+'}}');
 return root.body;
}
function emit(nodes,ctx,esc){return nodes.map(n=>n.type==='text'?n.value:n.type==='value'?format(lookup(ctx,n.path),n.path,esc):emit(truthy(lookup(ctx,n.path))?n.body:n.alt,ctx,esc)).join('');}
// options.escape is applied to every inserted string value (not to Blocks or template text), e.g. YAML quoting for frontmatter.
function render(text,ctx={},options={}){if(typeof text!=='string')throw Error('Template must be a string');return emit(parse(text),ctx,options.escape||(s=>s)).replace(/(\r?\n){3,}/g,'$1$1');}
// Frontmatter values are escaped for single-quoted YAML. Body text is not, so Markdown keeps apostrophes; semantic strings are cleaned before they arrive here.
function renderTemplate(text,ctx={}){
 const stripped=text.replace(/^\{\{!(?:[^{}]|\{\{[^{}]*\}\})*?\}\}\r?\n/,'');
 if(!stripped.startsWith('---\n'))return render(stripped,ctx);
 const end=stripped.indexOf('\n---\n',4);
 if(end<0)throw Error('Frontmatter not closed');
 const fm=render(stripped.slice(4,end),ctx,{escape:s=>s.replace(/'/g,"''")});
 const body=render(stripped.slice(end+5),ctx);
 return '---\n'+fm+'\n---\n'+body;
}
function placeholders(text){const out=new Set();const walk=ns=>{for(const n of ns){if(n.type==='value')out.add(n.path);if(n.type==='if'){out.add(n.path);walk(n.body);walk(n.alt);}}};walk(parse(text));return [...out].sort();}
function missing(text,ctx){return placeholders(text).filter(p=>!truthy(lookup(ctx,p)));}

// Maps profile.json onto the placeholder namespace documented in resources/templates/CONTRACT.md.
const v=f=>f&&f.value!==undefined?f.value:null;
const note=(f,s)=>s==null?null:f?.confidence==='declared'?s+' (declared dependency only; verify)':f?.confidence==='inferred'?s+' (inferred; verify)':s;
const names=l=>(l||[]).map(x=>x.package);
const fwName={'@angular/core':'Angular',react:'React',next:'Next.js','@remix-run/react':'Remix'};
const cellText=s=>String(s??'').replace(/[\r\n|]/g,' ').replace(/<!--|-->/g,'');
function routeTable(r){const t=r?.tree||[];if(!t.length)return null;const rows=t.slice(0,25).map(x=>`| \`${cellText(x.fullPath||x.path)}\` | ${cellText(x.kind)} | ${cellText(x.targetFile?'`'+x.targetFile+'`'+(x.symbol?' '+x.symbol:''):x.symbol||x.redirectTo||x.specifier||'')} | \`${cellText(x.file)}\` |`);return block('| Path | Kind | Target | Defined in |\n|---|---|---|---|\n'+rows.join('\n')+(t.length>25?`\n\n${t.length-25} more routes are listed in profile.json.`:''));}
function projectContext(profile,project,semantic={},repoExtra={}){
 const p=project,s=p.stack||{},fw=p.frameworks.find(f=>f.package==='@angular/core')||p.frameworks.find(f=>f.package==='next')||p.frameworks[0]||null;
 const version=fw?.resolved||fw?.declared||null,major=version&&/\d+/.exec(version)?Number(/\d+/.exec(version)[0]):null;
 const cmd=n=>{const c=p.commands.find(c=>c.name===n);return c?.argv?c.argv.join(' '):null;};
 const comp=p.composition?.value||{},angular=v(s.angular),t=v(s.testing),specs=v(s.specs),styling=v(s.styling),tokens=v(s.designTokens),ui=v(s.ui),i18n=v(s.i18n),sonar=v(s.sonar),lint=v(s.lint),fmt=v(s.formatter);
 const composition=!fw||fw.package!=='@angular/core'||!(comp.standalone||comp.ngmodule)?null:comp.standalone&&comp.ngmodule?`mixed (${comp.standalone} standalone, ${comp.ngmodule} NgModule-declared)`:comp.standalone?'standalone':'NgModule';
 const tsRoot=(p.tsconfigs||[]).find(x=>x.path===(p.root==='.'?'':p.root+'/')+'tsconfig.json')||(p.tsconfigs||[])[0];
 const spec=specs?.count?Object.entries(specs.suffixes).sort((a,b)=>b[1]-a[1])[0][0]:null;
 const loc=specs?.count?Object.entries(specs.locations).filter(([,n])=>n):[];
 const locLabel={colocated:'co-located with source',testsFolder:'__tests__ folders',separate:'separate test directories'};
 const ext=styling?.preprocessor||null,hints=profile.integrations?.hints||{};
 return {semantic,
  repo:{name:profile.name,instructionFiles:profile.existingInstructions,tracker:hints.azure?'Azure DevOps':hints.jira?'Jira':null,hasTracker:!!(hints.azure||hints.jira),designTool:hints.figma?'Figma':null,hasDesignTool:!!hints.figma,hasLabelFixer:false,specialistAgents:[],featureAgents:[],mcpConfig:profile.integrations?.configPaths||[],...repoExtra,prefix:repoExtra.prefix||derivePrefix(profile.name,profile.rootName)},
  project:{name:p.name,root:p.root,manifest:p.manifest,
   framework:{name:fw?fwName[fw.package]:null,package:fw?.package||null,version,major,versionSource:fw?fw.resolved?'lockfile':'declared range':null},
   isAngular:fw?.package==='@angular/core',isReact:p.frameworks.some(f=>f.package==='react'),isNext:p.frameworks.some(f=>f.package==='next'),
   language:{typescript:p.dependencies?.typescript||null,strict:tsRoot?(tsRoot.compilerOptions.strict===true?'on':'off'):null},
   packageManager:p.packageManager,
   commands:{test:cmd('test'),build:cmd('build'),lint:cmd('lint'),start:cmd('start'),e2e:cmd('e2e')},
   angular:{composition,isNgModule:composition==='NgModule',isStandalone:composition==='standalone',isMixed:!!composition?.startsWith('mixed'),prefix:angular?.prefix||null,builders:angular?.builders||{},hasLazyRoutes:p.lazyRoutes.length>0,lazyRoutes:p.lazyRoutes.length},
   styles:{ext,language:ext?ext.toUpperCase():null,languages:Object.keys(p.styles),globalFiles:styling?.globalStyles||[],tokenFiles:(tokens?.tokenFiles||[]).map(x=>x.file),hasTokens:!!tokens?.tokenFiles?.length,cssModules:p.cssModules.length>0,utility:names(ui?.css),fontFamilies:tokens?.fontFamilies||[],themes:tokens?.themes||[]},
   ui:{components:names(ui?.components),layout:names(ui?.layout),icons:names(ui?.icons),hasLibrary:!!ui?.components?.length},
   i18n:{library:note(s.i18n,names(i18n?.libraries)[0]||null),libraries:names(i18n?.libraries),resourceDirs:i18n?.resourceDirs||[],locales:i18n?.locales||[],hasI18n:!!(i18n?.libraries?.length||i18n?.resourceFiles?.length)},
   state:{libraries:names(p.tooling?.state)},
   testing:{runner:note(s.testing,t?.runner||null),framework:t?.framework||null,builder:t?.builder||null,configFiles:t?.configFiles||[],libraries:names(v(s.testLibraries)),specSuffix:spec,specGlob:spec?'**/*'+spec:null,specCount:specs?.count||0,hasSpecs:!!specs?.count,specLocation:loc.length>1?'mixed ('+loc.map(([k,n])=>locLabel[k]+' '+n).join(', ')+')':loc.length?locLabel[loc[0][0]]:null,e2e:v(s.e2e)||[],coverageReport:sonar?.properties?.coverageReport||null},
   lint:{tool:note(s.lint,lint?.tool||null),configFiles:lint?.configFiles||[]},
   format:{tool:fmt?.tool||null},
   sonar:{present:!!sonar,configFile:sonar?.configFile||null,projectKey:sonar?.properties?.projectKey||null,exclusions:sonar?.properties?.exclusions||null,coverageReport:sonar?.properties?.coverageReport||null},
   routes:{count:v(p.routes)?.count||0,hasRoutes:!!v(p.routes)?.count,files:v(p.routes)?.files||[],table:routeTable(v(p.routes))},
   architecture:{entryFiles:v(p.mainFiles)?.entries||[],rootRouteFiles:v(p.mainFiles)?.rootRoutes||[],appConfigFiles:v(p.mainFiles)?.appConfig||[],hubFiles:(v(p.mainFiles)?.hubs||[]).map(h=>h.file+' ('+h.inDegree+' importers)'),serviceDirs:[...new Set(p.services.filter(x=>x.scope==='root').map(x=>x.file.split('/').slice(0,-1).join('/')))].sort().slice(0,8),sharedDirs:[...new Set((profile.inventory||[]).filter(f=>p.root==='.'||f.startsWith(p.root+'/')).map(f=>/^((?:[^]*?\/)?shared)\//.exec(f)?.[1]).filter(Boolean))].sort().slice(0,8)}
  }};
}
module.exports={render,renderTemplate,placeholders,missing,projectContext,unknown,block,Block};
