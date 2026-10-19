'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),os=require('node:os');
const YAML=require('yaml');
const {fs,path}=require('../src/core/fs');const {scan}=require('../src/core/scanner');const {render,placeholders,missing,projectContext}=require('../src/core/template');
const dir=path.resolve(__dirname,'../resources/templates');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.md')&&e.name!=='CONTRACT.md'?[path.join(d,e.name)]:[]);
function temp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'repoweave-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function put(r,p,v){fs.mkdirSync(path.dirname(path.join(r,p)),{recursive:true});fs.writeFileSync(path.join(r,p),typeof v==='string'?v:JSON.stringify(v));}
test('render inserts values, lists, booleans and an explicit unknown note',()=>{
 const ctx={project:{name:'app',libs:['a','b'],none:[],strict:true,count:0}};
 assert.equal(render('{{project.name}} | {{ project.libs }} | {{project.none}} | {{project.strict}} | {{project.count}}',ctx),'app | a, b | none detected | yes | 0');
 assert.equal(render('Runner: {{project.testing.runner}}',ctx),'Runner: [unknown: project.testing.runner — verify in semantic review]');
 assert.deepEqual(missing('{{project.name}} {{project.x}}{{#if semantic.y}}{{/if}}',ctx),['project.x','semantic.y']);
});
test('render leaves non-namespaced braces such as Angular interpolation and JSX styles literal',()=>{
 const t="{{ translationData.lblSave ?? 'Save' }} <div style={{color:'red'}}/> {{title}}";
 assert.equal(render(t,{}),t);
});
test('conditionals nest, support else and drop standalone tag lines',()=>{
 const t='a\n{{#if project.on}}\nyes\n{{#if project.off}}\nno\n{{else}}\ninner-else\n{{/if}}\n{{else}}\nouter-else\n{{/if}}\nz\n';
 assert.equal(render(t,{project:{on:true,off:[]}}),'a\nyes\ninner-else\nz\n');
 assert.equal(render(t,{project:{on:0}}),'a\nouter-else\nz\n');
 assert.equal(render('x {{! author note }}y',{}),'x y');
});
test('template errors are reported rather than guessed',()=>{
 assert.throws(()=>render('{{#if project.a}}x',{}),/Unclosed/);
 assert.throws(()=>render('x{{/if}}',{}),/Unexpected/);
 assert.throws(()=>render('{{#if project.a}}{{else}}{{else}}{{/if}}',{}),/Unexpected \{\{else\}\}/);
 assert.throws(()=>render("{{project.a ?? 'b'}}",{}),/Invalid placeholder/);
 assert.throws(()=>render('{{project.obj}}',{project:{obj:{a:1}}}),/non-scalar/);
});
test('render never evaluates code or reaches prototypes',()=>{
 assert.equal(render('{{project.constructor}}{{project.__proto__}}',{project:{}}),'[unknown: project.constructor — verify in semantic review][unknown: project.__proto__ — verify in semantic review]');
 assert.equal(render('{{project.v}}',{project:{v:'{{project.secret}} ${process.exit(1)}'},secret:'s'}),'{{project.secret}} ${process.exit(1)}');
 assert.equal(render('${1+1} {{#if project.x}}a{{/if}}',{}),'${1+1} ');
 const src=fs.readFileSync(path.resolve(__dirname,'../src/core/template.js'),'utf8');assert(!/\beval\s*\(|new\s+Function|require\(['"](?:vm|child_process)['"]\)/.test(src));
});
test('shipped templates parse, are documented in CONTRACT.md and render valid frontmatter',async t=>{
 const contract=fs.readFileSync(path.join(dir,'CONTRACT.md'),'utf8').split('\n');
 const documented=p=>{const parent=p.split('.').slice(0,-1).join('.')+'.',last=p.split('.').pop();return contract.some(l=>l.includes(p)||l.includes(parent)&&new RegExp('\\b'+last+'\\b').test(l));};
 const r=temp(t);put(r,'package.json',{name:'x',dependencies:{'@angular/core':'^20.0.0'}});put(r,'src/app/a.ts','export class A {}');
 const profile=await scan(r),ctx=projectContext(profile,profile.projects[0]),files=walk(dir);
 assert(files.length>=30);
 for(const f of files){
  const text=fs.readFileSync(f,'utf8'),name=path.relative(dir,f);
  for(const p of placeholders(text))assert(documented(p),name+' uses undocumented placeholder '+p);
  const out=render(text,name.includes('feature-domain')?{...ctx,semantic:{domain:{slug:'orders',name:'Orders'}}}:ctx);
  assert(!/\{\{\s*(?:#if|\/if|else|!)|\{\{\s*(?:repo|project|semantic)\./.test(out),name+' left template syntax');
  if(!name.startsWith('root'))assert.doesNotThrow(()=>YAML.parse(/^---\n([\s\S]*?)\n---\n/.exec(out)[1]),name+' frontmatter');
  assert(!/\b(daf|ct2|eviden|dafct|fleet|vehicle|helvetica|translationData|primeng)\b/i.test(text.replace(/\{\{![\s\S]*?\}\}/g,'')),name+' contains source-project specifics');
 }
});
test('project context maps scanner facts and marks weak evidence',async t=>{
 const r=temp(t);put(r,'package.json',{name:'x',dependencies:{'@angular/core':'^20.0.0'},devDependencies:{jest:'^29.0.0'},scripts:{test:'jest'}});put(r,'src/a.ts','export {}');
 const p=await scan(r),c=projectContext(p,p.projects[0],{i18n:{pattern:'Use the translate pipe.'}});
 assert.equal(c.project.testing.runner,'Jest (declared dependency only; verify)');assert.equal(c.project.framework.version,'^20.0.0');assert.equal(c.project.framework.versionSource,'declared range');
 assert.equal(c.project.commands.test,null);assert.equal(c.semantic.i18n.pattern,'Use the translate pipe.');
 assert.match(render('{{project.commands.test}}',c),/unknown: project\.commands\.test/);
});
