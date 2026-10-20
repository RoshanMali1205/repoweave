'use strict';
const {fs,path,hash}=require('./fs');
const YAML=require('yaml');
const {agentPrefix,slugify,isSafePrefix}=require('./prefix');
const {projectContext,renderTemplate}=require('./template');
const semantic=require('./semantic');
const resources=path.resolve(__dirname,'../../resources');
const templateRoot=path.join(resources,'templates');
const canonical=['.repoweave/profile.json','.repoweave/architecture.md','.repoweave/harness.md'];
const json=x=>JSON.stringify(x,null,2)+'\n';
const readRes=f=>fs.readFileSync(path.join(resources,f),'utf8');
const readTpl=f=>fs.readFileSync(path.join(templateRoot,f),'utf8').replace(/\r\n/g,'\n');
const cell=x=>String(x??'unknown').replace(/[\n\r|<>]/g,' ');
const links=(from,refs)=>'\n\n## Required context\n\n'+refs.map(r=>'- ['+r+']('+path.posix.relative(path.posix.dirname(from),r)+')').join('\n')+'\n';
const TARGETS=['copilot','claude','codex'];
const READ_ONLY=new Set(['researcher','reviewer','design-reviewer']);
const AGENTS=[
 {id:'orchestrator'},
 {id:'planner'},
 {id:'researcher'},
 {id:'implementer'},
 {id:'ui-specialist'},
 {id:'test-generator'},
 {id:'test-fixer'},
 {id:'reviewer'},
 {id:'harness-builder'},
 {id:'design-reviewer',when:'design'},
 {id:'integration-specialist',when:'tracker'},
 {id:'a11y-label-fixer',when:'sonar'}
];
const UI_INSTRUCTIONS=new Set(['components','templates','services']);
const CLAUDE_TOOL={read:['Read'],search:['Glob','Grep'],edit:['Edit','Write'],execute:['Bash'],web:['WebFetch'],agent:['Agent']};
function listDir(dir){return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();}
function splitFm(text){
 if(!text.startsWith('---\n'))return {meta:{},body:text};
 const j=text.indexOf('\n---\n',4);if(j<0)throw Error('Frontmatter not closed');
 return {meta:YAML.parse(text.slice(4,j))||{},body:text.slice(j+5)};
}
function joinFm(meta,body){return '---\n'+YAML.stringify(meta,{lineWidth:0})+'---\n\n'+String(body).trim()+'\n';}
function normalizeTargets(targets){
 const set=new Set(targets||['copilot']);
 const order=TARGETS.filter(t=>set.has(t));
 if(!order.length||[...set].some(t=>!TARGETS.includes(t)))throw Error('Select Copilot, Claude or Codex');
 return order;
}
function architecture(profile){
 let s='# Repository architecture evidence\n\nStatic analysis is an initial map. Business behavior, configuration expressions and team conventions need semantic review. Read existing project instructions before applying generated guidance.\n\n';
 s+='| Project root | Declared frameworks | Styles | Test packages | Source files analyzed |\n|---|---|---|---|---|\n';
 for(const p of profile.projects)s+=`| ${cell(p.root)} | ${p.frameworks.map(f=>cell(f.package+' '+(f.resolved||f.declared)+(f.resolved?' (lockfile)':' (range)'))).join(', ')||'unknown'} | ${Object.keys(p.styles).join(', ')||'unknown'} | ${p.tooling.tests.map(t=>t.package).join(', ')||'none detected'} | ${p.sourceFiles} |\n`;
 for(const p of profile.projects){s+=`\n## ${cell(p.root)}\n\nManifest: \`${cell(p.manifest)}\`. Package manager: ${cell(p.packageManager)}.\n\nAngular components: ${p.composition.value.standalone} standalone, ${p.composition.value.ngmodule} explicitly non-standalone or inferred from a resolved pre-19 version, ${p.composition.value.unknown} unresolved. Component flags do not prove declaration registration.\n\n`;
  const examples=[...p.bootstrap.map(e=>({file:e.file,detail:e.kind,line:e.line})),...p.modules.map(e=>({file:e.file,detail:e.symbol,line:e.line})),...p.services.map(e=>({file:e.file,detail:e.symbol+'; scope '+e.scope,line:e.line})),...p.lazyRoutes.map(e=>({file:e.file,detail:e.kind,line:e.line}))];
  s+='| Evidence file | Symbol or signal | Line |\n|---|---|---|\n'+examples.slice(0,40).map(e=>`| ${cell(e.file)} | ${cell(e.detail)} | ${e.line} |`).join('\n')+'\n';
  if(examples.length>40)s+='\nMore evidence is in profile.json.\n';
  const routes=p.routes,main=p.mainFiles;
  if(routes)s+=`\nRoutes (${cell(routes.confidence)}): ${routes.value?.count??0}. Evidence: ${(routes.evidence||[]).slice(0,8).map(cell).join(', ')||'none'}.\n`;
  if(main)s+=`Main files (${cell(main.confidence)}): entry ${(main.value?.entries||[]).map(cell).join(', ')||'none'}; app config ${(main.value?.appConfig||[]).map(cell).join(', ')||'none'}; root routes ${(main.value?.rootRoutes||[]).map(cell).join(', ')||'none'}; hubs ${(main.value?.hubs||[]).slice(0,5).map(h=>cell(h.file)+' ('+h.inDegree+')').join(', ')||'none'}.\n`;
  s+='\nCommands are descriptors, never executed by analysis:\n\n'+p.commands.map(c=>'- '+cell(c.argv?.join(' ')||'package manager unresolved; script '+c.name)+' — cwd `'+cell(c.cwd)+'`; source `'+cell(c.evidence)+'`; not run.').join('\n')+'\n';
 }
 s+='\n## Existing instructions\n\n'+(profile.existingInstructions.map(f=>'- `'+cell(f)+'`').join('\n')||'None detected.')+'\n';
 s+='\n## Coverage and unknowns\n\n'+`${profile.coverage.analyzedSourceFiles}/${profile.coverage.eligibleSourceFiles} eligible source files analyzed. ${profile.coverage.omittedSourceFiles.length} omitted. Semantic review: ${profile.coverage.semanticReview}.\n\n`+profile.unknowns.map(x=>'- '+x).join('\n')+'\n';return s;
}
function projectRules(p){
 let s=`# Rules for ${cell(p.root)}\n\nThese apply to source owned by this project; nested projects use their own profile. Observed patterns guide inspection and do not authorize migrations. Read local instructions and adjacent examples.\n\n`;
 if(p.frameworks.some(f=>f.package==='@angular/core'))s+='For Angular, distinguish bootstrap style, component composition and route loading. Inspect the target component metadata and its owning declarations/imports. Keep existing NgModule, standalone or mixed structure. Do not assume standalone makes a route lazy. Verify service provider scope and shared widget consumers before changes.\n\n';
 if(p.frameworks.some(f=>f.package==='react'))s+='For React, inspect the actual function/class, hook, provider and state conventions. Preserve hook ordering, effect cleanup and public props. Do not introduce a state library or memoization policy from package presence alone.\n\n';
 if(p.frameworks.some(f=>f.package==='next'))s+='For Next, inspect app/pages routing, server/client boundaries and data loading per route. A directory name does not prove every route uses server rendering.\n\n';
 s+='Style file types observed: '+(Object.keys(p.styles).join(', ')||'none')+'. Match the target file and its token/theme source. Account for overlays or portals rendered outside the component tree. Do not prescribe one global preprocessor in a mixed project.\n\n';
 s+='Test packages declared: '+(p.tooling.tests.map(t=>t.package).join(', ')||'none detected')+'. Read the actual runner configuration and nearby tests before choosing setup or arguments. Create missing tests separately from editing existing tests. Never replace meaningful assertions with weaker ones to obtain a pass.\n\n';
 s+='UI packages: '+(p.tooling.ui.map(t=>t.package).join(', ')||'none detected')+'. State packages: '+(p.tooling.state.map(t=>t.package).join(', ')||'none detected')+'. Their presence does not establish team precedence; follow local usage and explicit decisions.\n';return s;
}
function claudeTools(readOnly,listed){
 if(readOnly)return ['Read','Glob','Grep'];
 const out=[];const add=t=>{if(t&&!out.includes(t))out.push(t);};
 for(const t of listed||[])for(const c of CLAUDE_TOOL[t]||[])add(c);
 if(!out.length)['Read','Glob','Grep','Edit','Write','Bash'].forEach(add);
 return out;
}
function forCopilot(text,readOnly,agents){
 const {meta,body}=splitFm(text);
 let changed=false;
 if(readOnly&&Array.isArray(meta.tools)){const next=meta.tools.filter(t=>t!=='edit'&&t!=='execute');if(next.length!==meta.tools.length){meta.tools=next;changed=true;}}
 if(agents){meta.agents=agents;if(Array.isArray(meta.tools)&&!meta.tools.includes('agent'))meta.tools.push('agent');changed=true;}
 return changed?joinFm(meta,body):(text.endsWith('\n')?text:text+'\n');
}
function forClaude(text,readOnly,agents){
 const {meta,body}=splitFm(text);
 const tools=claudeTools(readOnly,meta.tools).map(t=>t==='Agent'&&agents?'Agent('+agents.join(', ')+')':t);
 return joinFm({name:meta.name,description:meta.description,tools:tools.join(', ')},body);
}
function forCodex(text,readOnly){
 const {meta,body}=splitFm(text);
 return 'name = '+JSON.stringify(meta.name)+'\ndescription = '+JSON.stringify(String(meta.description||''))+'\n'+(readOnly?'sandbox_mode = "read-only"\n':'')+'developer_instructions = '+JSON.stringify(body.trim()+'\n')+'\n';
}
function forClaudeRule(text){
 const {meta,body}=splitFm(text);
 const glob=String(meta.applyTo||'**/*');
 return joinFm({paths:[glob],description:meta.description},body);
}
function scopeGlob(text,root){
 if(!root||root==='.')return text;
 const {meta,body}=splitFm(text);
 if(!meta.applyTo)return text;
 const glob=String(meta.applyTo).trim();
 meta.applyTo=glob.startsWith(root+'/')?glob:root+'/'+glob.replace(/^\.\//,'');
 return joinFm(meta,body);
}
function agentFile(target,name){
 if(target==='copilot')return `.github/agents/${name}.agent.md`;
 if(target==='claude')return `.claude/agents/${name}.md`;
 return `.codex/agents/${name}.toml`;
}
function instructionFile(target,stem){
 return target==='copilot'?`.github/instructions/${stem}.instructions.md`:`.claude/rules/${stem}.md`;
}
function wantsInstruction(kind,project){
 if(!UI_INSTRUCTIONS.has(kind))return true;
 return project.frameworks.some(f=>f.package==='@angular/core'||f.package==='react');
}
function generate(profile,options={}){
 if(profile.schemaVersion!==1||!Array.isArray(profile.projects)||!profile.projects.length)throw Error('Invalid profile');
 const targets=normalizeTargets(options.targets);
 const prefix=agentPrefix(options.prefix,profile.name,profile.rootName);
 const integrations=[...new Set(options.integrations||[])].sort();
 if(integrations.some(i=>!['azure','jira','figma'].includes(i)))throw Error('Unknown integration');
 const hints=profile.integrations?.hints||{};
 const designOn=integrations.includes('figma')||!!hints.figma;
 const trackerOn=integrations.includes('azure')||integrations.includes('jira');
 const trackerName=[integrations.includes('azure')&&'Azure DevOps',integrations.includes('jira')&&'Jira'].filter(Boolean).join(' and ')||null;
 const sonarOn=profile.projects.some(p=>p.stack?.sonar?.value);
 const semanticDoc=options.semanticDocument!==undefined?options.semanticDocument:(options.root?semantic.load(options.root):null);
 const semCtx=semanticDoc?semantic.context(semanticDoc.data):{};
 const domains=(semCtx.domains||[]).filter(d=>isSafePrefix(d.slug));
 if(semanticDoc&&domains.length!==(semCtx.domains||[]).length)throw Error('Unsafe feature slug');
 const primary=[...profile.projects].sort((a,b)=>b.sourceFiles-a.sourceFiles||a.root.length-b.root.length||a.root.localeCompare(b.root))[0];
 const names=id=>prefix+'-'+id;
 const active=[...AGENTS.filter(a=>!a.when||(a.when==='design'&&designOn)||(a.when==='tracker'&&trackerOn)||(a.when==='sonar'&&sonarOn)),...domains.map(d=>({id:'feature-'+d.slug,domain:d,template:'feature-domain'}))];
 const featureNames=domains.map(d=>names('feature-'+d.slug));
 const specialist=[names('researcher'),names('harness-builder'),trackerOn&&names('integration-specialist'),sonarOn&&names('a11y-label-fixer')].filter(Boolean);
 const repoExtra={prefix,hasTracker:trackerOn,tracker:trackerOn?trackerName:null,hasDesignTool:designOn,designTool:designOn?'Figma':null,hasLabelFixer:sonarOn,specialistAgents:specialist.join(', '),featureAgents:featureNames};
 const contextFor=(project,domain)=>projectContext(profile,project,domain?{...semCtx,domain}:semCtx,repoExtra);
 const primaryCtx=contextFor(primary);
 const files=[];const add=(p,content,refs=[],kind='file')=>{if(p==='.repoweave/semantic.json'||p.includes('..')||p.includes('\\'))throw Error('Refusing generated path: '+p);files.push({path:p,content,refs,kind});};
 const inputHashes={...profile.inputHashes};
 if(semanticDoc)inputHashes[semantic.file]=semanticDoc.hash;
 add('.repoweave/profile.json',json(profile));
 add('.repoweave/architecture.md',architecture(profile));
 add('.repoweave/commands.json',json(profile.projects.flatMap(p=>p.commands)));
 for(const f of ['harness.md','scan-contract.md','BOOTSTRAP.md','integrations.md'])add('.repoweave/'+f,readRes(f));
 add('.repoweave/AUTHORING-STANDARD.md',renderTemplate(readTpl('root/AUTHORING-STANDARD.md'),primaryCtx));
 add('.repoweave/semantic.schema.json',json(semantic.schema()));
 add('.repoweave/semantic.example.json',readRes('semantic.example.json'));
 add('.repoweave/integration-status.json',json({requested:integrations,hints,configPaths:profile.integrations.configPaths,status:'Not verified. A requested tracker is a choice, not authenticated access. RepoWeave does not sign in or call the tracker API. Use the MCP onboarding skill in your coding host.'}));
 if(options.analysis){add('.repoweave/ai-observations.json',json(options.analysis));files.find(f=>f.path==='.repoweave/architecture.md').content+='\nAI review suggestions are in `.repoweave/ai-observations.json`; they remain unverified and must be checked against the cited source before becoming rules.\n';}
 const shared=targets.length>1;
 const skillBase=shared||targets[0]==='claude'?'.claude/skills':targets[0]==='codex'?'.agents/skills':'.github/skills';
 const actualBase=targets.includes('codex')&&targets.length>1?'.agents/skills':skillBase;
 const skillDirs=listDir(path.join(templateRoot,'skills')).filter(name=>name!=='design-compliance'||designOn);
 const skillPaths=[];
 for(const dir of skillDirs){
  const rendered=renderTemplate(readTpl('skills/'+dir+'/SKILL.md'),primaryCtx).trimEnd()+'\n';
  const name=splitFm(rendered).meta.name;
  if(name!==prefix+'-'+dir)throw Error('Skill name mismatch: '+(name||dir));
  const file=actualBase+'/'+name+'/SKILL.md';
  skillPaths.push(file);
  add(file,rendered.trimEnd()+links(file,canonical),canonical);
 }
 const rolePaths={};
 for(const t of targets)rolePaths[t]=active.map(a=>agentFile(t,names(a.id)));
 const descriptions=[];
 for(const t of targets){
  active.forEach((a,i)=>{
   const readOnly=READ_ONLY.has(a.id);
   const ctx=a.domain?contextFor(primary,a.domain):primaryCtx;
   const rendered=renderTemplate(readTpl('agents/'+(a.template||a.id)+'.agent.md'),ctx);
   const meta=splitFm(rendered).meta;
   if(meta.name!==names(a.id))throw Error('Agent name mismatch: '+meta.name);
   if(!descriptions[i])descriptions[i]=String(meta.description||'');
   const file=rolePaths[t][i];
   const refs=[...canonical];
   if(a.id==='orchestrator')refs.push(...rolePaths[t].filter(p=>p!==file));
   if(a.id==='harness-builder')refs.push('.repoweave/BOOTSTRAP.md','.repoweave/semantic.schema.json','.repoweave/semantic.example.json');
   let content=t==='codex'?forCodex(rendered,readOnly):t==='claude'?forClaude(rendered,readOnly,a.id==='orchestrator'?active.filter(x=>x!==a).map(x=>names(x.id)):null):forCopilot(rendered,readOnly,a.id==='orchestrator'?active.filter(x=>x!==a).map(x=>names(x.id)):null);
   if(t!=='codex')content=content.trimEnd()+links(file,refs);
   else content=content.replace(/developer_instructions = (".*")\n$/,(_,q)=>{const body=JSON.parse(q)+'\nRead '+refs.join(', ')+'.';return 'developer_instructions = '+JSON.stringify(body)+'\n';});
   add(file,content.endsWith('\n')?content:content+'\n',refs);
  });
 }
 const instructionProjects=profile.projects.filter(p=>p.sourceFiles);
 const scoped=instructionProjects.length?instructionProjects:[primary];
 const multiple=scoped.length>1;
 const usedSlugs=new Set();
 const instructionPaths=[];
 const kinds=fs.readdirSync(path.join(templateRoot,'instructions')).filter(f=>f.endsWith('.instructions.md')).sort();
 for(const project of scoped){
  let slug=slugify(project.root==='.'?project.name:project.root.split('/').filter(Boolean).pop())||project.id;
  if(usedSlugs.has(slug))slug=slug+'-'+project.id.slice(0,4);
  usedSlugs.add(slug);
  const stemFor=kind=>(!multiple||project===primary)?prefix+'-'+kind:prefix+'-'+slug+'-'+kind;
  const ctx=contextFor(project);
  for(const fileName of kinds){
   const kind=fileName.replace(/\.instructions\.md$/,'');
   if(!wantsInstruction(kind,project))continue;
   const stem=stemFor(kind);
   let rendered=scopeGlob(renderTemplate(readTpl('instructions/'+fileName),ctx),project.root);
   const rule='.repoweave/rules/'+project.id+'.md';
   for(const t of targets.filter(t=>t!=='codex')){
    const f=instructionFile(t,stem);
    const content=t==='claude'?forClaudeRule(rendered):rendered;
    const refs=[rule,...canonical];
    instructionPaths.push(f);
    add(f,content.trimEnd()+links(f,refs),refs);
   }
  }
 }
 for(const p of profile.projects.filter(p=>p.sourceFiles))add('.repoweave/rules/'+p.id+'.md',projectRules(p),canonical);
 const rulePaths=files.filter(f=>f.path.startsWith('.repoweave/rules/')).map(f=>f.path);
 // The primary project gets the full root template; other projects get a short factual section so unrelated stacks do not repeat it.
 const secondaryRoot=p=>{
  const fw=p.frameworks.map(f=>cell(f.package+' '+(f.resolved||f.declared))).join(', ');
  const cmds=p.commands.slice(0,8).map(c=>'| `'+cell(c.argv?c.argv.join(' '):'script: '+c.name)+'` | `'+cell(c.cwd||'.')+'` |');
  return '## Additional project: `'+cell(p.root)+'`\n\nManifest: `'+cell(p.manifest)+'`. '+p.sourceFiles+' source files'+(fw?'. Frameworks: '+fw:'')+'. Scoped rules: `.repoweave/rules/'+p.id+'.md`. Details that static analysis did not establish are left to the semantic review.'+(cmds.length?'\n\n| Command | Run from |\n|---|---|\n'+cmds.join('\n'):'');
 };
 const rootBody=scoped.map(p=>p===primary||scoped.length===1?renderTemplate(readTpl('root/project.instructions.md'),contextFor(p)).trim():secondaryRoot(p)).join('\n\n');
 for(const t of targets){
  const root=t==='copilot'?'.github/copilot-instructions.md':t==='claude'?'CLAUDE.md':'AGENTS.md';
  const refs=canonical.concat(['.repoweave/BOOTSTRAP.md','.repoweave/AUTHORING-STANDARD.md',...skillPaths]);
  add(root,'<!-- repoweave:start -->\n'+rootBody+links(root,refs)+'<!-- repoweave:end -->\n',refs,'block');
 }
 const catalog='.repoweave/catalog.md';
 const catalogBody='# Generated harness catalog\n\nPrefix: `'+prefix+'`.\n\n'+targets.map(t=>'## '+t+'\n\n'+rolePaths[t].map((p,i)=>'- '+p+' — '+cell(descriptions[i])).join('\n')).join('\n\n')+'\n\n## Project rules\n\n'+rulePaths.map(p=>'- '+p).join('\n')+'\n\n## Skills\n\n'+skillPaths.map(p=>'- '+p).join('\n')+'\n\n## Scoped instructions\n\n'+(instructionPaths.filter(p=>p.startsWith('.github/')).map(p=>'- '+p).join('\n')||'none')+'\n';
 add(catalog,catalogBody,Object.values(rolePaths).flat().concat(rulePaths,skillPaths,instructionPaths));
 files.find(f=>f.path==='.repoweave/architecture.md').content+=links('.repoweave/architecture.md',rulePaths);
 files.find(f=>f.path==='.repoweave/architecture.md').refs=rulePaths;
 const promptFiles=fs.readdirSync(path.join(templateRoot,'prompts')).filter(f=>f.endsWith('.prompt.md')).sort();
 for(const fileName of promptFiles){
  const id=fileName.replace(/\.prompt\.md$/,'');
  const rendered=renderTemplate(readTpl('prompts/'+fileName),primaryCtx);
  const body=splitFm(rendered).body.trim();
  const agent=String(splitFm(rendered).meta.agent||'');
  const plain='.repoweave/prompts/'+id+'.md';
  add(plain,body+'\n'+links(plain,canonical),canonical);
  if(targets.includes('copilot')){
   const ref=rolePaths.copilot.find(p=>p.endsWith('/'+agent+'.agent.md'));
   if(!ref)throw Error('Prompt agent is not generated: '+agent);
   const f='.github/prompts/'+prefix+'-'+id+'.prompt.md';
   add(f,rendered.trimEnd()+links(f,[ref,...canonical]),[ref,...canonical]);
  }
 }
 if(options.includeHooks){
  add('.repoweave/scripts/freshness.cjs',readRes('freshness.cjs'));
  const hook={type:'command',command:'node .repoweave/scripts/freshness.cjs',timeout:10};
  if(targets.includes('claude'))add('.claude/settings.json',json({hooks:{SessionStart:[{hooks:[hook]}]}}),['.repoweave/scripts/freshness.cjs'],'hook-settings');
  else if(targets.includes('copilot'))add('.github/hooks/repoweave.json',json({hooks:{SessionStart:[hook]}}),['.repoweave/scripts/freshness.cjs']);
 }
 add('.repoweave/SETUP.md',`# Harness setup\n\nTargets: ${targets.join(', ')}. Agent prefix: \`${prefix}\`.\n\nStart with ${prefix}-harness-builder. It writes \`.repoweave/semantic.json\` (schema: \`.repoweave/semantic.schema.json\`, example: \`.repoweave/semantic.example.json\`) and \`.repoweave/review-notes.md\`. RepoWeave never writes semantic.json. Rerun Preview, review the diff, then Apply. Delivery then starts with ${prefix}-orchestrator.\n\nSkills live in ${actualBase}. Multi-client discovery differs by host version. Where a client does not discover this shared skill directory, follow the skill paths linked from its root instructions; do not create duplicate names blindly.\n\nCopilot prompt files support Local agent compatibility. Use task skills or plain prompts for Agent Host sessions that do not load prompt files. Claude and Codex use skills and native agents. Reload the client when needed and verify its agent list.\n\nHooks: ${options.includeHooks?'a read-only SessionStart freshness script is emitted for Claude or Copilot when selected; it reads tracked configs and adds context. Codex hook configuration is deliberately not emitted because this adapter does not establish support.':'disabled; enable explicitly in preview options.'}\n\nConfigured MCP paths are hints. Open integrations.md for secure client-specific setup. RepoWeave does not sign in or call the tracker API, and a recorded choice is not authenticated access.\n\nRerun Analyze and Preview after architecture changes. Apply protects hand-edited files and preserves text outside root managed blocks. Files from deselected targets, and earlier \`rw-*\` harness files, are retained and reported by the manifest; remove only after review. Backups and a transaction journal live under .repoweave/backups when changes are applied. Do not use this namespace for credentials.\n\nThe extension provides no daemon and does not execute application tests or autonomous agents. The selected coding host runs the generated delivery harness.\n`);
 const seen=new Set();for(const f of files){if(seen.has(f.path))throw Error('Duplicate generated path: '+f.path);seen.add(f.path);}
 for(const f of files)for(const r of f.refs)if(!seen.has(r))throw Error('Missing generated reference: '+r+' from '+f.path);
 if(files.some(f=>/defect-analyst|pr-reviewer|analyse-defect|review-pr/.test(f.path)))throw Error('Retired agent was generated');
 return {version:1,profileFingerprint:profile.fingerprint,inputHashes,targets,prefix,files};
}
module.exports={generate,architecture,projectRules};
