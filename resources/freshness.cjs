'use strict';
// Read-only SessionStart context hook. No network, shell execution or workspace writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
try {
 const root=path.resolve(__dirname,'..','..');
 const p=JSON.parse(fs.readFileSync(path.join(root,'.repoweave','profile.json'),'utf8'));
 let changed=0, checked=0;
 for(const f of p.configFiles||[]) {
  if(!p.inputHashes?.[f]||f.includes('..')||path.isAbsolute(f))continue;
  const file=path.resolve(root,f); if(!file.startsWith(root+path.sep))continue;
  // Do not follow a source path moved to a symlink after generation.
  let cur=file,bad=false;while(cur!==root){if(fs.existsSync(cur)&&fs.lstatSync(cur).isSymbolicLink()){bad=true;break;}cur=path.dirname(cur);}
  checked++;try{if(bad||fs.statSync(file).size>8*1024*1024){changed++;continue;}const h=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(h!==p.inputHashes[f])changed++;}catch{changed++;}
 }
 console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:changed?`RepoWeave: ${changed} of ${checked} tracked configs changed. Refresh the harness before relying on its profile.`:'RepoWeave: read .repoweave/harness.md and the applicable project profile. Semantic review status is recorded in profile.json.'}}));
}catch{console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:'RepoWeave profile is unavailable; inspect current project configuration before editing.'}}));}
