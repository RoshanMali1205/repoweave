'use strict';
const {fs,path,hash,slash,read,inventory,redact}=require('./fs');
const ts=require('typescript');
const jsonc=require('jsonc-parser');
const YAML=require('yaml');
const sourceRE=/\.(?:[cm]?[jt]sx?|html|less|scss|sass|css)$/;
const configRE=/(^|\/)(package(?:-lock)?\.json|angular\.json|project\.json|workspace\.json|nx\.json|turbo\.json|tsconfig[^/]*\.json|pnpm-workspace\.yaml|pnpm-lock\.yaml|yarn\.lock|bun\.lock|\.editorconfig|\.gitignore|\.prettierrc[^/]*|\.eslintrc[^/]*|tslint\.json|sonar-project\.properties|Jenkinsfile|azure-pipelines\.ya?ml|\.gitlab-ci\.ya?ml|bitbucket-pipelines\.ya?ml|\.github\/workflows\/[^/]+\.ya?ml|(?:vite|vitest|jest|karma|playwright|cypress|protractor|next|eslint|tailwind|postcss|webpack|prettier)\.(?:config|conf)\.[^/]+)$/;
const ruleRE=/(^|\/)(AGENTS\.md|CLAUDE\.md|copilot-instructions\.md|[^/]+\.instructions\.md)$|(^|\/)\.claude\/rules\/.*\.md$/;
const depNames={frameworks:['@angular/core','react','next','@remix-run/react'],tests:['karma','jasmine-core','jest','vitest','@testing-library/react','@testing-library/angular','@playwright/test','cypress'],ui:['primeng','@angular/material','primereact','@mui/material','antd','@chakra-ui/react','@radix-ui/react-dialog','bootstrap'],state:['@ngrx/store','@ngrx/signals','@reduxjs/toolkit','zustand','jotai','mobx','@tanstack/react-query','swr'],styling:['tailwindcss','styled-components','@emotion/react','sass','less'],i18n:['@ngx-translate/core','@angular/localize','react-i18next','next-intl','i18next']};
const stackNames={
 testLibraries:['jasmine-core','karma','karma-coverage','jest','jest-preset-angular','vitest','@vitest/coverage-v8','@testing-library/angular','@testing-library/react','@testing-library/jest-dom','@testing-library/user-event','ng-mocks','@ngneat/spectator','msw','jsdom','happy-dom'],
 e2e:['@playwright/test','cypress','protractor','nightwatch','webdriverio'],
 i18n:['@ngx-translate/core','@angular/localize','@jsverse/transloco','@ngneat/transloco','angular-l10n','i18next','react-i18next','next-i18next','next-intl','react-intl','@lingui/core'],
 components:['primeng','@angular/material','@angular/cdk','@ng-bootstrap/ng-bootstrap','ngx-bootstrap','ng-zorro-antd','@taiga-ui/core','@clr/angular','@nebular/theme','primereact','@mui/material','antd','@chakra-ui/react','@mantine/core','react-bootstrap','@fluentui/react-components','@headlessui/react','@radix-ui/*'],
 layout:['@ngbracket/ngx-layout','@angular/flex-layout'],
 icons:['primeicons','@fortawesome/fontawesome-free','font-awesome','@fortawesome/angular-fontawesome','@fortawesome/react-fontawesome','material-icons','material-symbols','@mui/icons-material','lucide-react','lucide-angular','react-icons','@ng-icons/core'],
 css:['bootstrap','tailwindcss','primeflex','bulma','foundation-sites']
};
const sonarKeys={projectKey:'sonar.projectKey',projectName:'sonar.projectName',organization:'sonar.organization',sources:'sonar.sources',tests:'sonar.tests',exclusions:'sonar.exclusions',testInclusions:'sonar.test.inclusions',coverageExclusions:'sonar.coverage.exclusions',coverageReport:['sonar.javascript.lcov.reportPaths','sonar.typescript.lcov.reportPaths']};
const tokenPathRE=/(^|[\/_.-])(tokens?|design-tokens|theme|themes|theming|variables|vars|palette|colou?rs|brand|branding|typography|design-system)([\/_.-]|$)/i;
const styleRE=/\.(css|scss|sass|less)$/;
function properties(text){const o={};for(const l of text.replace(/\\\r?\n\s*/g,'').split(/\r?\n/)){const m=/^\s*([\w.-]+)\s*[=:]\s*(.*)$/.exec(l);if(m&&!/^\s*[#!]/.test(l))o[m[1]]=m[2].trim();}return o;}
function fact(value,evidence,confidence='observed'){return {value,evidence,confidence};}
function prop(o,name){return o?.properties?.find(p=>p.name?.getText().replace(/["']/g,'')===name)?.initializer;}
const routeKeys=['component','loadComponent','loadChildren','children','redirectTo','element','lazy','Component'];
// Route objects ({path, component|loadChildren|element...}) and JSX <Route> elements, with nested child paths joined.
function routeTree(sf,line){
 const out=[],str=n=>n&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null,join=(a,b)=>[a,b].filter(Boolean).join('/');
 const lazy=n=>{let specifier=null,symbol=null;const w=x=>{if(ts.isCallExpression(x)&&x.expression.kind===ts.SyntaxKind.ImportKeyword&&str(x.arguments[0]))specifier=str(x.arguments[0]);else if(!symbol&&ts.isPropertyAccessExpression(x)&&ts.isIdentifier(x.expression)&&/^[A-Z]/.test(x.name.text))symbol=x.name.text;ts.forEachChild(x,w);};w(n);const s=str(n);if(s&&s.includes('#'))[specifier,symbol]=s.split('#');return {specifier,symbol};};
 const tag=n=>{let t=null;const w=x=>{if(!t&&(ts.isJsxSelfClosingElement(x)||ts.isJsxOpeningElement(x)))t=x.tagName.getText(sf);if(!t)ts.forEachChild(x,w);};w(n);return t;};
 const describe=(get,full,n)=>{const r={path:'/'+full,line:line(n)};let v;
  if((v=get('loadChildren')||get('loadComponent')||get('lazy'))){r.kind=get('loadChildren')?'loadChildren':get('loadComponent')?'loadComponent':'lazy';Object.assign(r,lazy(v));}
  else if((v=get('component')||get('Component'))){r.kind='component';r.symbol=v.getText(sf);}
  else if((v=get('element'))){r.kind='element';r.symbol=tag(v);}
  else if((v=get('redirectTo'))){r.kind='redirect';r.redirectTo=str(v);}
  else r.kind='children';
  return r;};
 const attr=(el,name)=>{const a=el.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(sf)===name);if(!a)return null;const i=a.initializer;return i&&ts.isJsxExpression(i)?i.expression:i||a;};
 function visit(n,parent){
  if(out.length>=500)return;
  if(ts.isObjectLiteralExpression(n)){
   const get=k=>prop(n,k),p=get('path'),has=routeKeys.some(k=>get(k));
   if(p&&str(p)!==null&&has||!p&&get('children')&&(get('component')||get('element'))){
    const full=join(parent,str(p)||'');out.push(describe(get,full,n));
    for(const pr of n.properties){if(ts.isPropertyAssignment(pr)&&pr.name.getText(sf)==='children')visit(pr.initializer,full);else ts.forEachChild(pr,c=>visit(c,parent));}
    return;
   }
  }
  const el=ts.isJsxElement(n)?n.openingElement:ts.isJsxSelfClosingElement(n)?n:null;
  if(el&&el.tagName.getText(sf)==='Route'){
   const full=join(parent,str(attr(el,'path'))||'');if(attr(el,'path')||attr(el,'index'))out.push(describe(k=>attr(el,k),full,n));
   if(ts.isJsxElement(n))for(const c of n.children)visit(c,full);return;
  }
  ts.forEachChild(n,c=>visit(c,parent));
 }
 visit(sf,'');return out;
}
function syntax(file,text){
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true); const imports=[],components=[],services=[],modules=[],signals=[],routes=[];
 const angularImports=new Map();
 for(const st of sf.statements)if(ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)){
  imports.push({specifier:st.moduleSpecifier.text,line:sf.getLineAndCharacterOfPosition(st.getStart()).line+1});
  if(st.moduleSpecifier.text==='@angular/core')for(const el of st.importClause?.namedBindings?.elements||[])angularImports.set(el.name.text,el.propertyName?.text||el.name.text);
 }
 const line=n=>sf.getLineAndCharacterOfPosition(n.getStart()).line+1;
 function visit(n){
  if(ts.isCallExpression(n)) {
   const fn=n.expression.getText(sf);
   if(n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0]))imports.push({specifier:n.arguments[0].text,line:line(n),dynamic:true});
   if(['bootstrapApplication','bootstrapModule','createRoot','hydrateRoot','useState','useEffect','useReducer','createContext','signal','computed','effect','inject','provideHttpClient','takeUntilDestroyed','provideRouter','RouterModule.forRoot','RouterModule.forChild','createBrowserRouter','createHashRouter','createMemoryRouter','useRoutes'].includes(fn)||fn.endsWith('.bootstrapModule'))signals.push({kind:fn,line:line(n)});
  }
  if(ts.isPropertyAssignment(n)&&['loadComponent','loadChildren'].includes(n.name.getText(sf)))routes.push({kind:n.name.getText(sf),line:line(n)});
  if(ts.isClassDeclaration(n))for(const d of ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[]){
   if(!ts.isCallExpression(d.expression))continue;
   const name=angularImports.get(d.expression.expression.getText(sf));
   const o=d.expression.arguments[0];const ev={symbol:n.name?.text||'anonymous',line:line(n)};
   if(name==='Component'){const s=prop(o,'standalone');components.push({...ev,standalone:s?.kind===ts.SyntaxKind.TrueKeyword?true:s?.kind===ts.SyntaxKind.FalseKeyword?false:null,metadataOmitted:!s});}
   if(name==='NgModule')modules.push(ev);
   if(name==='Injectable'){const v=prop(o,'providedIn');services.push({...ev,scope:v&&ts.isStringLiteral(v)?v.text:v?'expression':'unspecified'});}
  }
  ts.forEachChild(n,visit);
 }visit(sf);
 const client=sf.statements.some(s=>ts.isExpressionStatement(s)&&ts.isStringLiteral(s.expression)&&s.expression.text==='use client');
 return {imports,components,services,modules,signals,routes,routeDefs:routeTree(sf,line),client,parseErrors:sf.parseDiagnostics.length};
}
async function scan(projectRoot, options={}) {
 const root=fs.realpathSync(projectRoot);const cancel=options.cancel||(()=>false);const inv=await inventory(root,cancel);
 const files=inv.files, fileSet=new Set(files), warnings=[...inv.notes], docs=new Map(), inputHashes={};
 const get=(f,limit)=>{if(docs.has(f))return docs.get(f);try{const t=read(root,f,limit);inputHashes[f]=hash(t);docs.set(f,t);return t;}catch(e){warnings.push(e.message);return null;}};
 const parse=(f)=>{if(!fileSet.has(f))return null;const t=get(f,8*1024*1024);if(t===null)return null;const errors=[];const d=jsonc.parse(t,errors,{allowTrailingComma:true});if(errors.length){warnings.push('Invalid JSON/JSONC: '+f);return null;}return d;};
 const configs=files.filter(f=>configRE.test(f)),rules=files.filter(f=>ruleRE.test(f));
 for(const f of configs)get(f,8*1024*1024);for(const f of rules)get(f);
 const manifests=files.filter(f=>path.posix.basename(f)==='package.json').map(f=>({file:f,data:parse(f)})).filter(x=>x.data&&typeof x.data==='object');
 const units=manifests.map(m=>({root:path.posix.dirname(m.file)==='.'?'':path.posix.dirname(m.file),name:m.data.name||path.posix.dirname(m.file),manifest:m.file,data:m.data}));
 for(const f of files.filter(f=>/(^|\/)angular\.json$/.test(f))) {
  const a=parse(f);if(!a?.projects)continue;
  for(const [name,p] of Object.entries(a.projects)){
   const base=path.posix.dirname(f);const r=path.posix.normalize(path.posix.join(base,p.root||''));const normalized=r==='.'?'':r;
   const existing=units.find(u=>u.root===normalized);
   if(existing){existing.angular={file:f,name,config:p};continue;}
   const parent=units.filter(u=>!u.root||normalized.startsWith(u.root+'/')).sort((a,b)=>b.root.length-a.root.length)[0];
   if(parent)units.push({...parent,root:normalized,name,angular:{file:f,name,config:p}});
  }
 }
 for(const f of files.filter(f=>/(^|\/)project\.json$/.test(f))) {
  const d=parse(f),r=path.posix.dirname(f);if(!d)continue;
  if(!units.some(u=>u.root===r)){const parent=units.filter(u=>!u.root||r.startsWith(u.root+'/')).sort((a,b)=>b.root.length-a.root.length)[0];if(parent)units.push({...parent,root:r,name:d.name||r,nx:{file:f,config:d}});}
 }
 const owner=f=>units.filter(u=>!u.root||f===u.root||f.startsWith(u.root+'/')).sort((a,b)=>b.root.length-a.root.length)[0];
 const candidates=files.filter(f=>sourceRE.test(f)&&!f.startsWith('.github/')&&!f.startsWith('.claude/')&&!f.startsWith('.codex/')&&!f.startsWith('.agents/'));
 const selected=candidates.slice(0,options.maxSourceFiles||4000);let bytes=0;
 const source=[];const omitted=[];
 for(let i=0;i<selected.length;i++){
  if(cancel())throw Error('Scan cancelled');
  if(i%40===0){options.progress?.(`${i}/${selected.length} source files`);await new Promise(r=>setImmediate(r));}
  if(bytes>32*1024*1024){omitted.push(selected[i]);continue;}
  const f=selected[i],t=get(f,512*1024);if(t===null){omitted.push(f);continue;}bytes+=Buffer.byteLength(t);
  source.push({file:f,unit:owner(f)?.root??null,...(/\.[cm]?[jt]sx?$/.test(f)?syntax(f,t):{imports:[],components:[],services:[],modules:[],signals:[],routes:[],routeDefs:[],client:false,parseErrors:0})});
 }
 omitted.push(...candidates.slice(selected.length));
 function tsconfig(f,seen=new Set()){
  if(seen.has(f)){warnings.push('tsconfig inheritance cycle: '+f);return {};}
  seen.add(f);const d=parse(f);if(!d)return {};
  let inherited={};for(const ext of Array.isArray(d.extends)?d.extends:d.extends?[d.extends]:[]){if(typeof ext!=='string')continue;
   if(!ext.startsWith('.')){warnings.push('Package tsconfig extends needs semantic review: '+f);continue;}
   let target=path.posix.normalize(path.posix.join(path.posix.dirname(f),ext));if(!target.endsWith('.json'))target+='.json';
   if(fileSet.has(target))inherited={...inherited,...tsconfig(target,new Set(seen))};else warnings.push('Unresolved tsconfig extends: '+f);
  }return {...inherited,...d.compilerOptions};
 }
 const byDir=new Map();for(const f of files){const d=path.posix.dirname(f);if(!byDir.has(d))byDir.set(d,[]);byDir.get(d).push(f);}
 // Config files in the project directory, else the closest ancestor directory that has any.
 const nearest=(dir,re)=>{for(let d=dir||'.';;d=path.posix.dirname(d)){const hit=(byDir.get(d)||[]).filter(f=>re.test(path.posix.basename(f)));if(hit.length||d==='.')return hit;}};
 const uniq=a=>[...new Set(a.filter(Boolean))];
 const resolveFile=base=>[base,...['.ts','.tsx','.js','.jsx','.mjs','.cjs','/index.ts','/index.tsx','/index.js','/index.jsx'].map(e=>base+e)].find(f=>fileSet.has(f))||null;
 // tsconfig paths/baseUrl along local extends; paths resolve against the effective baseUrl, else the declaring file's folder.
 const aliasCache=new Map();
 function aliasOf(f,seen=new Set()){
  if(aliasCache.has(f))return aliasCache.get(f);if(seen.has(f))return {};seen.add(f);
  const d=parse(f);let r={};
  if(d){for(const ext of Array.isArray(d.extends)?d.extends:d.extends?[d.extends]:[]){if(typeof ext!=='string'||!ext.startsWith('.'))continue;let t=path.posix.normalize(path.posix.join(path.posix.dirname(f),ext));if(!t.endsWith('.json'))t+='.json';if(fileSet.has(t))r={...r,...aliasOf(t,seen)};}
   const co=d.compilerOptions||{},dir=path.posix.dirname(f);
   if(typeof co.baseUrl==='string')r.baseUrl=path.posix.normalize(path.posix.join(dir,co.baseUrl));
   if(co.paths&&typeof co.paths==='object'&&!Array.isArray(co.paths)){r.paths=co.paths;r.pathsDir=dir;r.pathsFile=f;}}
  aliasCache.set(f,r);return r;
 }
 const tsFor=new Map();
 function configFor(file){const seen=[];let d=path.posix.dirname(file),r;
  for(;;d=path.posix.dirname(d)){if(tsFor.has(d)){r=tsFor.get(d);break;}seen.push(d);const c=path.posix.join(d,'tsconfig.json');if(fileSet.has(c)){r=aliasOf(c);break;}if(d==='.'){r=fileSet.has('tsconfig.base.json')?aliasOf('tsconfig.base.json'):{};break;}}
  for(const x of seen)tsFor.set(x,r);return r;}
 const packages=new Set(manifests.flatMap(m=>Object.keys({...m.data.dependencies,...m.data.devDependencies,...m.data.peerDependencies})));
 function resolveImport(from,spec){
  if(spec.startsWith('.')){const to=resolveFile(path.posix.normalize(path.posix.join(path.posix.dirname(from),spec)));return to?{to,resolution:'relative'}:null;}
  const c=configFor(from);
  if(c.paths){const base=c.baseUrl??c.pathsDir;let best=null;
   for(const [k,targets] of Object.entries(c.paths)){if(!Array.isArray(targets))continue;const star=k.indexOf('*');let m=null;
    if(star<0){if(k===spec)m='';}else{const pre=k.slice(0,star),suf=k.slice(star+1);if(spec.length>=pre.length+suf.length&&spec.startsWith(pre)&&spec.endsWith(suf))m=spec.slice(pre.length,spec.length-suf.length);}
    if(m!==null&&(!best||k.length>best.k.length))best={k,targets,m};}
   if(best)for(const t of best.targets){if(typeof t!=='string')continue;const to=resolveFile(path.posix.normalize(path.posix.join(base,t.replace('*',best.m))));if(to)return {to,resolution:'paths',alias:best.k,config:c.pathsFile};}}
  const pkg=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];
  if(c.baseUrl&&!packages.has(pkg)){const to=resolveFile(path.posix.normalize(path.posix.join(c.baseUrl,spec)));if(to)return {to,resolution:'baseUrl'};}
  return null;
 }
 const edges=[];
 for(const s of source)for(const imp of s.imports){const r=resolveImport(s.file,imp.specifier);edges.push({from:s.file,to:r?.to||null,specifier:imp.specifier,line:imp.line,dynamic:!!imp.dynamic,resolution:r?.resolution||null,...(r?.alias?{alias:r.alias}:{})});}
 const inDegree=new Map();for(const e of edges)if(e.to&&e.to!==e.from)inDegree.set(e.to,(inDegree.get(e.to)||0)+1);
 const specRE=/\.(?:spec|test)\.[cm]?[jt]sx?$/;
 function routesAndMain(u,own,ownFiles,deps){
  own=own.filter(s=>!specRE.test(s.file));ownFiles=ownFiles.filter(f=>!specRE.test(f)); // spec files are not routes, entry points or app config
  const rel=f=>u.root?f.slice(u.root.length+1):f;
  const tree=own.flatMap(s=>s.routeDefs.map(r=>{const t=r.specifier?resolveImport(s.file,r.specifier)?.to||null:null;return {...r,file:s.file,...(r.specifier?{targetFile:t}:{})};}));
  if(deps.next)for(const f of ownFiles){const m=/^(?:src\/)?app\/(?:(.*)\/)?page\.[jt]sx?$/.exec(rel(f))||/^(?:src\/)?pages\/(?!api\/|_)(.*?)(?:\/index)?\.[jt]sx?$/.exec(rel(f));if(m&&!specRE.test(f))tree.push({path:'/'+(m[1]||'').split('/').filter(x=>x&&!/^\(.*\)$/.test(x)).join('/'),kind:'file',file:f,line:1});}
  // Child route files mounted through loadChildren inherit the mount path.
  const join=(a,b)=>(a==='/'?'':a)+(b==='/'?'':b)||'/';
  const full=(file,p,depth=0)=>{const m=depth<5&&tree.find(x=>x.kind==='loadChildren'&&x.targetFile===file&&x.file!==file);return m?full(m.file,join(m.path,p),depth+1):p;};
  for(const r of tree)r.fullPath=full(r.file,r.path);
  tree.sort((a,b)=>a.fullPath.localeCompare(b.fullPath)||a.file.localeCompare(b.file)||a.line-b.line);
  const rootRe=/provideRouter|forRoot|create\w*Router|useRoutes/;
  const routeFiles=uniq(own.filter(s=>s.routeDefs.length||s.signals.some(x=>/provideRouter|RouterModule\.for|create\w*Router|useRoutes/.test(x.kind))).map(s=>s.file)).sort();
  const namedRoots=ownFiles.filter(f=>/(^|\/)app[.-](routes|routing\.module)\.ts$/.test(f));
  const rootRoutes=uniq([...own.filter(s=>s.signals.some(x=>rootRe.test(x.kind))&&s.routeDefs.length).map(s=>s.file),...namedRoots,...ownFiles.filter(f=>deps.next&&/^(?:src\/)?(app\/layout|pages\/_app)\.[jt]sx?$/.test(rel(f)))]).sort();
  const entries=own.filter(s=>s.signals.some(x=>/bootstrap|createRoot|hydrateRoot/.test(x.kind))).map(s=>s.file).sort();
  const appConfig=ownFiles.filter(f=>/(^|\/)(app\.config|app\.module|app\.config\.server)\.ts$|(^|\/)App\.[jt]sx?$/.test(f)).sort();
  const hubs=own.filter(s=>!specRE.test(s.file)&&(inDegree.get(s.file)||0)>=2).map(s=>({file:s.file,inDegree:inDegree.get(s.file)})).sort((a,b)=>b.inDegree-a.inDegree||a.file.localeCompare(b.file)).slice(0,10);
  return {routes:fact({count:tree.length,files:routeFiles,tree:tree.slice(0,200)},routeFiles.slice(0,10),tree.length?'observed':'unknown'),
   mainFiles:fact({entries,rootRoutes,appConfig,hubs},uniq([...entries,...rootRoutes,...appConfig,...hubs.map(h=>h.file)]),entries.length||appConfig.length||hubs.length?'observed':'unknown')};
 }
 function detectStack(u,deps,ownFiles,used,styleCounts){
  const dir=u.root||'.',pick=list=>list.flatMap(n=>n.endsWith('/*')?Object.keys(deps).filter(k=>k.startsWith(n.slice(0,-1))).sort():deps[n]?[n]:[]).map(n=>({package:n,declared:redact(String(deps[n])),used:used.has(n)}));
  let ws=null,wsFile=null,conf=null,ptr=null;
  if(u.angular){wsFile=u.angular.file;ws=parse(wsFile);conf=u.angular.config;ptr=`${wsFile}#projects.${u.angular.name}.${conf.architect?'architect':'targets'}`;}
  else{const nf=u.nx?.file||path.posix.join(dir,'project.json');const nx=fileSet.has(nf)?parse(nf):null;if(nx?.targets){wsFile=nf;conf=nx;ptr=nf+'#targets';}}
  const targets=conf?.architect||conf?.targets||{},base=u.angular?path.posix.dirname(wsFile):'.';
  const builder=k=>{const b=targets[k]?.builder||targets[k]?.executor;return typeof b==='string'?b:null;};
  const at=k=>ptr+'.'+k+(targets[k]?.builder?'.builder':'.executor');
  const rel=f=>typeof f==='string'?path.posix.normalize(path.posix.join(base,f)):null;
  // Test runner: workspace builder, then runner config files, then declared packages.
  const label={karma:'Karma',jest:'Jest',vitest:'Vitest',wtr:'Web Test Runner'};
  const cfgs={karma:nearest(dir,/^karma\.conf\.[cm]?[jt]s$/),jest:nearest(dir,/^jest\.config\.(?:[cm]?[jt]s|json)$/),vitest:[...nearest(dir,/^vitest\.config\.[cm]?[jt]s$/),...nearest(dir,/^vite\.config\.[cm]?[jt]s$/).filter(f=>/\btest\s*:\s*\{/.test(get(f)||''))]};
  if(u.data.jest&&typeof u.data.jest==='object')cfgs.jest.push(u.manifest+'#jest');
  const tb=builder('test'),to=targets.test?.options||{};let runner=null,rconf='unknown';const rev=[];
  if(tb){runner=/:karma$/.test(tb)?'karma':/unit-test$/.test(tb)?(to.runner||'vitest'):/jest/.test(tb)?'jest':/vite|vitest/.test(tb)?'vitest':/web-test-runner/.test(tb)?'wtr':null;
   // Angular's unit-test builder defaults to Vitest when no runner option is set.
   if(runner){rev.push(at('test'));rconf=/unit-test$/.test(tb)&&!to.runner?'inferred':'observed';}
   const cf=rel(to.karmaConfig||to.jestConfig||to.configFile);if(cf&&fileSet.has(cf))rev.push(cf);}
  if(!runner){const found=['karma','jest','vitest'].find(k=>cfgs[k].length);if(found){runner=found;rconf='observed';}}
  if(!runner){const d=['karma','jest','vitest'].find(k=>deps[k]);if(d){runner=d;rconf='declared';rev.push(u.manifest);}}
  if(runner&&cfgs[runner])rev.push(...cfgs[runner]);
  const framework=runner==='karma'||runner==='wtr'?(deps['jasmine-core']?'Jasmine':deps.mocha?'Mocha':null):runner?label[runner]:null;
  const testing=fact(runner?{runner:label[runner]||runner,framework,builder:tb,configFiles:uniq(rev.filter(e=>!e.includes('#')))}:null,uniq(rev),rconf);
  const specFiles=ownFiles.filter(f=>/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(f)&&!/(^|\/)(e2e|cypress|playwright)\//.test(f));
  const suffixes={},locations={colocated:0,testsFolder:0,separate:0};
  for(const f of specFiles){const sfx=/\.(?:spec|test)\.[cm]?[jt]sx?$/.exec(f)[0],stem=f.slice(0,-sfx.length);suffixes[sfx]=(suffixes[sfx]||0)+1;
   if(/(^|\/)__tests__\//.test(f))locations.testsFolder++;else if(['.ts','.tsx','.js','.jsx','.mjs','.cjs'].some(e=>fileSet.has(stem+e)))locations.colocated++;else locations.separate++;}
  const specs=fact({count:specFiles.length,suffixes,locations,examples:specFiles.slice(0,5)},specFiles.slice(0,5),'observed');
  const tl=pick(stackNames.testLibraries),testLibraries=fact(tl,tl.length?[u.manifest]:[],tl.some(x=>x.used)?'observed':tl.length?'declared':'unknown');
  const e2eCfg=nearest(dir,/^(?:(?:playwright|cypress)\.config\.[cm]?[jt]s|protractor\.conf\.[cm]?js)$/),eb=builder('e2e'),ed=pick(stackNames.e2e).map(x=>x.package);
  const e2eTool=s=>/playwright/.test(s)?'@playwright/test':/cypress/.test(s)?'cypress':/protractor/.test(s)?'protractor':s;
  const e2eNames=uniq([...e2eCfg.map(f=>e2eTool(path.posix.basename(f))),eb&&e2eTool(eb),...ed]);
  const e2e=fact(e2eNames,uniq([...e2eCfg,eb&&at('e2e'),ed.length&&u.manifest]),e2eCfg.length||eb?'observed':e2eNames.length?'declared':'unknown');
  const lb=builder('lint'),esl=nearest(dir,/^(?:eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.(?:json|js|cjs|ya?ml))?)$/),tsl=nearest(dir,/^tslint\.json$/);
  let tools=uniq([lb&&(/eslint/.test(lb)?'ESLint':/tslint/.test(lb)?'TSLint':null),esl.length&&'ESLint',tsl.length&&'TSLint']),lconf=tools.length?'observed':'unknown';
  if(!tools.length){tools=uniq([deps.eslint&&'ESLint',deps.tslint&&'TSLint']);if(tools.length)lconf='declared';}
  const lint=fact(tools.length?{tool:tools[0],tools,configFiles:[...esl,...tsl]}:null,uniq([lb&&at('lint'),...esl,...tsl,lconf==='declared'&&u.manifest]),lconf);
  const pc=nearest(dir,/^(?:\.prettierrc(?:\.\w+)?|prettier\.config\.[cm]?js)$/),pj=u.data.prettier!==undefined;
  const formatter=fact(pc.length||pj||deps.prettier?{tool:'Prettier',configFiles:pc}:null,uniq([...pc,(pj||deps.prettier)&&u.manifest]),pc.length||pj?'observed':deps.prettier?'declared':'unknown');
  // Sonar: allow-listed analysis keys only; credentials and server URLs are never recorded.
  const sp=nearest(dir,/^sonar-project\.properties$/)[0]||null;
  const ci=configs.filter(f=>/(^|\/)(azure-pipelines\.ya?ml|Jenkinsfile|\.gitlab-ci\.ya?ml|bitbucket-pipelines\.ya?ml)$|^\.github\/workflows\//.test(f)&&/sonar/i.test(get(f)||''));
  const scanners=pick(['sonarqube-scanner','sonar-scanner','@sonar/scan']).map(x=>x.package);let props={};
  if(sp){const raw=properties(get(sp)||'');for(const [k,keys] of Object.entries(sonarKeys)){const val=[].concat(keys).map(x=>raw[x]).find(Boolean);if(val)props[k]=redact(val).slice(0,500);}}
  const sonar=fact(sp||ci.length||scanners.length?{configFile:sp,properties:props,ciHints:ci,scannerPackages:scanners}:null,uniq([sp,...ci,scanners.length&&u.manifest]),sp||ci.length?'observed':scanners.length?'declared':'unknown');
  const il=pick(stackNames.i18n);
  const res=ownFiles.filter(f=>/(^|\/)(i18n|locales?|translations?|lang|langs|messages)\/.+\.(json|xlf|xliff|xmb|xtb|po|arb|ya?ml)$/i.test(f)||/\.(xlf|xliff)$/i.test(f)),resDirs=uniq(res.map(f=>path.posix.dirname(f))).sort().slice(0,10);
  const li=conf?.i18n,locales=li?uniq([typeof li.sourceLocale==='string'?li.sourceLocale:li.sourceLocale?.code,...Object.keys(li.locales||{})]):[];
  const i18n=fact(il.length||res.length||locales.length?{libraries:il,resourceDirs:resDirs,resourceFiles:res.length,locales}:null,uniq([il.length&&u.manifest,...resDirs,locales.length&&ptr?.replace(/\.(architect|targets)$/,'.i18n')]),res.length||locales.length||il.some(x=>x.used)?'observed':il.length?'declared':'unknown');
  const bo=targets.build?.options||{},entries=[...(bo.styles||[]),...(bo.scripts||[])].map(x=>typeof x==='string'?x:x?.input).filter(x=>typeof x==='string');
  const declaredGlobals=entries.filter(s=>styleRE.test(s)&&!/node_modules|^[@~]/.test(s)).map(rel).filter(f=>fileSet.has(f));
  const globals=declaredGlobals.length?declaredGlobals:ownFiles.filter(f=>/^(styles|globals?)\.(css|scss|sass|less)$/.test(path.posix.basename(f))||/(^|\/)src\/index\.(css|scss|less)$/.test(f));
  const refText=entries.join('\n')+'\n'+globals.map(f=>docs.get(f)||'').join('\n');
  const uiPick=k=>pick(stackNames[k]).map(x=>({...x,used:x.used||refText.includes(x.package+'/')||refText.includes('~'+x.package)||x.package==='tailwindcss'&&/@tailwind\b|["']tailwindcss["']/.test(refText)}));
  const uiv={components:uiPick('components'),layout:uiPick('layout'),icons:uiPick('icons'),css:uiPick('css')},uiAll=Object.values(uiv).flat();
  const ui=fact(uiAll.length?uiv:null,uniq([uiAll.length&&u.manifest,uiAll.some(x=>!used.has(x.package)&&x.used)&&ptr&&ptr+'.build.options']),uiAll.some(x=>x.used)?'observed':uiAll.length?'declared':'unknown');
  const sch=s=>{const v=s?.['@schematics/angular:component']?.style||s?.['@schematics/angular:component']?.styleext;return typeof v==='string'&&v!=='none'?v:null;};
  let pre=sch(conf?.schematics),pev=pre?[u.angular?`${wsFile}#projects.${u.angular.name}.schematics`:wsFile+'#schematics']:[],pconf='observed';
  if(!pre&&sch(ws?.schematics)){pre=sch(ws.schematics);pev=[wsFile+'#schematics'];}
  if(!pre&&typeof bo.inlineStyleLanguage==='string'){pre=bo.inlineStyleLanguage;pev=[ptr+'.build.options.inlineStyleLanguage'];}
  if(!pre){const top=Object.entries(styleCounts).sort((a,b)=>b[1]-a[1])[0];if(top){pre=top[0];pconf='inferred';}else pconf='unknown';}
  const styling=fact(pre||globals.length?{preprocessor:pre,globalStyles:globals}:null,uniq([...pev,...globals]),pconf);
  const tok=ownFiles.filter(f=>(styleRE.test(f)||/\.(json|[cm]?[jt]s)$/.test(f)&&/(^|[\/_.-])(design-)?tokens?([\/_.-]|$)/i.test(f))&&!/\.(spec|test)\./.test(f)).map(f=>{const t=styleRE.test(f)?docs.get(f):null;return {file:f,definitions:typeof t==='string'?(t.match(/^\s*(?:--[\w-]+|@[\w-]+|\$[\w-]+)\s*:/gm)||[]).length:null,named:tokenPathRE.test(f)};}).filter(x=>x.named&&x.definitions!==0||x.definitions>=8).sort((a,b)=>(b.definitions||0)-(a.definitions||0)||a.file.localeCompare(b.file)).slice(0,15).map(({file,definitions})=>({file,definitions}));
  const themes=uniq([...entries.filter(s=>/node_modules|^[@~]/.test(s)&&/theme/i.test(s)),...ownFiles.filter(f=>/\.(scss|sass)$/.test(f)&&/mat\.(?:define-(?:light-|dark-)?theme|theme)\(|@include\s+mat\.(?:core|all-component-themes)|mat-core\(/.test(docs.get(f)||'')),...nearest(dir,/^tailwind\.config\.[cm]?[jt]s$/)]);
  const fonts=new Map();for(const f of uniq([...globals,...tok.map(x=>x.file)]))for(const m of (docs.get(f)||'').matchAll(/font-family[\w-]*\s*:\s*([^;{}\n]+)/gi)){const val=m[1].trim();if(!/^(var\(|@|\$|inherit|initial|unset)/.test(val)&&!fonts.has(val))fonts.set(val,f);}
  const designTokens=fact(tok.length||themes.length||fonts.size?{tokenFiles:tok,themes,fontFamilies:[...fonts.keys()].slice(0,5)}:null,uniq([...tok.map(x=>x.file),...themes.filter(f=>fileSet.has(f)),...[...fonts.values()].slice(0,5)]),tok.some(x=>x.definitions>=8)||themes.length?'observed':tok.length||fonts.size?'inferred':'unknown');
  const angular=deps['@angular/core']&&conf?fact({project:u.angular?.name||conf.name||null,prefix:typeof conf.prefix==='string'?conf.prefix:null,builders:Object.fromEntries(Object.keys(targets).sort().map(k=>[k,builder(k)])),styleLanguage:pre,locales},[wsFile],'observed'):null;
  return {testing,specs,testLibraries,e2e,lint,formatter,sonar,i18n,ui,styling,designTokens,angular};
 }
 const projects=units.map(u=>{
  const dependencies={...u.data.dependencies,...u.data.devDependencies,...u.data.peerDependencies,...u.data.optionalDependencies};
  const own=source.filter(s=>s.unit===u.root);const ownFiles=files.filter(f=>owner(f)===u);
  const used=new Set(own.flatMap(s=>s.imports).map(i=>i.specifier.startsWith('@')?i.specifier.split('/').slice(0,2).join('/'):i.specifier.split('/')[0]));
  const frameworks=depNames.frameworks.filter(d=>dependencies[d]).map(d=>({package:d,declared:dependencies[d],resolved:null,evidence:u.manifest,used:used.has(d)}));
  for(const fw of frameworks){let dir=path.posix.dirname(u.manifest);while(true){const lf=path.posix.join(dir,'package-lock.json');const lock=parse(lf);if(lock){let search=u.root;while(true){const key=path.posix.join(search,'node_modules',fw.package);const val=lock.packages?.[path.posix.relative(dir,key)]?.version;if(val){fw.resolved=val;fw.lockfile=lf;break;}if(!search||search==='.')break;search=path.posix.dirname(search);if(search==='.')search='';}if(!fw.resolved&&dir==='.')fw.resolved=lock.dependencies?.[fw.package]?.version||null;if(fw.resolved)break;}if(dir==='.')break;dir=path.posix.dirname(dir);}}
  // Resolve pnpm's per-importer entries separately; peer suffixes do not change the package version.
  for(const fw of frameworks.filter(f=>!f.resolved)) {
   let dir=path.posix.dirname(u.manifest);
   while(true) {
    const lf=path.posix.join(dir,'pnpm-lock.yaml');
    if(fileSet.has(lf))try {
     const lock=YAML.parse(get(lf,8*1024*1024),{maxAliasCount:50});
     const importer=path.posix.relative(dir,path.posix.dirname(u.manifest))||'.';
     const entry=lock?.importers?.[importer]|| (importer==='.'?lock:null);
     const value=entry?.dependencies?.[fw.package]||entry?.devDependencies?.[fw.package]||entry?.optionalDependencies?.[fw.package];
     const v=typeof value==='string'?value:value?.version;
     if(typeof v==='string'&&/^\d+\.\d+\.\d+/.test(v)){fw.resolved=v.split('(')[0];fw.lockfile=lf;break;}
    }catch{warnings.push('Unable to resolve pnpm lock: '+lf);}
    if(dir==='.')break;dir=path.posix.dirname(dir);
   }
  }
  const a=frameworks.find(f=>f.package==='@angular/core');const major=a?.resolved?Number(a.resolved.split('.')[0]):null;
  const comps=own.flatMap(s=>s.components.map(c=>({...c,file:s.file})));const counts={standalone:0,ngmodule:0,unknown:0};
  for(const c of comps){if(c.standalone===true)counts.standalone++;else if(c.standalone===false)counts.ngmodule++;else if(c.metadataOmitted&&major)counts[major>=19?'standalone':'ngmodule']++;else counts.unknown++;}
  const styles={};for(const f of ownFiles){const ext=path.posix.extname(f).slice(1);if(['css','scss','sass','less'].includes(ext))styles[ext]=(styles[ext]||0)+1;}
  const ancestorManager=manifests.filter(m=>{const d=path.posix.dirname(m.file);return d==='.'||u.root===d||u.root.startsWith(d+'/');}).sort((a,b)=>b.file.length-a.file.length).find(m=>m.data.packageManager)?.data.packageManager;
  const pm=(u.data.packageManager||ancestorManager)?.split('@')[0]||(['pnpm-lock.yaml','yarn.lock','package-lock.json','bun.lock'].map((l,i)=>({l,pm:['pnpm','yarn','npm','bun'][i]})).find(x=>fileSet.has(path.posix.join(u.root,x.l))||fileSet.has(x.l))?.pm)||null;
  const commands=Object.keys(u.data.scripts||{}).sort().map(name=>({name,cwd:path.posix.dirname(u.manifest),argv:pm?[pm,'run',name]:null,evidence:u.manifest+'#scripts.'+name,status:'not-run'}));
  const tconfigs=ownFiles.filter(f=>/(^|\/)tsconfig[^/]*\.json$/.test(f)).map(f=>({path:f,compilerOptions:tsconfig(f)}));
  return {id:hash(u.root||'.').slice(0,10),root:u.root||'.',name:u.name,manifest:u.manifest,frameworks,dependencies:Object.fromEntries(Object.entries(dependencies).filter(([k,v])=>typeof v==='string').map(([k,v])=>[k,redact(v)])),composition:fact(counts,comps,'observed'),bootstrap:own.flatMap(s=>s.signals.filter(x=>/bootstrap|createRoot|hydrateRoot/.test(x.kind)).map(x=>({...x,file:s.file}))),modules:own.flatMap(s=>s.modules.map(x=>({...x,file:s.file}))),services:own.flatMap(s=>s.services.map(x=>({...x,file:s.file}))),lazyRoutes:own.flatMap(s=>s.routes.map(x=>({...x,file:s.file}))),clientBoundaryFiles:own.filter(s=>s.client).map(s=>s.file),styles,cssModules:ownFiles.filter(f=>/\.module\.(css|scss|less)$/.test(f)),tooling:Object.fromEntries(Object.entries(depNames).filter(([k])=>k!=='frameworks').map(([k,list])=>[k,list.filter(d=>dependencies[d]).map(d=>({package:d,used:used.has(d)}))])),packageManager:pm,commands,tsconfigs:tconfigs,configFiles:configs.filter(f=>ownFiles.includes(f)),tokenFiles:ownFiles.filter(f=>/token|theme|variables/i.test(f)&&/\.(ts|css|scss|less|sass|json)$/.test(f)),sourceFiles:own.length,angularConfig:u.angular?{path:u.angular.file,name:u.angular.name,root:u.angular.config.root,sourceRoot:u.angular.config.sourceRoot,builders:Object.fromEntries(Object.entries(u.angular.config.architect||u.angular.config.targets||{}).map(([k,v])=>[k,v.builder||null]))}:null,stack:detectStack(u,dependencies,ownFiles,used,styles),...routesAndMain(u,own,ownFiles,dependencies)};
 });
 const profile={schemaVersion:1,generatorVersion:'0.1.0',name:manifests.find(m=>m.file==='package.json')?.data.name||path.basename(root),rootName:path.basename(root),inventoryMode:inv.mode,inventory:files,projects,existingInstructions:rules,configFiles:configs,inputHashes,edges,integrations:{hints:{azure:files.some(f=>/azure-pipelines|\.azuredevops/.test(f)),jira:files.some(f=>/jira/i.test(f)),figma:files.some(f=>/figma/i.test(f))},configPaths:['.vscode/mcp.json','.mcp.json','.codex/config.toml'].filter(f=>fileSet.has(f)),verification:'not-tested'},coverage:{inventoryFiles:files.length,eligibleSourceFiles:candidates.length,analyzedSourceFiles:source.length,omittedSourceFiles:omitted,semanticReview:'pending',astParseErrors:source.filter(s=>s.parseErrors).map(s=>({file:s.file,count:s.parseErrors}))},unknowns:['Business flows, token precedence and team conventions need semantic review.','Declared dependencies and file presence do not prove runtime usage or architectural intent.','Package-based tsconfig inheritance and computed route expressions may stay unresolved. Local tsconfig paths and baseUrl are resolved.','Stack facts come from workspace builders, config file names and declared packages; runner options inside JavaScript configs are not evaluated.'],warnings:[...new Set(warnings)]};
 profile.fingerprint=hash(JSON.stringify(inputHashes));return profile;
}
module.exports={scan,syntax,sourceRE,configRE,ruleRE};
