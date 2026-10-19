'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os');
const YAML=require('yaml');
const {fs,path,hash}=require('../src/core/fs');
const {scan}=require('../src/core/scanner');
const {generate}=require('../src/core/generator');
const {agentPrefix}=require('../src/core/prefix');
const {plan,apply}=require('../src/core/writer');
const {validateFiles}=require('../src/core/writer');
const semantic=require('../src/core/semantic');
function temp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'repoweave-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function put(r,p,v){fs.mkdirSync(path.dirname(path.join(r,p)),{recursive:true});fs.writeFileSync(path.join(r,p),typeof v==='string'?v:JSON.stringify(v));}
function app(t,extra={}){const r=temp(t);put(r,'package.json',{name:extra.name||'@acme/My App',dependencies:{react:'^19.0.0'},scripts:{test:'vitest'}});put(r,'src/a.ts','export class A {}');return r;}
const names=g=>g.files.filter(f=>f.path.startsWith('.github/agents/')).map(f=>f.path.slice('.github/agents/'.length,-'.agent.md'.length)).sort();
function fm(text){const m=/^---\n([\s\S]*?)\n---\n/.exec(text);return YAML.parse(m[1]);}

test('prefix derives from the package name, then the folder, and rejects unsafe overrides',()=>{
 assert.equal(agentPrefix('','@Scope/My App_Name','folder'),'my-app-name');
 assert.equal(agentPrefix('','','Folder Name'),'folder-name');
 assert.equal(agentPrefix('','',''),'project');
 assert.equal(agentPrefix('  ','@x/demo','folder'),'demo');
 assert.equal(agentPrefix('Custom_Prefix','ignored','ignored'),'custom-prefix');
 for(const bad of ['../x','foo/bar','C:drive','a\\b','..','con'])assert.throws(()=>agentPrefix(bad,'app','app'),/Unsafe/);
});
test('generated names use the prefix and omit defect and pull-request agents',async t=>{
 const r=app(t),g=generate(await scan(r),{targets:['copilot','claude','codex']});
 assert.equal(g.prefix,'my-app');
 assert.deepEqual(names(g),['my-app-harness-builder','my-app-implementer','my-app-orchestrator','my-app-planner','my-app-researcher','my-app-reviewer','my-app-test-fixer','my-app-test-generator','my-app-ui-specialist']);
 assert.ok(!g.files.some(f=>/defect-analyst|pr-reviewer|analyse-defect|review-pr/.test(f.path)));
 assert.ok(g.files.some(f=>f.path==='.agents/skills/my-app-bootstrap/SKILL.md'));
 assert.ok(g.files.some(f=>f.path==='.github/prompts/my-app-plan-feature.prompt.md'));
 assert.ok(g.files.some(f=>f.path==='.github/instructions/my-app-components.instructions.md'));
 const orch=g.files.find(f=>f.path==='.github/agents/my-app-orchestrator.agent.md');
 assert.deepEqual(fm(orch.content).agents.sort(),names(g).filter(n=>n!=='my-app-orchestrator'));
 assert.match(orch.content,/researcher →|researcher/);
 assert.doesNotMatch(orch.content,/defect-analyst|pr-reviewer/);
 const reviewer=g.files.find(f=>f.path==='.claude/agents/my-app-reviewer.md');
 assert.deepEqual(fm(reviewer.content).tools,['Read','Glob','Grep']);
 const implementer=g.files.find(f=>f.path==='.codex/agents/my-app-implementer.toml');
 assert.doesNotMatch(implementer.content,/sandbox_mode/);
 assert.match(g.files.find(f=>f.path==='.codex/agents/my-app-reviewer.toml').content,/sandbox_mode = "read-only"/);
 assert.ok(g.files.some(f=>f.path==='.claude/rules/my-app-components.md'&&/paths:/.test(f.content)));
 assert.ok(!g.files.some(f=>f.path==='.repoweave/semantic.json'));
 assert.ok(g.files.some(f=>f.path==='.repoweave/semantic.schema.json'));
 assert.match(g.files.find(f=>f.path==='.github/copilot-instructions.md').content,/\[unknown: /);
 assert.equal(validateFiles(g.files).ok,true);
});
test('design, tracker, Sonar and semantic domains add only those agents',async t=>{
 const r=app(t,{name:'demo'});put(r,'azure-pipelines.yml','steps: []\n');put(r,'figma.readme.md','figma');
 let g=generate(await scan(r),{targets:['copilot']});
 assert.ok(!names(g).includes('demo-integration-specialist'));
 assert.ok(names(g).includes('demo-design-reviewer'));
 assert.ok(!names(g).includes('demo-a11y-label-fixer'));
 put(r,'sonar-project.properties','sonar.projectKey=demo\n');
 g=generate(await scan(r),{targets:['copilot'],integrations:['jira']});
 assert.ok(names(g).includes('demo-integration-specialist'));
 assert.ok(names(g).includes('demo-a11y-label-fixer'));
 assert.ok(g.files.some(f=>f.path.includes('design-compliance')));
 const example=fs.readFileSync(path.join(__dirname,'../resources/semantic.example.json'),'utf8');
 put(r,'.repoweave/semantic.json',example);
 g=generate(await scan(r),{targets:['copilot'],root:r});
 assert.ok(names(g).includes('demo-feature-orders'));
 assert.equal(g.inputHashes['.repoweave/semantic.json'],hash(example));
 assert.ok(!g.files.some(f=>f.path==='.repoweave/semantic.json'));
 const owned=fs.readFileSync(path.join(r,'.repoweave/semantic.json'),'utf8');
 const planned=plan(r,g);assert.ok(!planned.entries.some(e=>e.path==='.repoweave/semantic.json'));
 apply(r,planned);
 assert.equal(fs.readFileSync(path.join(r,'.repoweave/semantic.json'),'utf8'),owned);
 const manifest=JSON.parse(fs.readFileSync(path.join(r,'.repoweave/manifest.json'),'utf8'));
 assert.equal(manifest.files['.repoweave/semantic.json'],undefined);
 put(r,'.repoweave/semantic.json',example.replace('"version": 1','"version": 1, "extra": true'));
 const broken=await scan(r);assert.throws(()=>generate(broken,{root:r}),/invalid/);
});
test('an earlier rw agent file is retained and not deleted',async t=>{
 const r=app(t,{name:'demo'});
 apply(r,plan(r,generate(await scan(r))));
 const manifestPath=path.join(r,'.repoweave/manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const rel='.github/agents/rw-reviewer.agent.md';
 fs.writeFileSync(path.join(r,rel),'previous reviewer\n');
 manifest.files[rel]={hash:hash('previous reviewer\n'),kind:'file',refs:[]};
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 const d=plan(r,generate(await scan(r)));
 assert.ok(d.retained.includes(rel));
 apply(r,d);
 assert.equal(fs.readFileSync(path.join(r,rel),'utf8'),'previous reviewer\n');
 assert.ok(!names({files:d.entries}).includes('rw-reviewer'));
});
test('shipped semantic example matches the schema',()=>{
 const example=JSON.parse(fs.readFileSync(path.join(__dirname,'../resources/semantic.example.json'),'utf8'));
 assert.equal(semantic.validate(example).version,1);
 assert.equal(semantic.schema().properties.version.enum[0],1);
});
test('spec files are not routes, and the root file stays compact for extra projects',async t=>{
 const r=temp(t);
 put(r,'package.json',{name:'web',dependencies:{'@angular/core':'^20.0.0','@angular/router':'^20.0.0'},devDependencies:{vitest:'^3.0.0'}});
 put(r,'src/app/app.routes.ts',"import {Routes} from '@angular/router';\nexport const routes: Routes = [{path:'home',loadComponent:()=>import('./home').then(m=>m.Home)}];");
 put(r,'src/app/app.routes.spec.ts',"export const stub = [{path:'only-in-spec',component: X}];");
 put(r,'src/app/home.ts','export class Home {}');
 put(r,'tools/package.json',{name:'web-tools',scripts:{start:'node index.js'}});
 put(r,'tools/src/index.ts','export const a = 1;');
 const profile=await scan(r),g=generate(profile,{targets:['copilot']});
 const text=g.files.find(f=>f.path==='.github/copilot-instructions.md').content;
 assert(!text.includes('only-in-spec'),'spec route leaked');
 assert(text.includes('## Additional project: `tools`'));
 assert(!/## Tech stack[\s\S]*## Tech stack/.test(text),'full template repeated for second project');
 assert(!text.includes('translation mechanism'),'translation rule without i18n');
 assert(!/Vitest(?: \(inferred; verify\))? with Vitest/.test(text),'runner repeated as framework');
});
