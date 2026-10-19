'use strict';
// Generates resources/images/icon.png (256x256): a woven grid of teal and amber strands on a dark rounded tile.
const zlib=require('node:zlib'),fs=require('node:fs'),path=require('node:path');
const S=256,SS=3,R=52,M=44,BW=30,G=(S-2*M)/3,centers=[0,1,2].map(i=>M+G*(i+0.5)+(i-1)*0);
const TEAL=[45,212,191],AMBER=[251,191,36],BG1=[15,23,42],BG2=[30,41,59];
const band=v=>{for(let i=0;i<3;i++)if(Math.abs(v-centers[i])<=BW/2)return i;return -1;};
const near=(v,pad)=>{for(let i=0;i<3;i++)if(Math.abs(v-centers[i])<=BW/2+pad)return true;return false;};
const inTile=(x,y)=>{const cx=Math.min(Math.max(x,R),S-R),cy=Math.min(Math.max(y,R),S-R);return (x-cx)**2+(y-cy)**2<=R*R;};
const inGrid=(v)=>v>=M&&v<=S-M;
function sample(x,y){
 if(!inTile(x,y))return null;
 const t=(x+y)/(2*S),c=BG1.map((a,i)=>a+(BG2[i]-a)*t);
 const hi=inGrid(x)?band(y):-1,vi=inGrid(y)?band(x):-1; // hi: horizontal strand row, vi: vertical strand column
 if(hi>=0&&vi>=0)return (hi+vi)%2===0?TEAL:AMBER; // crossing: alternate over/under
 const shade=(col,k)=>col.map(v=>v*k);
 if(hi>=0){const shadowed=inGrid(y)&&near(x,8)&&(vi<0)&&centers.some((cxv,j)=>Math.abs(x-cxv)<=BW/2+8&&(hi+j)%2===1);return shadowed?shade(TEAL,0.55):TEAL;}
 if(vi>=0){const shadowed=inGrid(x)&&near(y,8)&&centers.some((cyv,j)=>Math.abs(y-cyv)<=BW/2+8&&(j+vi)%2===0);return shadowed?shade(AMBER,0.55):AMBER;}
 return c;
}
const raw=Buffer.alloc((S*4+1)*S);
for(let y=0;y<S;y++){raw[y*(S*4+1)]=0;for(let x=0;x<S;x++){let r=0,g=0,b=0,a=0;for(let j=0;j<SS;j++)for(let i=0;i<SS;i++){const p=sample(x+(i+0.5)/SS,y+(j+0.5)/SS);if(p){r+=p[0];g+=p[1];b+=p[2];a++;}}
 const o=y*(S*4+1)+1+x*4,n=SS*SS;raw[o]=a?Math.round(r/a):0;raw[o+1]=a?Math.round(g/a):0;raw[o+2]=a?Math.round(b/a):0;raw[o+3]=Math.round(255*a/n);}}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xFFFFFFFF;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(S,0);ihdr.writeUInt32BE(S,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const out=path.join(__dirname,'../resources/images/icon.png');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,png);console.log('wrote',out,png.length,'bytes');
