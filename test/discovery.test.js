'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),cp=require('node:child_process');
// Keep fixtures independent of any repository that encloses the temp directory (for example a home-directory repo).
process.env.GIT_CEILING_DIRECTORIES=os.tmpdir();
const {fs,path,safe,inventory}=require('../src/core/fs');const {scan}=require('../src/core/scanner');
function temp(t){const d=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'repoweave-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function put(r,p,v){fs.mkdirSync(path.dirname(path.join(r,p)),{recursive:true});fs.writeFileSync(path.join(r,p),typeof v==='string'?v:JSON.stringify(v));}
const git=(...a)=>cp.execFileSync('git',a,{stdio:'ignore'});

test('safe accepts unnormalized workspace roots and still rejects escapes',t=>{
 const r=temp(t);put(r,'a/b.txt','x');put(r,'..dots','x');const want=path.join(r,'a','b.txt');
 assert.equal(safe(r+path.sep,'a/b.txt'),want);
 assert.equal(safe(r.split(path.sep).join('/'),'a/b.txt'),want);
 const drive=path.parse(r).root;assert.equal(safe(drive,path.relative(drive,want).split(path.sep).join('/')),want);
 assert.equal(safe(r,'..dots'),path.join(r,'..dots'));
 for(const bad of ['../x','a/../../x','a\\b','/etc/passwd',''])assert.throws(()=>safe(r,bad));
 if(process.platform==='win32')assert.throws(()=>safe(r,(/^c/i.test(r)?'D':'C')+':x'),/outside/);
});
test('project inside a folder ignored by its enclosing repository falls back to a filesystem walk',async t=>{
 const r=temp(t);git('init','-q',r);put(r,'.gitignore','app/\n');put(r,'app/package.json','{}');put(r,'app/src/a.ts','x');
 const inv=await inventory(path.join(r,'app'));
 assert.equal(inv.mode,'filesystem');assert.deepEqual(inv.files,['package.json','src/a.ts']);assert.match(inv.notes[0],/listed no files/);
});
test('nested independent repositories are inventoried instead of silently dropped',async t=>{
 const r=temp(t);git('init','-q',r);put(r,'package.json','{}');git('init','-q',path.join(r,'nested'));put(r,'nested/package.json','{}');put(r,'nested/src/b.ts','x');put(r,'nested/.gitignore','gen/\n');put(r,'nested/gen/c.ts','x');
 const inv=await inventory(r);
 assert.equal(inv.mode,'git');assert.deepEqual(inv.files,['nested/.gitignore','nested/package.json','nested/src/b.ts','package.json']);
});
test('paths longer than MAX_PATH are inventoried in Git mode',async t=>{
 const r=temp(t);git('init','-q',r);const deep=Array(12).fill('abcdefghijklmnopqrstuvwxyz').join('/')+'/x.ts';put(r,deep,'x');
 assert(path.join(r,deep).length>260);assert.deepEqual((await inventory(r)).files,[deep]);
});
test('inventory notes distinguish missing Git from a folder that is not a repository',async t=>{
 const r=temp(t);put(r,'a.ts','x');
 assert.match((await inventory(r)).notes[0],/^Not a Git repository/);
 const saved=process.env.PATH;process.env.PATH='';
 try{const inv=await inventory(r);assert.equal(inv.mode,'filesystem');assert.match(inv.notes[0],/not found on PATH/);assert.deepEqual(inv.files,['a.ts']);}finally{process.env.PATH=saved;}
});
test('framework caches, build outputs and credential files are excluded in both inventory modes',async t=>{
 const r=temp(t);put(r,'src/a.ts','x');put(r,'src/app/credentials.service.ts','export class CredentialsService {}');put(r,'src/app/models/secrets.ts','export interface Secrets {}');
 for(const f of ['.nx/cache/1/a.js','out-tsc/app/a.js','.pnpm-store/v3/x.js','.sass-cache/a.scss','storybook-static/a.js','id_rsa','keys/deploy.ppk','.yarnrc.yml','.git-credentials','.npmrc','.netrc','.env.local','certs/server.pem','android.keystore','secrets.json'])put(r,f,'x');
 const kept=['src/a.ts','src/app/credentials.service.ts','src/app/models/secrets.ts'];
 assert.deepEqual((await inventory(r)).files,kept);
 git('init','-q',r);const inv=await inventory(r);assert.equal(inv.mode,'git');assert.deepEqual(inv.files,kept);
});

function angularFixture(t){
 const r=temp(t);
 put(r,'package.json',{name:'ng-app',dependencies:{'@angular/core':'^15.2.0',primeng:'^15.0.0','@angular/material':'^15.0.0','@ngbracket/ngx-layout':'^15.0.0',bootstrap:'^5.0.0',primeicons:'^6.0.0','@ngx-translate/core':'^14.0.0'},devDependencies:{karma:'~6.4.0','jasmine-core':'~4.5.0',tslint:'^6.0.0',jest:'^29.0.0'},scripts:{test:'ng test',lint:'ng lint'}});
 put(r,'angular.json',{projects:{app:{root:'',sourceRoot:'src',prefix:'app',schematics:{'@schematics/angular:component':{style:'less'}},architect:{
  build:{builder:'@angular-devkit/build-angular:browser',options:{styles:['node_modules/primeng/resources/themes/lara-light-blue/theme.css','node_modules/bootstrap/dist/css/bootstrap.min.css','src/styles.less']}},
  test:{builder:'@angular-devkit/build-angular:karma',options:{karmaConfig:'karma.conf.js'}},lint:{builder:'@angular-devkit/build-angular:tslint'}},i18n:{sourceLocale:'en-GB',locales:{nl:'src/locale/messages.nl.xlf'}}}}});
 put(r,'karma.conf.js','module.exports = function (config) {};');put(r,'tslint.json',{rules:{}});
 put(r,'sonar-project.properties','# analysis\nsonar.projectKey=APPKEY\nsonar.sources=src\nsonar.exclusions=**/*.spec.ts,\\\n  src/main.ts\nsonar.javascript.lcov.reportPaths=coverage/app/lcov.info\nsonar.login=supersecret\nsonar.host.url=https://sonar.internal.example\n');
 put(r,'azure-pipelines.yml','steps:\n- task: SonarQubePrepare@5\n');
 put(r,'src/styles.less',"@import (reference) 'styles/tokens/_index.less';\nbody { font-family: 'Brand Sans', Arial; }\n");
 put(r,'src/styles/tokens/_colors.less',Array.from({length:10},(_,i)=>`@c${i}: #00000${i};`).join('\n'));
 put(r,'src/assets/i18n/en.json','{}');
 put(r,'src/app/a.component.ts',"import { Component } from '@angular/core'; import { TableModule } from 'primeng/table'; import { TranslateService } from '@ngx-translate/core'; @Component({selector:'app-a',standalone:false}) export class A {}");
 put(r,'src/app/a.component.spec.ts','describe("A",()=>{});');put(r,'src/app/a.component.less','a{}');put(r,'e2e/src/app.spec.ts','x');
 return r;
}
test('Angular stack: builders, Karma, specs, TSLint, Sonar allow-list, i18n, UI usage, tokens and themes',async t=>{
 const p=await scan(angularFixture(t)),s=p.projects[0].stack;
 assert.deepEqual(s.testing.value,{runner:'Karma',framework:'Jasmine',builder:'@angular-devkit/build-angular:karma',configFiles:['karma.conf.js']});
 assert.equal(s.testing.confidence,'observed');assert(s.testing.evidence.includes('angular.json#projects.app.architect.test.builder'));
 assert.deepEqual(s.specs.value.suffixes,{'.spec.ts':1});assert.equal(s.specs.value.locations.colocated,1);
 assert.equal(s.lint.value.tool,'TSLint');assert.equal(s.lint.confidence,'observed');
 assert.deepEqual(s.sonar.value.properties,{projectKey:'APPKEY',sources:'src',exclusions:'**/*.spec.ts,src/main.ts',coverageReport:'coverage/app/lcov.info'});
 assert.deepEqual(s.sonar.value.ciHints,['azure-pipelines.yml']);assert(!JSON.stringify(p).includes('supersecret')&&!JSON.stringify(p).includes('sonar.internal'));
 assert.deepEqual(s.i18n.value.libraries.map(x=>[x.package,x.used]),[['@ngx-translate/core',true]]);assert.deepEqual(s.i18n.value.resourceDirs,['src/assets/i18n']);assert.deepEqual(s.i18n.value.locales,['en-GB','nl']);
 const ui=Object.fromEntries(Object.entries(s.ui.value).map(([k,l])=>[k,l.map(x=>x.package+':'+x.used)]));
 assert.deepEqual(ui,{components:['primeng:true','@angular/material:false'],layout:['@ngbracket/ngx-layout:false'],icons:['primeicons:false'],css:['bootstrap:true']});
 assert.deepEqual(s.styling.value,{preprocessor:'less',globalStyles:['src/styles.less']});assert.equal(s.styling.confidence,'observed');
 assert.deepEqual(s.designTokens.value.tokenFiles,[{file:'src/styles/tokens/_colors.less',definitions:10}]);
 assert.deepEqual(s.designTokens.value.themes,['node_modules/primeng/resources/themes/lara-light-blue/theme.css']);assert.deepEqual(s.designTokens.value.fontFamilies,["'Brand Sans', Arial"]);
 assert.equal(s.angular.value.prefix,'app');assert.equal(s.angular.value.builders.lint,'@angular-devkit/build-angular:tslint');
 assert(!p.unknowns.some(u=>/yarn|bun/i.test(u)));
});
test('React stack: Vitest in vite config, __tests__ specs, ESLint flat config, Tailwind and i18next',async t=>{
 const r=temp(t);put(r,'package.json',{name:'web',dependencies:{react:'^19.0.0','react-i18next':'^15.0.0',i18next:'^24.0.0'},devDependencies:{vitest:'^3.0.0','@testing-library/react':'^16.0.0',tailwindcss:'^4.0.0',eslint:'^9.0.0'}});
 put(r,'vite.config.ts',"export default { test: { environment: 'jsdom' } };");put(r,'eslint.config.js','export default [];');
 put(r,'src/index.css','@import "tailwindcss";');put(r,'src/App.tsx',"import { useTranslation } from 'react-i18next'; export const App=()=>null;");put(r,'src/__tests__/App.test.tsx',"import { render } from '@testing-library/react';");put(r,'public/locales/en/common.json','{}');
 const s=(await scan(r)).projects[0].stack;
 assert.equal(s.testing.value.runner,'Vitest');assert.equal(s.testing.confidence,'observed');assert.deepEqual(s.testing.value.configFiles,['vite.config.ts']);
 assert.deepEqual(s.specs.value.locations,{colocated:0,testsFolder:1,separate:0});
 assert.deepEqual(s.testLibraries.value.map(x=>x.package+':'+x.used),['vitest:false','@testing-library/react:true']);assert.equal(s.testLibraries.confidence,'observed');
 assert.equal(s.lint.value.tool,'ESLint');assert.deepEqual(s.ui.value.css.map(x=>x.used),[true]);
 assert.deepEqual(s.i18n.value.resourceDirs,['public/locales/en']);assert.equal(s.styling.value.preprocessor,'css');assert.equal(s.styling.confidence,'inferred');
 assert.equal(s.angular,null);assert.equal(s.sonar.value,null);
});
test('tsconfig paths and baseUrl resolve in the import graph and unresolved aliases stay unresolved',async t=>{
 const r=temp(t);put(r,'package.json',{name:'alias-app'});
 put(r,'tsconfig.json',{compilerOptions:{baseUrl:'.',paths:{'@app/*':['src/app/*'],'@env':['src/environments/environment.ts']}}});
 put(r,'src/app/widget.ts','export class Widget {}');put(r,'src/environments/environment.ts','export const env = {};');
 put(r,'src/main.ts',"import {Widget} from '@app/widget'; import {env} from '@env'; import {Missing} from '@missing/x';");
 const p=await scan(r),edges=p.edges.filter(e=>e.from==='src/main.ts');
 assert.deepEqual(edges.find(e=>e.specifier==='@app/widget'),{from:'src/main.ts',to:'src/app/widget.ts',specifier:'@app/widget',line:1,dynamic:false,resolution:'paths',alias:'@app/*'});
 assert.equal(edges.find(e=>e.specifier==='@env').to,'src/environments/environment.ts');
 assert.equal(edges.find(e=>e.specifier==='@missing/x').to,null);
});
test('Angular lazy routes, React routes, Next pages and main files carry evidence and confidence',async t=>{
 const r=temp(t);put(r,'package.json',{name:'routed',dependencies:{'@angular/core':'^19.0.0',react:'^19.0.0',next:'^15.0.0'}});
 put(r,'src/main.ts',"import {bootstrapApplication} from '@angular/platform-browser'; import {appConfig} from './app/app.config'; bootstrapApplication(null, appConfig);");
 put(r,'src/app/app.config.ts',"import {provideRouter} from '@angular/router'; export const appConfig={providers:[provideRouter([])]};");
 put(r,'src/app/app.routes.ts',"export const routes=[{path:'home',loadComponent:()=>import('./home/home.component')},{path:'orders',loadChildren:()=>import('./orders/orders.routes')}];");
 put(r,'src/app/home/home.component.ts','export class HomeComponent {}');
 put(r,'src/app/orders/orders.routes.ts',"export const routes=[{path:'list',loadComponent:()=>import('./list.component')}];");
 put(r,'src/app/orders/list.component.ts','export class ListComponent {}');
 put(r,'src/app/shared/widget.ts','export class Widget {}');
 put(r,'src/app/a.ts',"import {Widget} from './shared/widget';");put(r,'src/app/b.ts',"import {Widget} from './shared/widget';");
 put(r,'src/App.tsx',"export function App(){return <Route path=\"inbox\" element={<Inbox/>}/>;}");
 put(r,'src/app/dashboard/page.tsx','export default function Page(){return null}');
 const project=(await scan(r)).projects[0],routes=project.routes,main=project.mainFiles;
 assert.equal(routes.confidence,'observed');assert.ok(routes.evidence.includes('src/app/app.routes.ts'));
 const home=routes.value.tree.find(x=>x.fullPath==='/home');assert.equal(home.kind,'loadComponent');assert.equal(home.targetFile,'src/app/home/home.component.ts');
 const list=routes.value.tree.find(x=>x.fullPath==='/orders/list');assert.equal(list.kind,'loadComponent');assert.equal(list.targetFile,'src/app/orders/list.component.ts');
 assert.ok(routes.value.tree.some(x=>x.kind==='element'&&x.fullPath==='/inbox'));
 assert.ok(routes.value.tree.some(x=>x.kind==='file'&&x.fullPath==='/dashboard'&&x.file==='src/app/dashboard/page.tsx'));
 assert.equal(main.confidence,'observed');
 assert.deepEqual(main.value.entries,['src/main.ts']);
 assert.ok(main.value.appConfig.includes('src/app/app.config.ts'));
 assert.ok(main.value.rootRoutes.includes('src/app/app.routes.ts'));
 assert.equal(main.value.hubs[0].file,'src/app/shared/widget.ts');assert.ok(main.value.hubs[0].inDegree>=2);
 assert.ok(main.evidence.includes('src/main.ts')&&main.evidence.includes('src/app/shared/widget.ts'));
});
test('an empty Angular routes file is still the root routes file',async t=>{
 const r=temp(t);put(r,'package.json',{name:'empty-routes',dependencies:{'@angular/core':'^21.0.0'}});
 put(r,'src/main.ts',"import {bootstrapApplication} from '@angular/platform-browser'; bootstrapApplication(null);");
 put(r,'src/app/app.config.ts',"import {provideRouter} from '@angular/router'; import {routes} from './app.routes'; export const appConfig={providers:[provideRouter(routes)]};");
 put(r,'src/app/app.routes.ts','export const routes = [];');
 const project=(await scan(r)).projects[0],main=project.mainFiles;
 assert.deepEqual(main.value.entries,['src/main.ts']);
 assert.deepEqual(main.value.rootRoutes,['src/app/app.routes.ts']);
 assert.deepEqual(main.value.appConfig,['src/app/app.config.ts']);
 assert.equal(project.routes.confidence,'unknown');
});
test('Angular unit-test builder: runner option is observed, default runner is only inferred',async t=>{
 const r=temp(t);put(r,'package.json',{dependencies:{'@angular/core':'^21.0.0'}});const ws=o=>({projects:{app:{root:'',architect:{test:{builder:'@angular/build:unit-test',...(o?{options:o}:{})}}}}});
 put(r,'angular.json',ws());let s=(await scan(r)).projects[0].stack.testing;assert.equal(s.value.runner,'Vitest');assert.equal(s.confidence,'inferred');
 put(r,'angular.json',ws({runner:'karma'}));s=(await scan(r)).projects[0].stack.testing;assert.equal(s.value.runner,'Karma');assert.equal(s.confidence,'observed');
 put(r,'angular.json',{projects:{app:{root:''}}});s=(await scan(r)).projects[0].stack.testing;assert.equal(s.value,null);assert.equal(s.confidence,'unknown');
});
