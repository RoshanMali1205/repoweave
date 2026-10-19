'use strict';
const vscode=require('vscode');
const {scan}=require('./core/scanner');
const {generate,architecture}=require('./core/generator');
const {plan,apply,validateInstalled}=require('./core/writer');
const ai=require('./core/ai');
const {fs,path,hash}=require('./core/fs');
const sessions=new Map(),virtual=new Map();let studio,log,lastRoot,busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function workspace(){
 if(!vscode.workspace.isTrusted)throw Error('Trust this workspace before using RepoWeave.');
 const folders=vscode.workspace.workspaceFolders||[];if(!folders.length)throw Error('Open a project folder first.');
 const f=folders.length===1?folders[0]:await vscode.window.showQuickPick(folders.map(f=>({label:f.name,description:f.uri.fsPath,folder:f})),{placeHolder:'Choose the repository to analyze'}).then(v=>v?.folder);
 if(!f)return null;if(f.uri.scheme!=='file')throw Error('This version supports local or remote filesystem workspaces, not virtual workspaces.');lastRoot=f.uri.fsPath;return lastRoot;
}
function settings(root){const c=vscode.workspace.getConfiguration('repoweave',vscode.Uri.file(root));return {targets:c.get('targets',['copilot']),includeHooks:c.get('includeHooks',false),maxSourceFiles:c.get('maxSourceFiles',4000),prefix:c.get('agentPrefix',''),integrations:sessions.get(root)?.integrations||[]};}
async function document(content,title='RepoWeave',language='markdown'){const d=await vscode.workspace.openTextDocument({content,language});await vscode.window.showTextDocument(d,{preview:true});return d;}
function render(root){
 if(!studio)return;const s=sessions.get(root)||{},opts=root?settings(root):{};const nonce=hash(String(Math.random()));
 const trackerLabel=(opts.integrations||[]).filter(id=>id==='azure'||id==='jira').map(id=>id==='azure'?'Azure DevOps':'Jira').join(' and ')||'pasted or local requirements';
 studio.webview.html=`<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1"><style nonce="${nonce}">
 body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:26px;max-width:1100px;margin:auto;background:var(--vscode-editor-background)}h1{font-size:28px;margin-bottom:8px}p{line-height:1.6}.muted{color:var(--vscode-descriptionForeground)}.buttons{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}button{border:1px solid var(--vscode-button-border,transparent);padding:10px 14px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;border-radius:4px}button:focus{outline:2px solid var(--vscode-focusBorder)}table{border-collapse:collapse;width:100%;margin-top:18px}td,th{text-align:left;padding:12px;border-bottom:1px solid var(--vscode-panel-border)}.pill{padding:6px 10px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;display:inline-block;margin:4px}.card{border:1px solid var(--vscode-panel-border);padding:18px;border-radius:6px;margin:18px 0}code{overflow-wrap:anywhere}ul{line-height:1.7}
 </style></head><body><p class="muted">PROJECT CONTEXT · AGENTS · VERIFICATION</p><h1>RepoWeave</h1><p>Build an agent harness that follows your repository.</p><p class="muted">${esc(root||'Choose a repository to begin.')}</p>
 <div class="buttons"><button data-action="run">Generate harness (all steps)</button><button data-action="scan">1. Analyze</button><button data-action="preview">2. Preview files</button><button data-action="apply">3. Apply preview</button><button data-action="enrich">AI review selected files</button><button data-action="bootstrap">Copy architecture prompt</button><button data-action="integrations">Integrations</button><button data-action="validate">Validate</button></div>
 <p>${(opts.targets||[]).map(t=>'<span class="pill">'+esc(t)+'</span>').join('')} <span class="pill">Hooks ${opts.includeHooks?'requested':'off'}</span> <span class="pill">Tracker: ${esc(trackerLabel)}</span></p>
 <p>Connecting a tracker lets agents fetch the task. RepoWeave itself does not sign in or call the tracker API.</p>
 <section class="card"><h2>Repository evidence</h2>${s.profile?`<p>${s.profile.coverage.analyzedSourceFiles} / ${s.profile.coverage.eligibleSourceFiles} eligible source files analyzed · ${s.profile.projects.length} project roots · semantic review ${esc(s.profile.coverage.semanticReview)}</p><table><thead><tr><th>Project</th><th>Frameworks</th><th>Styles</th><th>Tests declared</th></tr></thead><tbody>${s.profile.projects.map(p=>`<tr><td>${esc(p.root)}</td><td>${esc(p.frameworks.map(f=>f.package+' '+(f.resolved||f.declared)).join(', '))}</td><td>${esc(Object.keys(p.styles).join(', '))}</td><td>${esc(p.tooling.tests.map(t=>t.package).join(', '))}</td></tr>`).join('')}</tbody></table>`:'<p>Analyze reads configuration and source syntax. It never executes project scripts.</p>'}</section>
 <section class="card"><h2>Generation</h2>${s.plan?`<p>${s.plan.entries.filter(e=>e.status==='create').length} new · ${s.plan.entries.filter(e=>e.status==='update').length} updates · ${s.plan.entries.filter(e=>e.status==='conflict').length} conflicts · ${s.plan.retained.length} retained from prior targets</p>`:'<p>Preview creates the proposed agents, skills, instructions, prompts and harness in memory. Apply writes only that reviewed plan.</p>'}<p class="muted">Existing rules and modified generated files are protected. Generation uses deterministic templates; AI observations remain separately labeled suggestions.</p></section>
 <p class="muted">${s.result?esc(s.result):'Use the generated architecture-review prompt to verify business flows and conventions in your coding host.'}</p>
 <script nonce="${nonce}">const vscode=acquireVsCodeApi();for(const b of document.querySelectorAll('button'))b.addEventListener('click',()=>vscode.postMessage({action:b.dataset.action}));</script></body></html>`;
}
async function analyze(root){
 const opts=settings(root),previous=sessions.get(root)||{};
 const profile=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'RepoWeave: analyzing repository',cancellable:true},(p,t)=>scan(root,{...opts,cancel:()=>t.isCancellationRequested,progress:message=>p.report({message})}));
 sessions.set(root,{...previous,profile,plan:null,analysis:null,result:'Static analysis complete. Review architecture evidence before generation.'});render(root);return profile;
}
async function ensure(root){return sessions.get(root)?.profile||analyze(root);}
function previewSummary(p){return '# Proposed RepoWeave harness\n\nReview files before Apply. Conflicts must be resolved without overwriting existing content.\n\n| Action | File | Detail |\n|---|---|---|\n'+p.entries.map(e=>'| '+e.status+' | '+e.path+' | '+(e.reason||'')+' |').join('\n')+'\n\nRetained prior outputs: '+(p.retained.join(', ')||'none')+'\n';}
async function preview(root){
 const profile=await ensure(root),s=sessions.get(root);const generated=generate(profile,{...settings(root),analysis:s.analysis,root});s.plan=plan(root,generated);render(root);
 await document(previewSummary(s.plan));
 const item=await vscode.window.showQuickPick(s.plan.entries.map((e,i)=>({label:e.status+' · '+e.path,description:e.reason,index:i})),{placeHolder:'Inspect a proposed file diff, or Escape to finish preview'});
 if(item){const e=s.plan.entries[item.index],id=hash(root+e.path+Date.now());const before=vscode.Uri.parse('repoweave-preview:/'+id+'/before/'+path.basename(e.path)),after=vscode.Uri.parse('repoweave-preview:/'+id+'/after/'+path.basename(e.path));virtual.set(before.toString(),e.before||'');virtual.set(after.toString(),e.content);await vscode.commands.executeCommand('vscode.diff',before,after,e.path+' — proposed');}
}
async function applyPreview(root){
 const s=sessions.get(root);if(!s?.plan)throw Error('Preview the harness first.');
 if(s.plan.entries.some(e=>e.status==='conflict')){await document(previewSummary(s.plan));throw Error('Preview contains conflicts. Preserve those files and merge intentionally before retrying.');}
 const n=s.plan.entries.filter(e=>['create','update'].includes(e.status)).length;
 const answer=await vscode.window.showInformationMessage(`Apply the ${n} previewed harness file changes to ${root}?`,{modal:true,detail:'Application source and dependencies are not changed. Optional hook files are included only if shown in your preview.'},'Apply');if(answer!=='Apply')return;
 // Refuse a dirty buffer that would later overwrite a generated file or invalidate scan evidence.
 const affected=new Set([...Object.keys(s.plan.inputHashes),...s.plan.entries.map(e=>e.path)]);
 const dirty=vscode.workspace.textDocuments.some(d=>d.isDirty&&affected.has(path.relative(root,d.uri.fsPath).split(path.sep).join('/')));if(dirty)throw Error('Save or discard affected editor buffers, then analyze and preview again.');
 const result=apply(root,s.plan);s.plan=null;s.result=`Applied ${result.changed} files. Use the harness-builder agent to write .repoweave/semantic.json, then preview again.`;render(root);vscode.window.showInformationMessage(s.result);log.appendLine(JSON.stringify(result));
}
// One-click flow: analyze, build the plan, show it, ask once, apply, then validate. Conflicts or a cancelled confirmation stop it before any write.
async function runAll(root){
 const profile=await analyze(root),s=sessions.get(root);
 s.plan=plan(root,generate(profile,{...settings(root),analysis:s.analysis,root}));render(root);
 await document(previewSummary(s.plan));
 await applyPreview(root);
 if(sessions.get(root).plan)return;
 const v=validateInstalled(root);
 vscode.window.showInformationMessage(v.ok?`RepoWeave: harness generated and validated (${v.files} files).`:'RepoWeave: harness written but validation reported errors. See the RepoWeave output.');
 if(!v.ok)log.appendLine(JSON.stringify(v));
}
async function enrich(root){
 const profile=await ensure(root);
 const eligible=profile.inventory.filter(f=>/\.(ts|tsx|js|jsx|mjs|cjs|html|scss|less|css|json|md)$/.test(f)&&!f.endsWith('package-lock.json')&&!f.startsWith('.repoweave/'));
 const picks=await vscode.window.showQuickPick(eligible.map(f=>({label:f})),{canPickMany:true,placeHolder:'Select representative files to send for AI architecture review. No files are sent until you confirm.'});if(!picks?.length)return;
 const selection=picks.map(p=>p.label),ctx=ai.context(root,profile,selection);
 await document(ctx.inputs.map(i=>'FILE: '+i.path+'\n\n'+i.text).join('\n\n-----\n\n'),'AI context','plaintext');
 const answer=await vscode.window.showInformationMessage(`Send these ${selection.length} files (${ctx.characters} characters, with heuristic redaction) to a selected VS Code language model?`,{modal:true,detail:'Review the opened context. Redaction is not a guarantee that every sensitive value is removed. No AI request is made if you cancel.'},'Choose model');if(answer!=='Choose model')return;
 const models=await vscode.lm.selectChatModels();if(!models.length)throw Error('No VS Code language models are available. Use Copy Architecture Review Prompt in your coding host.');
 const chosen=await vscode.window.showQuickPick(models.map(m=>({label:m.name,description:m.vendor+' / '+m.id,model:m})),{placeHolder:'Choose the model for this review'});if(!chosen)return;
 const messages=[vscode.LanguageModelChatMessage.User(ai.prompt(ctx))];
 const response=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'RepoWeave: reviewing selected files',cancellable:true},async(p,t)=>{
  const count=await chosen.model.countTokens(messages[0],t);if(count>chosen.model.maxInputTokens*0.7)throw Error('Context is too large for this model. Select fewer files.');
  const stream=await chosen.model.sendRequest(messages,{},t);let output='';for await(const part of stream.text){output+=part;if(output.length>100000)throw Error('AI response exceeds review budget');}return ai.parseResponse(output,selection);
 });
 const s=sessions.get(root);s.analysis=response;s.plan=null;s.result='AI observations ready for preview. They are suggestions, not verified project rules.';render(root);await document(JSON.stringify(response,null,2),'AI review','json');
}
async function integrations(root){
 const s=sessions.get(root)||{};
 const picked=await vscode.window.showQuickPick([
  {label:'Connect Azure DevOps',id:'azure',description:'Lets agents fetch the work item before planning. RepoWeave does not sign in or call the tracker API.'},
  {label:'Connect Jira',id:'jira',description:'Lets agents fetch the work item before planning. RepoWeave does not sign in or call the tracker API.'},
  {label:'Continue without a tracker (pasted or local requirements)',id:'offline',description:'Planning uses pasted requirements or local files. RepoWeave does not sign in or call the tracker API.'}
 ],{canPickMany:false,placeHolder:'Connect Azure DevOps or Jira so agents can fetch the task, or continue from pasted or local requirements. RepoWeave does not sign in or call the tracker API.'});
 if(!picked)return;
 // Figma stays a CLI or earlier-session preference. This prompt records only the tracker choice.
 const kept=(s.integrations||[]).filter(id=>id==='figma');
 s.integrations=picked.id==='offline'?kept:[...kept,picked.id];
 s.plan=null;
 s.result=picked.id==='offline'
  ?'Continuing without a tracker. Agents use pasted or local requirements. RepoWeave does not sign in or call the tracker API.'
  :(picked.id==='azure'?'Azure DevOps':'Jira')+' selected so agents can fetch the task. RepoWeave does not sign in or call the tracker API. This records a choice for the next preview.';
 sessions.set(root,s);render(root);await document(fs.readFileSync(path.join(__dirname,'../resources/integrations.md'),'utf8'));
}
async function dispatch(action,root){
 if(busy){vscode.window.showInformationMessage('RepoWeave is completing another operation.');return;}
 busy=true;try{
  root=root||await workspace();if(!root)return;if(!vscode.workspace.isTrusted)throw Error('Workspace must be trusted.');
  if(action==='open'){if(!studio){studio=vscode.window.createWebviewPanel('repoweave','RepoWeave',vscode.ViewColumn.One,{enableScripts:true,retainContextWhenHidden:true,localResourceRoots:[]});studio.onDidDispose(()=>studio=undefined);studio.webview.onDidReceiveMessage(msg=>{if(['run','scan','preview','apply','enrich','bootstrap','integrations','validate'].includes(msg?.action))dispatch(msg.action,lastRoot).catch(report);});}lastRoot=root;render(root);studio.reveal();}
  else if(action==='run')await runAll(root);
  else if(action==='scan'){const p=await analyze(root);await document(architecture(p));}
  else if(action==='preview')await preview(root);
  else if(action==='apply')await applyPreview(root);
  else if(action==='enrich')await enrich(root);
  else if(action==='integrations')await integrations(root);
  else if(action==='bootstrap'){await vscode.env.clipboard.writeText('Read .repoweave/BOOTSTRAP.md and complete the architecture review for this repository. Use the harness-builder agent where available. Record verified facts in .repoweave/semantic.json, then rerun RepoWeave Preview. Inspect all first-party project areas and preserve existing instructions.');vscode.window.showInformationMessage('Architecture review prompt copied. Generate and apply the harness before using it.');}
  else if(action==='validate')await document(JSON.stringify(validateInstalled(root),null,2),'Validation','json');
 }finally{busy=false;}
}
function report(e){log?.appendLine(e?.message||String(e));vscode.window.showErrorMessage('RepoWeave: '+(e?.message||e));}
function activate(context){
 log=vscode.window.createOutputChannel('RepoWeave');context.subscriptions.push(log);
 context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('repoweave-preview',{provideTextDocumentContent:uri=>virtual.get(uri.toString())||''}));
 for(const action of ['open','run','scan','preview','apply','enrich','bootstrap','validate','integrations'])context.subscriptions.push(vscode.commands.registerCommand('repoweave.'+action,()=>dispatch(action).catch(report)));
 context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('repoweave')){for(const s of sessions.values())s.plan=null;if(lastRoot)render(lastRoot);}}));
 const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,20);status.text='$(hubot) RepoWeave';status.command='repoweave.open';status.tooltip='Open Agent Harness Studio';status.show();context.subscriptions.push(status);
}
function deactivate(){studio?.dispose();sessions.clear();virtual.clear();}
module.exports={activate,deactivate};
