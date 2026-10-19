#!/usr/bin/env node
'use strict';
const {scan}=require('../src/core/scanner');
const {generate,architecture}=require('../src/core/generator');
const {plan,apply,validateInstalled}=require('../src/core/writer');
const {fs,path}=require('../src/core/fs');
(async()=>{
 const args=process.argv.slice(2),action=args.shift();
 const get=(key,defaultValue)=>{const i=args.indexOf(key);if(i<0)return defaultValue;const v=args[i+1];if(!v||v.startsWith('--'))throw Error('Missing '+key+' value');return v;};
 const root=fs.realpathSync(path.resolve(get('--project','.')));
 if(action==='validate'){const v=validateInstalled(root);console.log(JSON.stringify(v,null,2));process.exitCode=v.ok?0:1;return;}
 if(!['scan','preview','apply'].includes(action))throw Error('Usage: node scripts/cli.js scan|preview|apply|validate --project PATH [--target copilot|claude|codex|all] [--prefix SLUG] [--hooks] [--integrations azure,jira,figma] [--yes]');
 const profile=await scan(root);if(action==='scan'){console.log(architecture(profile));return;}
 const target=get('--target','copilot');const targets=target==='all'?['copilot','claude','codex']:target.split(',');
 const p=plan(root,generate(profile,{targets,includeHooks:args.includes('--hooks'),integrations:get('--integrations','').split(',').filter(Boolean),prefix:args.includes('--prefix')?get('--prefix'):'',root}));
 console.log(JSON.stringify({files:p.entries.map(e=>({path:e.path,status:e.status,reason:e.reason})),retained:p.retained},null,2));
 if(action==='apply'){if(!args.includes('--yes'))throw Error('Preview first. Add --yes to apply the described changes.');console.log(JSON.stringify(apply(root,p),null,2));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
