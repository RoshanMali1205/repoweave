'use strict';
const vscode=require('vscode');
const {scan}=require('./core/scanner');
const {generate,architecture}=require('./core/generator');
const {plan,apply,validateInstalled}=require('./core/writer');
const ai=require('./core/ai');
const {fs,path,hash}=require('./core/fs');
const sessions=new Map(),virtual=new Map();
let studio,log,statusItem,lastRoot,busy=false;
const HOSTS=[
 {id:'copilot',label:'GitHub Copilot',description:'Writes .github agents, skills, instructions, and prompts'},
 {id:'claude',label:'Claude Code',description:'Writes CLAUDE.md, .claude agents, and rules'},
 {id:'codex',label:'Codex',description:'Writes AGENTS.md and .codex agents'}
];
const ACTIONS=['run','scan','preview','apply','enrich','bootstrap','integrations','validate','targets','settings'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hostLabel=id=>(HOSTS.find(h=>h.id===id)||{}).label||id;
function counts(p){const c={create:0,update:0,conflict:0,unchanged:0};for(const e of p?.entries||[])if(c[e.status]!=null)c[e.status]++;return c;}
function canApply(s){const c=counts(s?.plan);return !!(s?.plan&&!c.conflict&&c.create+c.update>0);}
async function workspace(){
 if(!vscode.workspace.isTrusted)throw Error('Trust this workspace before using RepoWeave. Run Workspace: Manage Workspace Trust, then try again.');
 const folders=vscode.workspace.workspaceFolders||[];
 if(!folders.length)throw Error('Open a project folder first, then run RepoWeave: Open Harness Studio.');
 const f=folders.length===1?folders[0]:await vscode.window.showQuickPick(folders.map(f=>({label:f.name,description:f.uri.fsPath,folder:f})),{placeHolder:'Choose the repository to analyze'}).then(v=>v?.folder);
 if(!f)return null;
 if(f.uri.scheme!=='file')throw Error('This version supports local or remote filesystem workspaces, not virtual workspaces.');
 lastRoot=f.uri.fsPath;return lastRoot;
}
function settings(root){const c=vscode.workspace.getConfiguration('repoweave',vscode.Uri.file(root));return {targets:c.get('targets',['copilot']),includeHooks:c.get('includeHooks',false),maxSourceFiles:c.get('maxSourceFiles',4000),prefix:c.get('agentPrefix',''),integrations:sessions.get(root)?.integrations||[]};}
async function document(content,title='RepoWeave',language='markdown'){const d=await vscode.workspace.openTextDocument({content,language});await vscode.window.showTextDocument(d,{preview:true});return d;}
function statusHint(root){
 const s=root&&sessions.get(root);
 if(!s?.profile)return ['$(hubot) RepoWeave: Start','Open the studio. Next: generate a harness, or analyze the repository first.'];
 const c=counts(s.plan);
 if(s.plan&&c.conflict)return [`$(hubot) RepoWeave: ${c.conflict} conflict${c.conflict===1?'':'s'}`,'Open the studio and merge the listed files. Nothing is written until the conflicts are gone.'];
 if(s.plan&&c.create+c.update>0)return [`$(hubot) RepoWeave: Apply ${c.create+c.update}`,'Open the studio, review the proposed files, then apply.'];
 if(s.plan)return ['$(hubot) RepoWeave: Up to date','Open the studio. This preview matches the installed harness.'];
 if(s.applied&&!s.stale)return ['$(hubot) RepoWeave: Review','Open the studio and copy the architecture prompt into your coding assistant.'];
 return ['$(hubot) RepoWeave: Preview','Open the studio and preview the files before writing them.'];
}
function paintStatus(root){if(!statusItem)return;const [text,tip]=statusHint(root);statusItem.text=text;statusItem.tooltip=tip;}
function studioTitle(root){
 const s=root&&sessions.get(root);
 if(!s?.profile)return 'RepoWeave — Start';
 if(s.plan&&counts(s.plan).conflict)return 'RepoWeave — Conflicts';
 if(s.plan)return 'RepoWeave — Review preview';
 if(s.applied&&!s.stale)return 'RepoWeave — Architecture review';
 return 'RepoWeave — Preview';
}
function nextStep(s,opts){
 const hosts=(opts.targets||['copilot']).map(hostLabel).join(', ')||'the assistants you choose';
 const c=counts(s.plan);
 if(!s.profile)return {kicker:'Start here',title:'Generate a harness for this repository',body:`RepoWeave reads the project and proposes agent, skill, and instruction files for ${hosts}. Application source is not modified. You confirm once before anything is written.`,action:'run',label:'Generate harness (all steps)',alt:'scan',altLabel:'1. Analyze only'};
 if(s.plan&&c.conflict)return {kicker:'Needs attention',title:`Merge ${c.conflict} conflicting file${c.conflict===1?'':'s'} by hand`,body:'RepoWeave will not overwrite those files. Open each one below, keep the edits you want, then preview again.',action:'preview',label:'Refresh preview'};
 if(s.plan&&c.create+c.update>0)return {kicker:'Review, then write',title:`Apply ${c.create+c.update} file change${c.create+c.update===1?'':'s'}`,body:`${c.create} new, ${c.update} updated, ${c.unchanged} unchanged. Click a file to compare the current copy with the proposal. Application source is not modified.`,action:'apply',label:'3. Apply preview',alt:'preview',altLabel:'Refresh preview'};
 if(s.plan)return {kicker:'Already up to date',title:'This preview matches the installed harness',body:'Nothing new to write. Copy the architecture prompt when you want your coding assistant to record project facts.',action:'bootstrap',label:'4. Copy architecture prompt',alt:'validate',altLabel:'Validate'};
 if(s.applied&&!s.stale)return {kicker:'Next',title:'Review the architecture in your coding assistant',body:`Paste the prompt into ${hosts}. The assistant should write .repoweave/semantic.json. Then preview again so feature agents follow those facts.`,action:'bootstrap',label:'4. Copy architecture prompt',alt:'validate',altLabel:'Validate installed harness'};
 const projects=s.profile.projects?.length||0,files=s.profile.coverage?.analyzedSourceFiles??0;
 return {kicker:'Next',title:'Preview the files before writing',body:`Analysis covered ${files} source file${files===1?'':'s'} across ${projects} project root${projects===1?'':'s'}. Preview lists every file RepoWeave would create or update.`,action:'preview',label:'2. Preview files',alt:'run',altLabel:'Generate harness (all steps)'};
}
function stepList(s){
 const items=[['1 Analyze',!!s.profile],['2 Preview',!!s.plan||!!(s.applied&&!s.stale)],['3 Apply',!!(s.applied&&!s.stale)],['4 Review',false]];
 let marked=false;
 return items.map(([name,done])=>{let cls=done?'done':'';if(!done&&!marked){cls='current';marked=true;}return `<li class="${cls}">${done?'✓ ':''}${esc(name)}</li>`;}).join('');
}
function evidence(s){
 if(!s.profile)return '<section class="card"><h2>Repository evidence</h2><p>Analyze reads configuration and source syntax. It never executes project scripts.</p></section>';
 const p=s.profile,omitted=p.coverage.omittedSourceFiles?.length||0,parseErrors=p.coverage.astParseErrors?.length||0,rules=p.existingInstructions?.length||0;
 const frameworks=[...new Set(p.projects.flatMap(pr=>(pr.frameworks||[]).map(f=>f.package)))];
 const review=p.coverage.semanticReview==='pending'?'not recorded yet':(p.coverage.semanticReview||'not recorded yet');
 const notes=[omitted?`${omitted} source files were left out of this scan.`:'',parseErrors?`${parseErrors} files had syntax notes.`:'',rules?`${rules} existing instruction file${rules===1?'':'s'} will be preserved.`:''].filter(Boolean).join(' ');
 const warn=frameworks.length?'': '<p>No Angular or React dependency was declared. A harness can still be generated, with less framework-specific guidance.</p>';
 return `<section class="card"><h2>Repository evidence</h2><p>${p.coverage.analyzedSourceFiles} / ${p.coverage.eligibleSourceFiles} eligible source files analyzed · ${p.projects.length} project roots · architecture review ${esc(review)}</p>${warn}${notes?`<p class="muted">${esc(notes)}</p>`:''}<table><thead><tr><th>Project</th><th>Frameworks</th><th>Styles</th><th>Tests declared</th></tr></thead><tbody>${p.projects.map(pr=>`<tr><td>${esc(pr.root)}</td><td>${esc((pr.frameworks||[]).map(f=>f.package+' '+(f.resolved||f.declared||'')).join(', '))}</td><td>${esc(Object.keys(pr.styles||{}).join(', '))}</td><td>${esc((pr.tooling?.tests||[]).map(t=>t.package).join(', '))}</td></tr>`).join('')}</tbody></table></section>`;
}
function fileTable(plan){
 if(!plan)return '';
 const order={conflict:0,create:1,update:2,unchanged:3};
 const rows=plan.entries.slice().sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||a.path.localeCompare(b.path));
 const retained=plan.retained?.length?`<p class="muted">Kept from earlier runs: ${plan.retained.map(esc).join(', ')}</p>`:'';
 return `<section class="card"><h2>Proposed files</h2><p class="muted">Click a path to open the before/after diff.</p><div class="files"><table><thead><tr><th>Action</th><th>File</th><th>Detail</th></tr></thead><tbody>${rows.map(e=>`<tr><td class="${esc(e.status)}">${esc(e.status)}</td><td><button type="button" class="link" data-action="diff" data-path="${esc(e.path)}">${esc(e.path)}</button></td><td>${esc(e.reason||'')}</td></tr>`).join('')}</tbody></table></div>${retained}</section>`;
}
function otherActions(s,next){
 const items=[['scan','Analyze'],['preview','Preview'],['apply','Apply'],['bootstrap','Copy architecture prompt'],['enrich','AI review of selected files'],['validate','Validate'],['settings','Settings']];
 return items.filter(([a])=>a!==next.action&&a!==next.alt).map(([action,label])=>{
  const disabled=action==='apply'&&!canApply(s);
  return `<button type="button" class="secondary" data-action="${action}"${disabled?' disabled':''}>${label}</button>`;
 }).join('');
}
function render(root){
 paintStatus(root);
 if(!studio)return;
 const s=sessions.get(root)||{},opts=root?settings(root):{targets:['copilot'],includeHooks:false};
 const nonce=hash(String(Math.random())),next=nextStep(s,opts);
 const trackerLabel=(opts.integrations||[]).filter(id=>id==='azure'||id==='jira').map(id=>id==='azure'?'Azure DevOps':'Jira').join(' and ')||'pasted or local requirements';
 const hosts=(opts.targets||[]).map(t=>`<span class="pill">${esc(hostLabel(t))}</span>`).join('')||'<span class="pill">No assistant selected</span>';
 studio.title=studioTitle(root);
 studio.webview.html=`<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1"><style nonce="${nonce}">
 body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;max-width:980px;margin:0 auto;line-height:1.5}h1{font-size:26px;font-weight:600;margin:0 0 8px}h2{font-size:16px;margin:0 0 8px}p{margin:8px 0}.muted{color:var(--vscode-descriptionForeground)}.kicker{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin:0}.next{border:1px solid var(--vscode-focusBorder);background:var(--vscode-editor-inactiveSelectionBackground);padding:18px;border-radius:8px;margin:18px 0}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}button{font:inherit;border:1px solid transparent;border-radius:4px;padding:8px 12px;cursor:pointer;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:10px 16px}button.link{background:transparent;color:var(--vscode-textLink-foreground);padding:0;border:none;text-align:left}button.link:hover{text-decoration:underline}button:focus{outline:2px solid var(--vscode-focusBorder);outline-offset:1px}button:disabled{opacity:.45;cursor:default}.steps{display:flex;gap:8px;list-style:none;padding:0;margin:12px 0;flex-wrap:wrap}.steps li{border:1px solid var(--vscode-panel-border);border-radius:99px;padding:4px 10px;color:var(--vscode-descriptionForeground)}.steps .current{border-color:var(--vscode-focusBorder);color:var(--vscode-foreground);font-weight:600}.steps .done{color:var(--vscode-testing-iconPassed,var(--vscode-foreground))}.pill{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:99px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground)}.card{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:16px;margin:16px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px 10px;border-bottom:1px solid var(--vscode-panel-border);vertical-align:top}.files{max-height:420px;overflow:auto}.conflict{color:var(--vscode-errorForeground);font-weight:600}.create{color:var(--vscode-gitDecoration-addedResourceForeground)}.update{color:var(--vscode-gitDecoration-modifiedResourceForeground)}code,button.link{overflow-wrap:anywhere}
 </style></head><body>
 <p class="muted">Agents · Skills · Instructions</p><h1>RepoWeave</h1><p>Build an agent harness that follows your repository.</p><p class="muted">${esc(root||'Choose a repository to begin.')}</p>
 <ol class="steps" aria-label="Harness steps">${stepList(s)}</ol>
 <section class="next"><p class="kicker">${esc(next.kicker)}</p><h2>${esc(next.title)}</h2><p>${esc(next.body)}</p><div class="buttons"><button type="button" class="primary" data-action="${next.action}">${esc(next.label)}</button>${next.alt?`<button type="button" class="secondary" data-action="${next.alt}">${esc(next.altLabel)}</button>`:''}</div></section>
 <p class="hosts">${hosts}<span class="pill">Hooks ${opts.includeHooks?'on':'off'}</span> <button type="button" class="secondary" data-action="targets">Change assistants</button></p>
 <p class="muted">Agent names use a prefix from the package name. Change hosts here. Hooks and the prefix are in Settings.</p>
 <p><span class="pill">Tracker: ${esc(trackerLabel)}</span> <button type="button" class="secondary" data-action="integrations">Change tracker</button></p>
 <p>Connecting a tracker lets agents fetch the task. RepoWeave itself does not sign in or call the tracker API.</p>
 ${evidence(s)}
 ${fileTable(s.plan)}
 <section class="card"><h2>Other actions</h2><p class="muted">These stay available at every step. Apply stays off until a preview has changes and no conflicts.</p><div class="buttons">${otherActions(s,next)}</div></section>
 <p class="muted">${s.result?esc(s.result):'The status bar shows the same next step when this panel is closed.'}</p>
 <script nonce="${nonce}">const vscode=acquireVsCodeApi();for(const b of document.querySelectorAll('button'))b.addEventListener('click',()=>{if(b.disabled)return;vscode.postMessage({action:b.dataset.action,path:b.dataset.path||''});});</script>
 </body></html>`;
}
function folderFrom(resource){
 if(!resource||resource.scheme!=='file'||!resource.fsPath)return null;
 const folders=vscode.workspace.workspaceFolders||[];
 const match=folders.find(f=>f.uri.scheme==='file'&&(resource.fsPath===f.uri.fsPath||resource.fsPath.startsWith(f.uri.fsPath+path.sep)));
 if(!match)return null;
 lastRoot=match.uri.fsPath;return match.uri.fsPath;
}
function ensureStudio(){
 if(studio)return studio;
 studio=vscode.window.createWebviewPanel('repoweave','RepoWeave',vscode.ViewColumn.One,{enableScripts:true,retainContextWhenHidden:true,localResourceRoots:[]});
 studio.onDidDispose(()=>{studio=undefined;});
 studio.webview.onDidReceiveMessage(msg=>{
  const action=msg?.action;
  if(action==='diff'){if(lastRoot)openDiff(lastRoot,msg.path).catch(report);return;}
  if(ACTIONS.includes(action))dispatch(action,lastRoot).catch(report);
 });
 return studio;
}
function revealStudio(root){ensureStudio();lastRoot=root;render(root);studio.reveal();}
async function openDiff(root,rel){
 const e=sessions.get(root)?.plan?.entries.find(x=>x.path===rel);if(!e)return;
 const id=hash(root+'\0'+e.path+'\0'+hash(e.content)+'\0'+hash(e.before||''));
 const before=vscode.Uri.parse('repoweave-preview:/'+id+'/before/'+path.basename(e.path)),after=vscode.Uri.parse('repoweave-preview:/'+id+'/after/'+path.basename(e.path));
 virtual.set(before.toString(),e.before||'');virtual.set(after.toString(),e.content);
 await vscode.commands.executeCommand('vscode.diff',before,after,e.path+' — proposed');
}
async function analyze(root){
 const opts=settings(root),previous=sessions.get(root)||{};
 const profile=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'RepoWeave: analyzing repository',cancellable:true},(p,t)=>scan(root,{...opts,cancel:()=>t.isCancellationRequested,progress:message=>p.report({message})}));
 sessions.set(root,{...previous,profile,plan:null,analysis:null,stale:true,applied:false,result:'Analysis complete. Preview the files before writing them.'});
 render(root);return profile;
}
async function ensure(root){return sessions.get(root)?.profile||analyze(root);}
function previewSummary(p){
 const n=status=>p.entries.filter(e=>e.status===status).length;
 const conflicts=n('conflict');
 const lead=conflicts?`Next: merge ${conflicts} conflicting file${conflicts===1?'':'s'} by hand. Apply stays off until those conflicts are gone.`:`Next: return to RepoWeave and choose Apply preview. ${n('create')} new, ${n('update')} updates, ${n('unchanged')} unchanged.`;
 return '# Proposed RepoWeave harness\n\n'+lead+'\n\nReview files before Apply. Conflicts must be resolved without overwriting existing content.\n\nClick a file in the RepoWeave studio to open its before/after diff.\n\n| Action | File | Detail |\n|---|---|---|\n'+p.entries.map(e=>'| '+e.status+' | '+e.path+' | '+(e.reason||'')+' |').join('\n')+'\n\nRetained prior outputs: '+(p.retained.join(', ')||'none')+'\n';
}
async function preview(root){
 const profile=await ensure(root),s=sessions.get(root);
 s.plan=plan(root,generate(profile,{...settings(root),analysis:s.analysis,root}));s.stale=false;render(root);
 await document(previewSummary(s.plan));revealStudio(root);
}
async function copyBootstrap(root){
 await vscode.env.clipboard.writeText('Read .repoweave/BOOTSTRAP.md and complete the architecture review for this repository. Use the harness-builder agent where available. Record verified facts in .repoweave/semantic.json, then rerun RepoWeave Preview. Inspect all first-party project areas and preserve existing instructions.');
 const ready=fs.existsSync(path.join(root,'.repoweave','BOOTSTRAP.md'));
 vscode.window.showInformationMessage(ready?'Architecture review prompt copied. Paste it into your coding assistant. After it writes .repoweave/semantic.json, run Preview again.':'Architecture review prompt copied. Generate and apply the harness first so .repoweave/BOOTSTRAP.md exists, then paste the prompt.');
}
async function applyPreview(root,{offerReview=true}={}){
 const s=sessions.get(root);if(!s?.plan)throw Error('Preview the harness first. Choose Preview files in RepoWeave, then Apply.');
 if(s.plan.entries.some(e=>e.status==='conflict')){await document(previewSummary(s.plan));throw Error('Preview contains conflicts. RepoWeave did not write any files. Merge the listed files, then preview again.');}
 const n=s.plan.entries.filter(e=>['create','update'].includes(e.status)).length;
 if(!n){s.applied=true;s.stale=false;s.plan=null;s.result='Nothing to write. The preview matches the installed harness.';render(root);vscode.window.showInformationMessage(s.result);return;}
 const answer=await vscode.window.showInformationMessage(`Apply the ${n} previewed harness file changes to ${root}?`,{modal:true,detail:'Application source and dependencies are not changed. Optional hook files are included only if shown in your preview.'},'Apply');if(answer!=='Apply')return;
 const affected=new Set([...Object.keys(s.plan.inputHashes),...s.plan.entries.map(e=>e.path)]);
 const dirty=vscode.workspace.textDocuments.some(d=>d.isDirty&&affected.has(path.relative(root,d.uri.fsPath).split(path.sep).join('/')));if(dirty)throw Error('Save or discard affected editor buffers, then analyze and preview again.');
 const result=apply(root,s.plan);s.plan=null;s.applied=true;s.stale=false;s.result=`Applied ${result.changed} files. Copy the architecture prompt, then preview again after your assistant writes .repoweave/semantic.json.`;render(root);log.appendLine(JSON.stringify(result));
 if(offerReview){const follow=await vscode.window.showInformationMessage(s.result,'Copy architecture prompt');if(follow==='Copy architecture prompt')await copyBootstrap(root);}
 else vscode.window.showInformationMessage(s.result);
}
function validationReport(v){
 const lines=(v.errors||[]).map(e=>`- \`${e.path}\` — ${e.message}`);
 if(v.ok)return `# Harness validation\n\nPassed. ${v.files} installed files match the manifest, and their syntax and references check out.\n`;
 const title=v.files?`${lines.length} problem${lines.length===1?'':'s'} across ${v.files} tracked files.`:'No harness is installed yet.';
 return `# Harness validation\n\n${title}\n\n${lines.join('\n')}\n\nFix the listed files, or preview and apply again after you decide which edits to keep.\n`;
}
async function runAll(root){
 const profile=await analyze(root),s=sessions.get(root);
 s.plan=plan(root,generate(profile,{...settings(root),analysis:s.analysis,root}));s.stale=false;render(root);
 await document(previewSummary(s.plan));revealStudio(root);
 await applyPreview(root,{offerReview:false});
 if(sessions.get(root).plan)return;
 const v=validateInstalled(root);
 if(!v.ok){log.appendLine(JSON.stringify(v));await document(validationReport(v),'Validation');}
 const msg=v.ok?`RepoWeave: harness generated and validated (${v.files} files).`:'RepoWeave: harness written but validation reported errors.';
 const choice=await vscode.window.showInformationMessage(msg,v.ok?'Copy architecture prompt':'Show validation');
 if(choice==='Copy architecture prompt')await copyBootstrap(root);
 if(choice==='Show validation')await document(validationReport(v),'Validation');
 revealStudio(root);
}
async function enrich(root){
 const profile=await ensure(root);
 const eligible=profile.inventory.filter(f=>/\.(ts|tsx|js|jsx|mjs|cjs|html|scss|less|css|json|md)$/.test(f)&&!f.endsWith('package-lock.json')&&!f.startsWith('.repoweave/'));
 const picks=await vscode.window.showQuickPick(eligible.map(f=>({label:f})),{canPickMany:true,placeHolder:'Pick a few representative files. Nothing is sent until you confirm.'});if(!picks?.length)return;
 const selection=picks.map(p=>p.label),ctx=ai.context(root,profile,selection);
 await document(ctx.inputs.map(i=>'FILE: '+i.path+'\n\n'+i.text).join('\n\n-----\n\n'),'AI context','plaintext');
 const answer=await vscode.window.showInformationMessage(`Send these ${selection.length} files (${ctx.characters} characters, with heuristic redaction) to a selected VS Code language model?`,{modal:true,detail:'Review the opened context. Redaction is not a guarantee that every sensitive value is removed. No AI request is made if you cancel.'},'Choose model');if(answer!=='Choose model')return;
 const models=await vscode.lm.selectChatModels();if(!models.length)throw Error('No VS Code language models are available. Use Copy Architecture Review Prompt in your coding host instead.');
 const chosen=await vscode.window.showQuickPick(models.map(m=>({label:m.name,description:m.vendor+' / '+m.id,model:m})),{placeHolder:'Choose the model for this review'});if(!chosen)return;
 const messages=[vscode.LanguageModelChatMessage.User(ai.prompt(ctx))];
 const response=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'RepoWeave: reviewing selected files',cancellable:true},async(p,t)=>{
  const count=await chosen.model.countTokens(messages[0],t);if(count>chosen.model.maxInputTokens*0.7)throw Error('Context is too large for this model. Select fewer files.');
  const stream=await chosen.model.sendRequest(messages,{},t);let output='';for await(const part of stream.text){output+=part;if(output.length>100000)throw Error('AI response exceeds review budget');}return ai.parseResponse(output,selection);
 });
 const s=sessions.get(root);s.analysis=response;s.plan=null;s.stale=true;s.result='AI notes are ready. Preview again to include them. They are suggestions, not project rules.';render(root);await document(JSON.stringify(response,null,2),'AI review','json');
}
async function integrations(root){
 const s=sessions.get(root)||{};
 const picked=await vscode.window.showQuickPick([
  {label:'Connect Azure DevOps',id:'azure',description:'Agents fetch the Azure Boards work item before planning.'},
  {label:'Connect Jira',id:'jira',description:'Agents fetch the Jira issue before planning.'},
  {label:'Continue without a tracker (pasted or local requirements)',id:'offline',description:'Planning uses text you paste or files already in the repo.'}
 ],{canPickMany:false,placeHolder:'How should agents get the task? RepoWeave records the choice and does not call the tracker.'});
 if(!picked)return;
 const kept=(s.integrations||[]).filter(id=>id==='figma');
 s.integrations=picked.id==='offline'?kept:[...kept,picked.id];
 s.plan=null;s.stale=true;
 s.result=picked.id==='offline'
  ?'No tracker selected. Agents will use requirements you paste or files in the repo. Preview again to refresh the harness.'
  :(picked.id==='azure'?'Azure DevOps':'Jira')+' selected. Preview again so the harness includes the tracker specialist. RepoWeave does not sign in or call the tracker API.';
 sessions.set(root,s);render(root);await document(fs.readFileSync(path.join(__dirname,'../resources/integrations.md'),'utf8'));
}
async function chooseTargets(root){
 const current=new Set(settings(root).targets||[]);
 const picked=await vscode.window.showQuickPick(HOSTS.map(h=>({...h,picked:current.has(h.id)})),{canPickMany:true,placeHolder:'Choose which assistants receive harness files. Select at least one.'});
 if(!picked?.length)return;
 const targets=HOSTS.map(h=>h.id).filter(id=>picked.some(p=>p.id===id));
 await vscode.workspace.getConfiguration('repoweave',vscode.Uri.file(root)).update('targets',targets,vscode.ConfigurationTarget.Workspace);
 const s=sessions.get(root)||{};s.plan=null;s.stale=true;s.result=`Assistants updated to ${targets.map(hostLabel).join(', ')}. Preview again before applying.`;sessions.set(root,s);render(root);
}
async function dispatch(action,root){
 if(busy){vscode.window.showInformationMessage('RepoWeave is still working on the current step.');return;}
 busy=true;try{
  root=root||await workspace();if(!root)return;if(!vscode.workspace.isTrusted)throw Error('Trust this workspace before using RepoWeave.');
  if(action==='open')revealStudio(root);
  else if(action==='run')await runAll(root);
  else if(action==='scan'){const p=await analyze(root);await document(architecture(p));}
  else if(action==='preview')await preview(root);
  else if(action==='apply')await applyPreview(root);
  else if(action==='enrich')await enrich(root);
  else if(action==='integrations')await integrations(root);
  else if(action==='bootstrap')await copyBootstrap(root);
  else if(action==='validate')await document(validationReport(validateInstalled(root)),'Validation');
  else if(action==='targets')await chooseTargets(root);
  else if(action==='settings')await vscode.commands.executeCommand('workbench.action.openSettings','@ext:roshanmali.repoweave');
 }finally{busy=false;}
}
function report(e){log?.appendLine(e?.message||String(e));vscode.window.showErrorMessage('RepoWeave: '+(e?.message||e));}
function activate(context){
 log=vscode.window.createOutputChannel('RepoWeave');context.subscriptions.push(log);
 context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('repoweave-preview',{provideTextDocumentContent:uri=>virtual.get(uri.toString())||''}));
 for(const action of ['open',...ACTIONS])context.subscriptions.push(vscode.commands.registerCommand('repoweave.'+action,resource=>dispatch(action,folderFrom(resource)).catch(report)));
 context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('repoweave')){for(const s of sessions.values()){s.plan=null;s.stale=true;}if(lastRoot)render(lastRoot);}}));
 statusItem=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,20);statusItem.command='repoweave.open';statusItem.show();context.subscriptions.push(statusItem);paintStatus(lastRoot);
}
function deactivate(){studio?.dispose();studio=undefined;statusItem=undefined;sessions.clear();virtual.clear();}
module.exports={activate,deactivate};
