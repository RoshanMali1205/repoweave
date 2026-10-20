'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('extension commands complete analyze-preview-apply with a mocked VS Code API',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rw-editor-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'app',dependencies:{react:'^19'},scripts:{test:'vitest run'}}));
 fs.writeFileSync(path.join(root,'App.tsx'),'export function App(){return <div/>}');
 const commands=new Map(),errors=[],documents=[],trackerPicks=[],updates=[];
 const disposable={dispose(){}},bar={text:'',tooltip:'',show(){},dispose(){}};
 let html='',configValues={};
 const uri=f=>({fsPath:f,scheme:'file',toString:()=>f});
 const vscode={
  workspace:{isTrusted:true,workspaceFolders:[{name:'app',uri:uri(root)}],textDocuments:[],
   getConfiguration:()=>({get:(k,d)=>configValues[k]??d,update:async(k,v)=>{configValues[k]=v;updates.push([k,v]);}}),
   registerTextDocumentContentProvider:()=>disposable,onDidChangeConfiguration:()=>disposable,openTextDocument:async d=>{documents.push(d);return d;}},
  window:{createOutputChannel:()=>({...disposable,appendLine(){}}),createStatusBarItem:()=>bar,showTextDocument:async()=>{},showErrorMessage:m=>errors.push(m),showInformationMessage:async(m,o,a)=>a,
   showQuickPick:async(items,options)=>{
    const labels=(items||[]).map(i=>i.label);
    if(labels.includes('Connect Azure DevOps')){trackerPicks.push({labels,many:options?.canPickMany===true});return trackerPicks.length===1?items[0]:items.find(i=>i.id==='offline');}
    if(items.some(i=>i.id==='claude'))return items.filter(i=>i.id==='copilot'||i.id==='claude');
    return undefined;
   },
   withProgress:async(o,fn)=>fn({report(){}},{isCancellationRequested:false}),
   createWebviewPanel:()=>({webview:{set html(v){html=v},get html(){return html},onDidReceiveMessage(){}},onDidDispose(){},reveal(){},dispose(){}})},
  commands:{registerCommand:(name,fn)=>{commands.set(name,fn);return disposable;},executeCommand:async()=>{}},
  Uri:{file:uri,parse:uri},StatusBarAlignment:{Left:1},ProgressLocation:{Notification:1},ViewColumn:{One:1},ConfigurationTarget:{Workspace:1},
  env:{clipboard:{writeText:async()=>{}}}
 };
 const original=Module._load;Module._load=function(id,...a){return id==='vscode'?vscode:original.call(this,id,...a);};
 let extension;try{extension=require('../src/extension');}finally{Module._load=original;}
 extension.activate({subscriptions:[]});
 await commands.get('repoweave.open')();
 assert.match(bar.text,/Start/);
 assert.match(html,/RepoWeave/);
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/Connecting a tracker lets agents fetch the task/);
 assert.match(html,/RepoWeave itself does not sign in or call the tracker API/);
 assert.match(html,/Start here/);
 assert.match(html,/Generate harness \(all steps\)/);
 assert.match(html,/data-action="apply"[^>]*disabled/);
 await commands.get('repoweave.scan')();
 assert.match(bar.text,/Preview/);
 await commands.get('repoweave.preview')();
 assert.match(bar.text,/Apply/);
 assert.match(html,/app-orchestrator\.agent\.md/);
 assert.match(html,/data-action="diff"/);
 assert.match(html,/Apply preview/);
 assert.equal(fs.existsSync(path.join(root,'.repoweave')),false);
 await commands.get('repoweave.apply')();
 assert.equal(fs.existsSync(path.join(root,'.github/agents/app-orchestrator.agent.md')),true);
 assert.equal(errors.length,0);
 assert.match(bar.text,/Review/);
 assert.ok(documents.length>=2);
 fs.writeFileSync(path.join(root,'.github/agents/app-orchestrator.agent.md'),'hand edit\n');
 await commands.get('repoweave.preview')();
 assert.match(bar.text,/conflict/);
 assert.match(html,/Keep mine/);
 assert.match(html,/Use proposal/);
 assert.match(html,/Show \d+ unchanged/);
 assert.doesNotMatch(html,/\.github\/skills\//);
 fs.rmSync(path.join(root,'.github'),{recursive:true});fs.rmSync(path.join(root,'.repoweave'),{recursive:true});
 await commands.get('repoweave.run')();
 assert.equal(fs.existsSync(path.join(root,'.github/agents/app-orchestrator.agent.md')),true,'one-click run writes the harness');
 assert.equal(errors.length,0);
 await commands.get('repoweave.validate')();
 assert.equal(documents.at(-1).language,'markdown');
 assert.match(String(documents.at(-1).content),/Harness validation/);
 await commands.get('repoweave.integrations')();
 assert.deepEqual(trackerPicks[0].labels,['Connect Azure DevOps','Connect Jira','Continue without a tracker (pasted or local requirements)']);
 assert.equal(trackerPicks[0].many,false);
 assert.match(html,/Azure DevOps/);
 await commands.get('repoweave.preview')();
 assert.ok(documents.some(d=>String(d.content).includes('app-integration-specialist')));
 await commands.get('repoweave.integrations')();
 assert.match(html,/pasted or local requirements/);
 await commands.get('repoweave.preview')();
 const summaries=documents.filter(d=>String(d.content).includes('# Proposed RepoWeave harness'));
 assert.ok(!summaries.at(-1).content.includes('integration-specialist'));
 await commands.get('repoweave.targets')();
 assert.deepEqual(updates.at(-1),['targets',['copilot','claude']]);
 await commands.get('repoweave.preview')();
 assert.ok(documents.some(d=>String(d.content).includes('.claude/agents/app-orchestrator.md')));
 assert.match(html,/Claude Code/);
 assert.match(html,/GitHub Copilot/);
 const dirty={isDirty:true,uri:{fsPath:path.join(root,'App.tsx'),scheme:'file'},save:async function(){this.isDirty=false;return true;}};
 vscode.workspace.textDocuments.push(dirty);
 const beforeApply=fs.readFileSync(path.join(root,'.github/agents/app-orchestrator.agent.md'),'utf8');
 await commands.get('repoweave.apply')();
 assert.equal(dirty.isDirty,false);
 assert.equal(fs.readFileSync(path.join(root,'.github/agents/app-orchestrator.agent.md'),'utf8'),beforeApply);
 assert.match(html,/Saved the overlapping editors/);
 vscode.workspace.textDocuments.pop();
 fs.writeFileSync(path.join(root,'.repoweave/semantic.json'),'{"domains":[]}\n');
 fs.writeFileSync(path.join(root,'.github/agents/app-orchestrator.agent.md'),'please keep\n');
 await commands.get('repoweave.remove')();
 assert.equal(fs.existsSync(path.join(root,'.repoweave/manifest.json')),false);
 assert.equal(fs.readFileSync(path.join(root,'.repoweave/semantic.json'),'utf8'),'{"domains":[]}\n');
 assert.equal(fs.readFileSync(path.join(root,'.github/agents/app-orchestrator.agent.md'),'utf8'),'please keep\n');
 assert.match(documents.at(-1).content,/Harness removed/);
 html='STALE';
 vscode.workspace.workspaceFolders=[{name:'app',uri:uri(root)},{name:'other',uri:uri(root+'-other')}];
 await commands.get('repoweave.open')(uri(root));
 assert.notEqual(html,'STALE');
 assert.match(html,new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 vscode.workspace.isTrusted=false;
 await commands.get('repoweave.scan')();
 assert.ok(errors.some(e=>e.includes('Trust')));
 extension.deactivate();
});
