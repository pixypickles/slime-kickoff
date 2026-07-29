'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
// 古いAndroid WebView向け互換処理。roundRect未対応でも描画処理を止めない。
if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype.roundRect){
 CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
  let radius=Array.isArray(r)?Number(r[0]||0):Number(r||0);
  radius=Math.max(0,Math.min(radius,Math.abs(w)/2,Math.abs(h)/2));
  this.moveTo(x+radius,y);this.lineTo(x+w-radius,y);this.quadraticCurveTo(x+w,y,x+w,y+radius);
  this.lineTo(x+w,y+h-radius);this.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  this.lineTo(x+radius,y+h);this.quadraticCurveTo(x,y+h,x,y+h-radius);
  this.lineTo(x,y+radius);this.quadraticCurveTo(x,y,x+radius,y);this.closePath();return this;
 };
}
const ui={intro:document.getElementById('intro'),result:document.getElementById('result'),controls:document.getElementById('controls'),startBtn:document.getElementById('startBtn'),retryBtn:document.getElementById('retryBtn'),resultTitle:document.getElementById('resultTitle'),resultText:document.getElementById('resultText'),rematchBtn:document.getElementById('rematchBtn'),menuBtn:document.getElementById('menuBtn'),nextStageBtn:document.getElementById('nextStageBtn'),slimeSelect:document.getElementById('slimeSelect'),loadingText:document.getElementById('loadingText'),skillBtn:document.querySelector('[data-action="skill"]'),stick:document.getElementById('stick'),knob:document.getElementById('knob'),introScroll:document.getElementById('introScroll'),spiritSelect:document.getElementById('spiritSelect'),spiritStatus:document.getElementById('spiritStatus'),stageCard:document.getElementById('stageCard'),clearCard:document.getElementById('clearCard'),clearNextBtn:document.getElementById('clearNextBtn')};
const W=1000,H=600,FIELD={cx:500,cy:316,rx:405,ry:216,goalT:238,goalB:394,gateDepth:92};
const keys={},input={x:0,y:0,dash:false,kick:false,jump:false,skill:false};
let players=[],slime,score=[0,0],timeLeft=75,running=false,last=0,message='',messageLife=0,shake=0,freeze=0,particles=[],fireballs=[],iceWaves=[],rockBalls=[],hurricanes=[],chiefLine='',chiefLife=0,chiefThink=0,portalTime=0,goalScene=null,selectedSpirit='plain',selectedSlime='normal',currentStage=1,stageIntroT=0,clearSequence=false,gameReady=true;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
const rand=(a,b)=>a+Math.random()*(b-a);
const teamColor=t=>t?'#d95757':'#3e9cdc';

function opponentVillageName(){return currentStage===1?'ぶりふぉ村':currentStage===2?'さるびえ村':currentStage===3?'さるびび村':'たけぞ村';}
function opponentElement(){return currentStage===1?'ice':currentStage===2?'fire':currentStage===3?'wind':'earth';}
function homeVillageName(){return 'ぷれん村';}
function playerVillageName(){return homeVillageName();}
function enemyVillageName(){return opponentVillageName();}

const unlockState={plain:true,ice:false,fire:false,wind:false,earth:false};
try{
 const saved=JSON.parse(localStorage.getItem('slimeKickoffUnlocks')||'{}');
 Object.assign(unlockState,saved);
}catch(e){}
function saveUnlocks(){try{localStorage.setItem('slimeKickoffUnlocks',JSON.stringify(unlockState));}catch(e){}}
function refreshSpiritLocks(){
 const radios=document.querySelectorAll('input[name="spirit"]');
 for(const radio of radios){
  const unlocked=!!unlockState[radio.value];
  radio.disabled=!unlocked;
  const label=document.querySelector('label[for="'+radio.id+'"]');
  if(label)label.classList.toggle('locked',!unlocked);
 }
 const checked=document.querySelector('input[name="spirit"]:checked');
 if(!checked||checked.disabled){
  const plain=document.getElementById('spiritPlain');
  if(plain){plain.checked=true;applySpirit('plain');}
 }
}
function unlockSpirit(value){
 if(!unlockState[value]){
  unlockState[value]=true;saveUnlocks();refreshSpiritLocks();
  return true;
 }
 return false;
}

function slimeAirborne(){
 return slime&&slime.hop>0.12&&Math.sin((1-slime.hop/Math.max(.01,slime.hopMax||.58))*Math.PI)>0.16;
}

function launchAirKO(target,type,dir=1){
 target.respawnT=3.0;target.stun=3.0;target.vx=target.vy=0;
 target.airKO={type,x:target.x,y:target.y,z:target.jumpHeight(),spin:0,dir,t:0};
 shake=Math.max(shake,18);
 if(type==='fire'){message='ロケットキック！ 上空へ退場！';burst(target.x,target.y,'#ff8b2c',34);}
 if(type==='wind'){message='旋風脚！ 竹とんぼ退場！';burst(target.x,target.y,'#c8ffd4',34);}
 if(type==='ice'){message='アイスキック！ 凍ったまま退場！';burst(target.x,target.y,'#bff7ff',34);}
 messageLife=1.15;
}

function insideEllipse(x,y,margin=0){const rx=FIELD.rx-margin,ry=FIELD.ry-margin;return ((x-FIELD.cx)**2)/(rx*rx)+((y-FIELD.cy)**2)/(ry*ry)<=1;}
function constrainToField(o){const inGate=o.y>FIELD.goalT&&o.y<FIELD.goalB;if(inGate&&o.x<FIELD.cx-FIELD.rx+o.r)return;if(inGate&&o.x>FIELD.cx+FIELD.rx-o.r)return;const rx=FIELD.rx-o.r,ry=FIELD.ry-o.r,dx=o.x-FIELD.cx,dy=o.y-FIELD.cy,q=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry);if(q>1){const k=1/Math.sqrt(q);o.x=FIELD.cx+dx*k;o.y=FIELD.cy+dy*k;const nx=dx/(rx*rx),ny=dy/(ry*ry),n=norm(nx,ny),dot=o.vx*n.x+o.vy*n.y;if(dot>0){o.vx-=1.75*dot*n.x;o.vy-=1.75*dot*n.y;}}}

class Player{
 constructor(team,x,y,isHuman=false,index=0){Object.assign(this,{team,x,y,isHuman,index,vx:0,vy:0,r:25,faceX:team?-1:1,faceY:0,dashTime:0,dashCd:0,kickCd:0,kickTime:0,jumpT:0,stun:0,burn:0,burnTick:0,frozen:0,rollAngle:0,speedBoost:0,skillCd:0,spirit:null,aiThink:0,aiX:0,aiY:0,respawnT:0,spinKick:0,spinAngle:0,buriedT:0,airKO:null,aiMode:'slime',aiModeT:0,wallSplatPending:0,wallStickT:0,wallStickAngle:0});}
 jumpHeight(){return this.jumpT>0?Math.sin((1-this.jumpT/.82)*Math.PI)*124:0;}
 isAirborne(){return this.jumpHeight()>34;}
 update(dt){
  if(this.respawnT>0){
   this.respawnT=Math.max(0,this.respawnT-dt);this.vx=this.vy=0;
   if(this.airKO){
    this.airKO.t+=dt;
    if(this.airKO.type==='fire'){this.airKO.z+=420*dt;this.airKO.spin+=dt*4.5;}
    if(this.airKO.type==='wind'){this.airKO.z+=360*dt;this.airKO.spin+=dt*18;}
    if(this.airKO.type==='ice'){this.airKO.x+=this.airKO.dir*520*dt;}
   }
   if(this.respawnT===0){
    this.airKO=null;this.x=this.team?750:250;this.y=[225,310,395][this.index];
    this.stun=.28;burst(this.x,this.y,teamColor(this.team),18);
    message='自陣から復帰！';messageLife=.65;
   }
   return;
  }
  if(this.buriedT>0){
   this.buriedT=Math.max(0,this.buriedT-dt);this.vx=this.vy=0;this.stun=Math.max(this.stun,.08);
   if(this.buriedT===0){this.stun=.22;burst(this.x,this.y,'#c99a62',18);message='地面から脱出！';messageLife=.55;}
   return;
  }
  if(this.wallStickT>0){
   this.wallStickT-=dt;this.vx=this.vy=0;this.stun=Math.max(this.stun,.08);
   if(this.wallStickT<=0){
    this.wallStickT=0;this.wallSplatPending=0;this.stun=.28;
    const n=norm(FIELD.cx-this.x,FIELD.cy-this.y);
    this.x+=n.x*18;this.y+=n.y*18;this.vx=n.x*210;this.vy=n.y*210;
    burst(this.x,this.y,'#fff09a',18);message='壁からズルッと復帰！';messageLife=.65;
   }
   return;
  }
  this.dashCd=Math.max(0,this.dashCd-dt);this.kickCd=Math.max(0,this.kickCd-dt);this.skillCd=Math.max(0,this.skillCd-dt);this.stun=Math.max(0,this.stun-dt);this.burn=Math.max(0,this.burn-dt);this.frozen=Math.max(0,this.frozen-dt);this.speedBoost=Math.max(0,this.speedBoost-dt);this.kickTime=Math.max(0,this.kickTime-dt);this.jumpT=Math.max(0,this.jumpT-dt);this.spinKick=Math.max(0,this.spinKick-dt);if(this.spinKick>0)this.spinAngle+=dt*19;if(this.burn>0){this.rollAngle+=dt*14;this.stun=Math.max(this.stun,.08);this.burnTick-=dt;if(this.burnTick<=0){this.burnTick=.12;const a=rand(0,Math.PI*2);this.vx+=Math.cos(a)*95;this.vy+=Math.sin(a)*95;burst(this.x+rand(-12,12),this.y-18,'#ff8b2c',2);}}
  let ix=0,iy=0,actions={};
  if(this.isHuman){ix=input.x+(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);iy=input.y+(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);actions={dash:input.dash||keys.Shift,kick:input.kick||keys.j,jump:input.jump||keys.k,skill:input.skill||keys.l};}
  else ({ix,iy,actions}=this.ai(dt));
  if(this.stun<=0&&this.frozen<=0){
   if(Math.hypot(ix,iy)>.15){const n=norm(ix,iy);this.faceX=n.x;this.faceY=n.y;let sp=this.dashTime>0?590:205;if(this.speedBoost>0)sp*=1.72;this.vx+=n.x*sp*dt*8;this.vy+=n.y*sp*dt*8;}
   if(actions.dash&&this.dashCd<=0){this.dashTime=.14;this.dashCd=.42;burst(this.x,this.y,teamColor(this.team),8);}
   if(actions.jump&&this.jumpT<=0){this.jumpT=.82;burst(this.x,this.y+24,'#eee1bd',10);}
   if(actions.kick&&this.kickCd<=0)this.kick();
   if(actions.skill&&this.skillCd<=0&&this.index===0)this.skill();
  }
  this.dashTime=Math.max(0,this.dashTime-dt);const drag=Math.pow(.0008,dt);this.vx*=drag;this.vy*=drag;this.x+=this.vx*dt;this.y+=this.vy*dt;
  if(this.wallSplatPending>0){
   this.wallSplatPending=Math.max(0,this.wallSplatPending-dt);
   const rx=FIELD.rx-this.r,ry=FIELD.ry-this.r,dx=this.x-FIELD.cx,dy=this.y-FIELD.cy,q=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry);
   if(q>.92){
    const k=1/Math.sqrt(q);this.x=FIELD.cx+dx*k;this.y=FIELD.cy+dy*k;
    this.wallStickT=2.0;this.wallSplatPending=0;this.wallStickAngle=Math.atan2(dy,dx);this.vx=this.vy=0;this.stun=2.0;
    message='ホームランキック！ 壁にベチャッ！';messageLife=1.0;shake=Math.max(shake,16);burst(this.x,this.y,'#fff09a',32);
   }
  }
  constrainToField(this);
  const throughGate=this.y>FIELD.goalT&&this.y<FIELD.goalB&&(this.x<-this.r||this.x>W+this.r);
  if(throughGate){this.respawnT=1.15;this.vx=this.vy=0;message='村まで吹き飛ばされた！';messageLife=.9;shake=Math.max(shake,9);burst(clamp(this.x,25,W-25),this.y,teamColor(this.team),18);}
 }
 ai(dt){
  this.aiModeT-=dt;
  if(this.aiModeT<=0){
   this.aiModeT=rand(1.8,4.2);
   const roll=Math.random();
   // 多くはスライムを追い、時々だけ妨害・守備・位置取りを行う。
   this.aiMode=roll<.62?'slime':roll<.78?'defend':roll<.91?'intercept':'harass';
  }
  this.aiThink-=dt;
  if(this.aiThink<=0){
   this.aiThink=rand(.18,.38);
   let tx=slime.x,ty=slime.y;
   if(this.aiMode==='defend'){
    tx=this.team?760:240;ty=clamp(slime.y,220,405);
   }else if(this.aiMode==='intercept'){
    tx=slime.x+(this.team?110:-110);ty=slime.y+rand(-65,65);
   }else if(this.aiMode==='harass'){
    const enemies=players.filter(p=>p.team!==this.team&&p.respawnT<=0&&p.buriedT<=0);
    const target=enemies[(Math.random()*enemies.length)|0];
    if(target){tx=target.x;ty=target.y;}
   }else if(this.index===1){
    tx+=(this.team?1:-1)*95;ty+=this.team?72:-72;
   }
   const n=norm(tx-this.x,ty-this.y);this.aiX=n.x;this.aiY=n.y;
  }
  const d=Math.hypot(slime.x-this.x,slime.y-this.y);
  const enemyNear=players.some(p=>p.team!==this.team&&p.respawnT<=0&&p.buriedT<=0&&Math.hypot(p.x-this.x,p.y-this.y)<76);
  const attackingPlayer=this.aiMode==='harass'&&enemyNear;
  return{ix:this.aiX,iy:this.aiY,actions:{
   dash:(d>145||attackingPlayer)&&Math.random()<.022,
   kick:(d<94||attackingPlayer)&&Math.random()<.12,
   jump:d<115&&Math.random()<.018,
   skill:this.index===0&&this.skillCd<=0&&d<430&&Math.random()<.009
  }};
 }
 autoAim(){
  const targets=[{x:slime.x,y:slime.y,kind:'slime'}];
  for(const p of players)if(p!==this&&p.team!==this.team)targets.push({x:p.x,y:p.y,kind:'enemy'});
  let best=null,bestScore=Infinity;
  for(const t of targets){
   const d=Math.hypot(t.x-this.x,t.y-this.y);
   // 密着した敵を優先。それ以外はスライムと敵のうち近い方を狙う。
   const score=d-(t.kind==='enemy'&&d<115?90:0);
   if(score<bestScore){best=t;bestScore=score;}
  }
  const n=best?norm(best.x-this.x,best.y-this.y):norm(this.faceX,this.faceY);
  this.faceX=n.x;this.faceY=n.y;
  return n;
 }
 kick(){
  this.kickCd=.34;this.kickTime=.22;const sliding=this.dashTime>0,air=this.isAirborne();let power=sliding?980:air?930:720;if(sliding&&air)power=1220;if(this.spirit==='plain')power*=1.22;
  let elementPower=1,elementColor='#fff1a3';
  if(this.spirit==='wind'){elementPower=1.22;elementColor='#c8ffd4';this.vx+=this.faceX*120;this.vy+=this.faceY*120;this.speedBoost=Math.max(this.speedBoost,.28);if(air){this.spinKick=.46;this.spinAngle=0;message='旋風脚！';messageLife=.7;burst(this.x,this.y-this.jumpHeight(),'#c8ffd4',22);}}
  if(this.spirit==='earth'){elementPower=1.34;elementColor='#d8b27a';}
  const fx=this.faceX,fy=this.faceY,dx=slime.x-this.x,dy=slime.y-this.y;
  if(this.spirit==='earth'&&air){
   let stompTarget=null,stompDist=Infinity;
   for(const p of players){
    if(p===this||p.team===this.team||p.respawnT>0||p.buriedT>0||p.wallStickT>0)continue;
    const d=Math.hypot(p.x-this.x,p.y-this.y);
    if(d<122&&d<stompDist){stompTarget=p;stompDist=d;}
   }
   if(stompTarget){
    stompTarget.vx=0;stompTarget.vy=0;stompTarget.buriedT=3.0;stompTarget.stun=3.0;
    this.jumpT=Math.min(this.jumpT,.16);this.vx*=.35;this.vy*=.35;
    message='アーススタンプ！ 地面に埋まった！';messageLife=1.05;shake=Math.max(shake,17);
    burst(stompTarget.x,stompTarget.y,'#9a673d',34);
   }
  }
  if(Math.hypot(dx,dy)<95+slime.r){
   const n=norm(dx+fx*25,dy+fy*25);
   const airborneVolley=air&&slimeAirborne();
   if(airborneVolley){
    const goalDir=this.team===0?1:-1;
    slime.vx=goalDir*1380;slime.vy=clamp(slime.vy+fy*160,-260,260);
    slime.airSpinSpeed=26+Math.abs(slime.vx)/75;slime.airVolleyT=1.15;
    slime.hop=Math.max(slime.hop,.8);slime.hopMax=Math.max(slime.hopMax||.58,slime.hop);
    slime.scared=1;message='空中ボレー！ 属性レジスト！';messageLife=1.0;
    shake=Math.max(shake,16);burst(slime.x,slime.y,'#fff4b5',34);
   }else{
    slime.vx+=n.x*power*elementPower;slime.vy+=n.y*power*elementPower;
    slime.wobble+=rand(-2,2);slime.hop=Math.max(slime.hop,air||sliding?.68:.54);
    slime.hopMax=Math.max(slime.hopMax||.45,slime.hop);
    shake=Math.max(shake,sliding?10:6);burst(slime.x,slime.y,elementColor,16);
   }
   if(this.spirit==='fire'){slime.vx+=fx*180;slime.vy+=fy*180;slime.scared=1;slime.hop=.58;slime.hopMax=.58;message='ファイアキック！';messageLife=.65;burst(slime.x,slime.y,'#ff8b2c',18);}
   if(!airborneVolley&&this.spirit==='ice'){slime.frozen=Math.max(slime.frozen||0,1.8);slime.vx*=.72;slime.vy*=.72;message='アイスキック！';messageLife=.65;burst(slime.x,slime.y,'#bff7ff',20);}
   if(!airborneVolley&&this.spirit==='wind'){message='ウインドキック！';messageLife=.6;}
   if(!airborneVolley&&this.spirit==='earth'){message='アースキック！';messageLife=.6;shake=Math.max(shake,11);}
  }
  for(const p of players){if(p===this||p.team===this.team||p.respawnT>0||p.buriedT>0||p.wallStickT>0)continue;const px=p.x-this.x,py=p.y-this.y,n=norm(px,py);if(Math.hypot(px,py)<88&&n.x*fx+n.y*fy>-.1){p.vx+=fx*power*1.28*elementPower;p.vy+=fy*power*1.28*elementPower;p.stun=Math.max(p.stun,sliding?.82:air?.62:.46);p.vx+=fx*(air||sliding?360:220);p.vy+=fy*(air||sliding?360:220);shake=Math.max(shake,8);burst(p.x,p.y,elementColor,12);
    if(air&&this.spirit==='plain'){
      p.vx=fx*1520;p.vy=fy*1520;p.wallSplatPending=1.2;p.stun=2.2;
      message='ホームランキック！';messageLife=.85;shake=Math.max(shake,14);burst(p.x,p.y,'#fff09a',28);continue;
    }
    if(air&&this.spirit==='fire'){launchAirKO(p,'fire',fx>=0?1:-1);continue;}
    if(air&&this.spirit==='wind'){launchAirKO(p,'wind',fx>=0?1:-1);continue;}
    if(air&&this.spirit==='ice'){launchAirKO(p,'ice',fx>=0?1:-1);continue;}
    if(this.spirit==='fire'){p.burn=Math.max(p.burn,air||sliding?1.7:1.3);p.burnTick=0;p.vx+=fx*(air||sliding?240:150);p.vy+=fy*(air||sliding?240:150);}
    if(this.spirit==='ice'){p.frozen=Math.max(p.frozen,air||sliding?1.75:1.35);p.stun=0;p.vx+=fx*(air||sliding?210:120);p.vy+=fy*(air||sliding?210:120);}
    if(this.spirit==='wind'){p.vx+=fx*(air||sliding?430:300);p.vy+=fy*(air||sliding?430:300);}
    if(this.spirit==='plain'){p.vx+=fx*260;p.vy+=fy*260;p.stun=Math.max(p.stun,.55);}
    if(this.spirit==='earth'){p.stun=Math.max(p.stun,air||sliding?1.0:.78);p.vx+=fx*(air||sliding?280:170);p.vy+=fy*(air||sliding?280:170);}
  }}
 }
 skill(){if(this.spirit==='plain')return this.plainSpirit();if(this.spirit==='ice')return this.coldBreath();if(this.spirit==='wind')return this.hurricane();if(this.spirit==='earth')return this.rockCannon();this.skillCd=5.2;const n=this.autoAim();fireballs.push({x:this.x+n.x*48,y:this.y+n.y*48,vx:n.x*500,vy:n.y*500,z:this.jumpHeight()+20,vz:-24,team:this.team,owner:this,life:2.1,r:24,trail:0});message='ファイアボール！';messageLife=.8;shake=Math.max(shake,5);burst(this.x+n.x*38,this.y+n.y*38,'#ffb13b',18);}
 plainSpirit(){this.skillCd=3.2;this.speedBoost=Math.max(this.speedBoost,.6);this.dashCd=0;message='ぷれん村の気合い！';messageLife=.75;burst(this.x,this.y,'#fff09a',22);}
 hurricane(){this.skillCd=7.2;const n=this.autoAim();hurricanes.push({x:this.x+n.x*52,y:this.y-this.jumpHeight()+n.y*52,vx:n.x*255,vy:n.y*255,team:this.team,owner:this,life:1.65,maxLife:1.65,r:58,spin:0});message='ハリケーン！';messageLife=.9;shake=Math.max(shake,5);burst(this.x+n.x*40,this.y+n.y*40,'#c8ffd4',24);}
 rockCannon(){this.skillCd=6.8;const n=this.autoAim();rockBalls.push({x:this.x+n.x*45,y:this.y-this.jumpHeight()+n.y*45-5,vx:n.x*470,vy:n.y*470,team:this.team,owner:this,life:1.65,r:21,spin:0});message='ロックキャノン！';messageLife=.9;shake=Math.max(shake,5);burst(this.x+n.x*34,this.y+n.y*34,'#c99a62',16);}
 coldBreath(){this.skillCd=6.4;const n=this.autoAim();const originX=this.x,originY=this.y-this.jumpHeight();iceWaves.push({x:originX,y:originY,dx:n.x,dy:n.y,team:this.team,owner:this,life:.42,maxLife:.42,range:225,angle:.6});
  // 密着時は扇形の成長を待たず、使用者の周囲も即座に凍結判定する。
  for(const target of players){if(target===this||target.team===this.team||target.jumpHeight()>72)continue;const dx=target.x-this.x,dy=target.y-this.y;if(Math.hypot(dx,dy)<=72){target.frozen=Math.max(target.frozen,1.8);target.vx*=.15;target.vy*=.15;target.stun=0;burst(target.x,target.y,'#bff7ff',22);}}
  if(Math.hypot(slime.x-this.x,slime.y-this.y)<=82){slime.frozen=Math.max(slime.frozen||0,2.2);slime.vx*=.08;slime.vy*=.08;slime.hop=0;burst(slime.x,slime.y,'#d9fbff',26);}
  message='コールドブレス！';messageLife=.9;shake=Math.max(shake,3);burst(this.x+n.x*34,this.y+n.y*34,'#bff7ff',18);}
 draw(){
  if(this.respawnT>0){
   if(this.airKO){
    const k=this.airKO;
    ctx.save();
    if(k.type==='ice')ctx.translate(k.x,k.y);
    else ctx.translate(k.x,k.y-k.z);
    if(k.type==='wind'){const squash=.18+.82*Math.abs(Math.cos(k.spin));ctx.scale(squash,1);}
    else if(k.type==='fire')ctx.rotate(Math.sin(k.spin)*.15);
    ctx.globalAlpha=clamp(this.respawnT/.45,0,1);
    // simplified body during knockout
    ctx.fillStyle=teamColor(this.team);ctx.strokeStyle='#fff';ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(-18,-8,36,38,10);ctx.fill();ctx.stroke();
    ctx.fillStyle='#f2c895';ctx.strokeStyle='#5d3924';ctx.beginPath();ctx.arc(0,-24,17,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#6a4328';ctx.beginPath();ctx.ellipse(-10,37,18,11,0,0,Math.PI*2);ctx.ellipse(10,37,18,11,0,0,Math.PI*2);ctx.fill();
    if(k.type==='fire'){
      ctx.fillStyle='#ff7a24';ctx.beginPath();ctx.moveTo(-14,43);ctx.lineTo(0,82+Math.sin(k.t*18)*8);ctx.lineTo(14,43);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffd24a';ctx.beginPath();ctx.moveTo(-7,43);ctx.lineTo(0,68);ctx.lineTo(7,43);ctx.closePath();ctx.fill();
    }
    if(k.type==='wind'){
      ctx.strokeStyle='#dffff0';ctx.lineWidth=6;ctx.globalAlpha=.72;
      ctx.beginPath();ctx.ellipse(0,8,66,18,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.48;ctx.lineWidth=4;ctx.setLineDash([14,10]);ctx.lineDashOffset=-k.spin*10;
      ctx.beginPath();ctx.ellipse(0,8,50,13,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    if(k.type==='ice'){
      ctx.globalAlpha=.55;ctx.fillStyle='#bff7ff';ctx.strokeStyle='#edffff';ctx.lineWidth=4;
      ctx.beginPath();ctx.roundRect(-31,-46,62,91,20);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#dffcff';ctx.beginPath();ctx.moveTo(-36,50);ctx.lineTo(-70,50);ctx.stroke();
    }
    ctx.restore();
   }
   return;
  }
  if(this.wallStickT>0){
   ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.wallStickAngle+Math.PI/2);ctx.scale(1.45,.42);
   ctx.fillStyle=this.team===0?'#fffdf0':'#888';ctx.strokeStyle='#5b3c22';ctx.lineWidth=4;
   ctx.beginPath();ctx.roundRect(-20,-30,40,62,13);ctx.fill();ctx.stroke();
   ctx.fillStyle='#f2c895';ctx.beginPath();ctx.arc(0,-38,18,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#6a4328';ctx.beginPath();ctx.ellipse(-13,38,20,12,0,0,Math.PI*2);ctx.ellipse(13,38,20,12,0,0,Math.PI*2);ctx.fill();
   ctx.restore();return;
  }
  if(this.buriedT>0){
   ctx.save();ctx.translate(this.x,this.y);
   ctx.fillStyle='#8b5a32';ctx.strokeStyle='#4e321d';ctx.lineWidth=4;
   ctx.beginPath();ctx.ellipse(0,15,42,18,0,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#6a4328';ctx.strokeStyle='#29180e';
   ctx.beginPath();ctx.ellipse(-12,-1,20,12,-.12,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.beginPath();ctx.ellipse(13,-1,20,12,.12,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#6b482c';for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(rand(-32,32),rand(5,22),rand(2,5),0,Math.PI*2);ctx.fill();}
   ctx.restore();return;
  }
  const jump=this.jumpHeight();
  const ang=Math.atan2(this.faceY,this.faceX),kicking=this.kickTime>0;
  ctx.save();ctx.translate(this.x,this.y-jump);if(this.burn>0)ctx.rotate(this.rollAngle);
  ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(0,30+jump,31,10,0,0,Math.PI*2);ctx.fill();

  // 胴体は常に上向き。片足は胴体の下へ固定し、もう片足だけ大きく蹴り出す。
  const isHomePlayer=this.team===0;
  const enemyBrifo=this.team===1&&currentStage===1;
  ctx.fillStyle=isHomePlayer?'#fffdf0':(enemyBrifo?'#ffffff':currentStage===2?'#7b2438':currentStage===3?'#29b8b4':'#ec73ad');ctx.strokeStyle=this.isHuman?'#ffe45c':'#fff';ctx.lineWidth=this.isHuman?5:3;
  ctx.beginPath();ctx.roundRect(-20,-7,40,42,11);ctx.fill();ctx.stroke();
  if(isHomePlayer){ctx.fillStyle='#f2cf4a';ctx.fillRect(-20,7,40,10);}
  else if(enemyBrifo){ctx.save();ctx.beginPath();ctx.roundRect(-20,-7,40,42,11);ctx.clip();ctx.fillStyle='#7fd5ef';for(let sx=-18;sx<22;sx+=12)ctx.fillRect(sx,-7,6,42);ctx.restore();}else if(this.team===1&&currentStage===4){ctx.fillStyle='#172c55';ctx.fillRect(-20,6,40,12);}
  ctx.fillStyle=this.team?'#803737':'#25688f';ctx.fillRect(-15,17,30,7);
  ctx.fillStyle='#d9b36c';ctx.fillRect(-13,25,9,12);ctx.fillRect(5,25,9,12);
  ctx.fillStyle='#6a4328';ctx.strokeStyle='#29180e';ctx.lineWidth=4;
  // 軸足
  ctx.beginPath();ctx.ellipse(-12,39,20,12,-.08,0,Math.PI*2);ctx.fill();ctx.stroke();
  // 蹴り足。通常時は胴体下、キック中だけ向いている方向へ大きく動く。
  if(kicking){
   const kickReach=this.isAirborne()?62:(this.dashTime>0?70:54);
   const kickAng=this.spinKick>0?this.spinAngle:ang;
   ctx.save();ctx.rotate(kickAng);ctx.translate(kickReach,5);ctx.rotate(.12);
   ctx.scale(1.28,1.12);ctx.beginPath();ctx.ellipse(0,0,24,14,0,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.strokeStyle=this.spirit==='fire'?'#ff9a32':this.spirit==='ice'?'#bff7ff':this.spirit==='wind'?'#c8ffd4':this.spirit==='earth'?'#d8b27a':'#fff1a3';
   ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-32,0);ctx.lineTo(-10,0);ctx.stroke();ctx.restore();
  }else{
   ctx.beginPath();ctx.ellipse(12,39,20,12,.08,0,Math.PI*2);ctx.fill();ctx.stroke();
  }

  if(this.spinKick>0){
   ctx.save();ctx.globalAlpha=.62;ctx.strokeStyle='#dffff0';ctx.lineWidth=6;
   ctx.beginPath();ctx.ellipse(0,8,68,20,0,0,Math.PI*2);ctx.stroke();
   ctx.globalAlpha=.42;ctx.lineWidth=4;ctx.setLineDash([16,12]);ctx.lineDashOffset=-this.spinAngle*12;
   ctx.beginPath();ctx.ellipse(0,8,52,15,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }

  // 頭・顔は画面上向きに固定。
  ctx.fillStyle='#f2c895';ctx.strokeStyle='#5d3924';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-25,19,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=this.spirit==='ice'?'#b7efff':this.spirit==='fire'?'#d9482f':this.spirit==='wind'?'#85d69a':this.spirit==='earth'?'#8a6844':'#53321f';ctx.beginPath();ctx.arc(0,-31,15,Math.PI,Math.PI*2);ctx.fill();if(this.spirit==='fire'){ctx.fillStyle='#ffcf45';ctx.beginPath();ctx.moveTo(-12,-39);ctx.quadraticCurveTo(-4,-58,1,-41);ctx.quadraticCurveTo(10,-58,13,-37);ctx.closePath();ctx.fill();}
  if(this.spirit==='ice'){ctx.fillStyle='#e9fdff';ctx.beginPath();ctx.moveTo(-14,-38);ctx.lineTo(-5,-55);ctx.lineTo(0,-40);ctx.lineTo(8,-56);ctx.lineTo(14,-37);ctx.closePath();ctx.fill();}
  if(this.spirit==='wind'){ctx.strokeStyle='#e2ffe9';ctx.lineWidth=5;ctx.beginPath();ctx.arc(-2,-39,15,Math.PI*1.05,Math.PI*1.9);ctx.stroke();ctx.beginPath();ctx.arc(5,-43,10,Math.PI*.9,Math.PI*1.75);ctx.stroke();}
  if(this.spirit==='earth'){ctx.fillStyle='#d7b07a';ctx.beginPath();ctx.moveTo(-14,-38);ctx.lineTo(-9,-49);ctx.lineTo(-2,-43);ctx.lineTo(5,-51);ctx.lineTo(14,-37);ctx.closePath();ctx.fill();ctx.strokeStyle='#5e432c';ctx.lineWidth=2;ctx.stroke();}
  ctx.fillStyle='#2b1b15';ctx.beginPath();ctx.arc(-6,-25,2.3,0,Math.PI*2);ctx.arc(6,-25,2.3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#8a4d3b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-19,5,.2,Math.PI-.2);ctx.stroke();
  ctx.restore();
  if(this.speedBoost>0){ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle='#d9ffe2';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(this.x-38-i*8,this.y-18+i*14);ctx.lineTo(this.x-68-i*12,this.y-18+i*14);ctx.stroke();}ctx.restore();}
  if(this.frozen>0){ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#bff7ff';ctx.strokeStyle='#ecffff';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(this.x-30,this.y-jump-55,60,95,15);ctx.fill();ctx.stroke();ctx.restore();ctx.font='23px sans-serif';ctx.fillText('❄️',this.x-13,this.y-jump-65);}
  if(this.stun>0&&this.burn<=0&&this.frozen<=0){ctx.font='24px sans-serif';ctx.fillText('★',this.x-12,this.y-jump-58);}if(this.burn>0){ctx.font='25px sans-serif';ctx.fillText('🔥',this.x-13,this.y-jump-62);}if(this.skillCd>0&&this.index===0){ctx.fillStyle='#0009';ctx.fillRect(this.x-24,this.y+40,48,5);ctx.fillStyle=this.spirit==='ice'?'#8deeff':this.spirit==='wind'?'#87eda2':this.spirit==='earth'?'#c99a62':'#ff8b2c';const maxCd=this.spirit==='ice'?6.4:this.spirit==='wind'?7.2:this.spirit==='earth'?6.8:5.2;ctx.fillRect(this.x-24,this.y+40,48*(1-this.skillCd/maxCd),5);}
 }
}

function reset(afterGoal=false){players=[];for(let i=0;i<3;i++){const a=new Player(0,250,[225,310,395][i],i===0,i),b=new Player(1,750,[225,310,395][i],false,i);if(i===0){a.spirit=selectedSpirit;b.spirit=opponentElement();}players.push(a,b);}
 const jumpy=selectedSlime==='jumpy';
 slime={x:500,y:310,vx:0,vy:0,r:jumpy?34:37,wobble:0,think:jumpy?rand(.35,.8):rand(.7,1.6),hop:0,hopMax:jumpy?.82:.58,airSpin:0,airSpinSpeed:0,airVolleyT:0,blink:rand(1.2,3.4),blinkT:0,startT:afterGoal?0:.9,startY:316,scared:0,frozen:0,type:selectedSlime};
 if(afterGoal)for(const p of players)p.stun=.45;message='押し付け合い、始めぇぇ！！';messageLife=1.2;chiefLine='相手の村へ押し込め！ 褒美は弾むぞ！';chiefLife=2.5;chiefThink=rand(4,7);goalScene=null;}
function startGame(){selectedSlime=ui.slimeSelect?ui.slimeSelect.value:'normal';score=[0,0];timeLeft=75;particles=[];fireballs=[];iceWaves=[];rockBalls=[];hurricanes=[];freeze=0;running=true;stageIntroT=1.8;ui.intro.classList.add('hidden');ui.intro.style.display='none';ui.result.classList.add('hidden');ui.result.style.display='none';if(ui.clearCard){ui.clearCard.classList.add('hidden');ui.clearCard.style.display='none';}ui.controls.classList.add('hidden');ui.controls.style.display='none';
 if(ui.stageCard){
  const title=ui.stageCard.querySelector('h2'),kicker=ui.stageCard.querySelector('.stage-kicker'),paras=ui.stageCard.querySelectorAll('p'),quote=ui.stageCard.querySelector('strong');
  if(currentStage===1){kicker.textContent='❄ 異次元ゲート接続';title.textContent='ぶりふぉ村';paras[0].textContent='雪と氷に囲まれた静かな村。';paras[1].textContent='ぷれん村の前に、氷の村への道が開いた。';quote.textContent='村長「新しい村が相手だ！ 臭いのは向こうへ返すんだ！」';}
  else if(currentStage===2){kicker.textContent='🔥 新たな異次元ゲート接続';title.textContent='さるびえ村';paras[0].textContent='鍛冶場の煙が立ちのぼる、熱気のある村。';paras[1].textContent='ぷれん村の次の対戦相手。今回は、よく跳ねるスライムが現れた。';quote.textContent='村長「また別の村だ！ こっちへ寄せるな！」';}
  else if(currentStage===3){kicker.textContent='🌪 新たな異次元ゲート接続';title.textContent='さるびび村';paras[0].textContent='風車と旗が絶えず揺れる、風の村。';paras[1].textContent='ターコイズの村人たちが、風に乗って待ち構えている。';quote.textContent='村長「風に飛ばされるな！ 地に足をつけて押し返せ！」';}
  else{kicker.textContent='🪨 新たな異次元ゲート接続';title.textContent='たけぞ村';paras[0].textContent='竹林と石垣に囲まれた、土の村。';paras[1].textContent='ピンクとネイビーの村人たちが、どっしり構えている。';quote.textContent='村長「岩に負けるな！ 足元を固めて押し返せ！」';}
  ui.stageCard.classList.remove('hidden');ui.stageCard.style.display='flex';
 }
 reset();last=performance.now();requestAnimationFrame(loop);}
function endGame(){running=false;ui.controls.classList.add('hidden');ui.controls.style.display='none';const win=score[0]>score[1],draw=score[0]===score[1];
 if(win&&currentStage===1){showClearSequence();return;}
 if(win&&currentStage===2){
  unlockSpirit('fire');
  ui.result.classList.remove('hidden');ui.result.style.display='grid';
  ui.resultTitle.textContent='🔥 ファイア技を習得！';
  ui.resultText.textContent='新たな接続先：🌪 さるびび村';
  if(ui.nextStageBtn){ui.nextStageBtn.hidden=false;ui.nextStageBtn.textContent='さるびび村へ進む';}
  return;
 }
 if(win&&currentStage===3){
  unlockSpirit('wind');
  ui.result.classList.remove('hidden');ui.result.style.display='grid';
  ui.resultTitle.textContent='🌪 風の技を習得！';
  ui.resultText.textContent='次の接続先：🪨 たけぞ村';
  if(ui.nextStageBtn){ui.nextStageBtn.hidden=false;ui.nextStageBtn.textContent='たけぞ村へ進む';}
  return;
 }
 if(win&&currentStage===4){
  unlockSpirit('earth');
  ui.result.classList.remove('hidden');ui.result.style.display='grid';
  ui.resultTitle.textContent='🪨 土の技を習得！';
  ui.resultText.textContent='次の接続先：⚡ ちぇすたぴサーカス団（準備中）';
  if(ui.nextStageBtn){ui.nextStageBtn.hidden=true;}
  return;
 }
 ui.result.classList.remove('hidden');ui.result.style.display='grid';
 ui.resultTitle.textContent=draw?'引き分け！':win?'褒美獲得！':'スライムを押し付けられた…';
 ui.resultText.textContent=`${playerVillageName()} ${score[0]} － ${score[1]} ${enemyVillageName()}`;
 if(ui.nextStageBtn){ui.nextStageBtn.hidden=!win;ui.nextStageBtn.textContent='次のステージ';}
}
function update(dt){if(!running)return;
 if(stageIntroT>0){stageIntroT=Math.max(0,stageIntroT-dt);portalTime+=dt;if(stageIntroT===0){if(ui.stageCard){ui.stageCard.classList.add('hidden');ui.stageCard.style.display='none';}ui.controls.classList.remove('hidden');ui.controls.style.display='block';message='押し付け合い、始めぇぇ！！';messageLife=1.1;}return;}
 timeLeft-=dt;if(timeLeft<=0)return endGame();portalTime+=dt;messageLife=Math.max(0,messageLife-dt);chiefLife=Math.max(0,chiefLife-dt);chiefThink-=dt;if(chiefThink<=0&&chiefLife<=0){const lines=currentStage===1?['氷の村へ押し返せー！','ぷれん村を守れ！','雪の向こうへやれ！','靴を止めるなー！','その調子だ！']:currentStage===2?['炎の村へ押し返せー！','鍛冶場の方へやれ！','ぷれん村へ入れるな！','熱さに負けるな！','そのまま押し込め！']:currentStage===3?['風車の向こうへ押し返せー！','飛ばされるな！','ターコイズの旗を狙え！','風に負けず踏ん張れ！','そのまま押し込め！']:['石垣の向こうへ押し返せー！','地面に埋められるな！','竹林まで飛ばせ！','足元を固めろ！','そのまま押し込め！'];chiefLine=lines[(Math.random()*lines.length)|0];chiefLife=2.1;chiefThink=rand(5,9);}shake=Math.max(0,shake-dt*24);const stopped=freeze>0;freeze=Math.max(0,freeze-dt);for(const p of players)if(!stopped||p.team===0)p.update(dt);updateSlime(dt,stopped);updateFireballs(dt,stopped);updateIceWaves(dt,stopped);updateRockBalls(dt,stopped);updateHurricanes(dt,stopped);collisions();updateParticles(dt);if(goalScene){goalScene.life-=dt;if(goalScene.life<=0)goalScene=null;}input.dash=input.kick=input.jump=input.skill=false;}
function updateSlime(dt,stopped){if(stopped)return;slime.think-=dt;slime.hop=Math.max(0,slime.hop-dt*.62);slime.blink-=dt;slime.blinkT=Math.max(0,slime.blinkT-dt);slime.scared=Math.max(0,slime.scared-dt);slime.airVolleyT=Math.max(0,(slime.airVolleyT||0)-dt);slime.airSpin+=(slime.airSpinSpeed||0)*dt;if(slime.airVolleyT<=0)slime.airSpinSpeed*=Math.pow(.08,dt);slime.frozen=Math.max(0,(slime.frozen||0)-dt);if(slime.blink<=0){slime.blink=rand(1.5,4);slime.blinkT=.13;}if(slime.frozen>0){slime.vx*=Math.pow(.75,dt);slime.vy*=Math.pow(.75,dt);slime.x+=slime.vx*dt;slime.y+=slime.vy*dt;constrainToField(slime);if(slime.x<-slime.r){score[1]++;goal(1);}else if(slime.x>W+slime.r){score[0]++;goal(0);}return;}if(slime.startT>0){slime.startT=Math.max(0,slime.startT-dt);slime.hop=.58;slime.hopMax=.58;const burstOut=1-slime.startT/.9;slime.y=slime.startY-Math.sin(burstOut*Math.PI)*42;slime.vx*=.8;slime.vy*=.8;return;}if(slime.think<=0){
  slime.think=slime.type==='jumpy'?rand(.18,.55):rand(.38,1.15);
  const sideBias=Math.random()<.78;
  const a=sideBias?(Math.random()<.5?0:Math.PI)+rand(-.4,.4):rand(0,Math.PI*2);
  const f=slime.type==='jumpy'?rand(180,330):rand(145,285);
  slime.vx+=Math.cos(a)*f;slime.vy+=Math.sin(a)*f;
  slime.wobble=rand(-4.2,4.2);
  slime.hop=slime.type==='jumpy'?rand(.95,1.25):rand(.7,1.0);slime.hopMax=slime.hop;
  if(Math.random()<.36)slime.think=rand(.14,.28);
 }
 slime.vx*=Math.pow(.18,dt);slime.vy*=Math.pow(.18,dt);slime.x+=slime.vx*dt;slime.y+=slime.vy*dt;slime.wobble*=Math.pow(.05,dt);constrainToField(slime);if(slime.x<-slime.r){score[1]++;goal(1);}else if(slime.x>W+slime.r){score[0]++;goal(0);}}

function updateFireballs(dt,stopped){
 if(stopped)return;
 for(const f of fireballs){
  f.life-=dt;f.trail-=dt;
  // スライムか最寄りの敵へ緩やかに追尾。空中ではゆっくり下降する。
  let target={x:slime.x,y:slime.y,z:0,kind:'slime'},best=Math.hypot(slime.x-f.x,slime.y-f.y);
  for(const p of players){
   if(p.team===f.team||p===f.owner)continue;
   const d=Math.hypot(p.x-f.x,p.y-f.y);
   if(d<best){best=d;target={x:p.x,y:p.y,z:p.jumpHeight(),kind:'enemy'};}
  }
  const desired=norm(target.x-f.x,target.y-f.y),speed=Math.max(430,Math.hypot(f.vx,f.vy));
  const turn=clamp(dt*3.1,0,1);
  f.vx+=(desired.x*speed-f.vx)*turn;f.vy+=(desired.y*speed-f.vy)*turn;
  f.x+=f.vx*dt;f.y+=f.vy*dt;
  f.z=Math.max(0,(f.z||0)+(f.vz||-24)*dt);f.vz=Math.max(-54,(f.vz||-24)-10*dt);
  if(f.trail<=0){f.trail=.035;particles.push({x:f.x+rand(-4,4),y:f.y-f.z+rand(-4,4),vx:rand(-35,35),vy:rand(-35,35),life:rand(.18,.38),color:Math.random()<.5?'#ffcf45':'#ff6b2c'});}
  if(!insideEllipse(f.x,f.y,-18)){f.life=0;burst(f.x,f.y-f.z,'#ff8b2c',8);continue;}
  const sd=Math.hypot(slime.x-f.x,slime.y-f.y);
  if(sd<slime.r+f.r+8&&Math.abs((slimeAirborne()?42:0)-f.z)<86){const n=norm(f.vx,f.vy);slime.vx+=n.x*1120;slime.vy+=n.y*1120;slime.scared=.9;slime.hop=.72;slime.hopMax=.72;f.life=0;message='スライムが熱くて転がった！';messageLife=.9;shake=12;burst(slime.x,slime.y,'#ff9a32',28);continue;}
  for(const target of players){
   if(target.team===f.team||target===f.owner||target.respawnT>0||target.buriedT>0)continue;
   if(Math.abs(target.jumpHeight()-f.z)>76)continue;
   if(Math.hypot(target.x-f.x,target.y-f.y)<target.r+f.r+7){const n=norm(f.vx,f.vy);target.vx+=n.x*650;target.vy+=n.y*650;target.burn=1.9;target.burnTick=0;target.stun=.38;target.vx+=n.x*240;target.vy+=n.y*240;f.life=0;message='燃えた！ コロコロ消火中！';messageLife=1;shake=11;burst(target.x,target.y-target.jumpHeight(),'#ff7a24',28);break;}
  }
 }
 fireballs=fireballs.filter(f=>f.life>0);
}

function updateIceWaves(dt,stopped){
 if(stopped)return;
 for(const w of iceWaves){
  w.life-=dt;const progress=1-w.life/w.maxLife;
  for(const target of players){if(target.team===w.team||target===w.owner||target.frozen>0||target.jumpHeight()>72)continue;const dx=target.x-w.x,dy=target.y-w.y,d=Math.hypot(dx,dy);if(d>w.range*progress+55)continue;const n=norm(dx,dy),dot=n.x*w.dx+n.y*w.dy;if(dot>Math.cos(w.angle)){target.frozen=1.8;target.vx*=.15;target.vy*=.15;target.stun=0;message='カチンコチン！ 触れると滑る！';messageLife=1;burst(target.x,target.y,'#bff7ff',22);}}
  const dx=slime.x-w.x,dy=slime.y-w.y,d=Math.hypot(dx,dy),n=norm(dx,dy);if(!slime.frozen&&d<w.range*progress+slime.r&&n.x*w.dx+n.y*w.dy>Math.cos(w.angle)){slime.frozen=2.2;slime.vx*=.08;slime.vy*=.08;slime.hop=0;message='スライムが凍った！ 蹴ると滑る！';messageLife=1;burst(slime.x,slime.y,'#d9fbff',26);}
 }
 iceWaves=iceWaves.filter(w=>w.life>0);
}

function updateRockBalls(dt,stopped){
 if(stopped)return;
 for(const r of rockBalls){
  r.life-=dt;r.spin+=dt*9;r.x+=r.vx*dt;r.y+=r.vy*dt;r.vx*=Math.pow(.985,dt*60);r.vy*=Math.pow(.985,dt*60);
  if(!insideEllipse(r.x,r.y,-10)){r.life=0;shake=Math.max(shake,7);burst(r.x,r.y,'#b88652',18);continue;}
  if(Math.hypot(slime.x-r.x,slime.y-r.y)<slime.r+r.r){const n=norm(r.vx,r.vy);slime.vx+=n.x*1120;slime.vy+=n.y*1120;slime.scared=1;slime.hop=.58;slime.hopMax=.58;r.life=0;message='岩でスライムが吹っ飛んだ！';messageLife=1;shake=15;burst(slime.x,slime.y,'#d8b27a',28);continue;}
  for(const target of players){if(target.team===r.team||target===r.owner||target.jumpHeight()>72)continue;if(Math.hypot(target.x-r.x,target.y-r.y)<target.r+r.r){const n=norm(r.vx,r.vy);target.vx+=n.x*1050;target.vy+=n.y*1050;target.stun=Math.max(target.stun,1.05);r.life=0;message='特大ノックバック！';messageLife=.9;shake=17;burst(target.x,target.y,'#d8b27a',30);break;}}
 }
 rockBalls=rockBalls.filter(r=>r.life>0);
}
function updateHurricanes(dt,stopped){
 if(stopped)return;
 for(const h of hurricanes){
  h.life-=dt;h.spin+=dt*11;h.x+=h.vx*dt;h.y+=h.vy*dt;
  if(!insideEllipse(h.x,h.y,18)){h.vx*=.82;h.vy*=.82;h.life-=dt*2.2;}
  for(const p of players){
   if(p===h.owner)continue;
   const dx=h.x-p.x,dy=h.y-p.y,d=Math.hypot(dx,dy);
   if(d<h.r+34){
    const pull=clamp(1-d/(h.r+34),0,1),n=norm(dx,dy);
    p.vx+=n.x*(520*pull)*dt*8+h.vx*.018;
    p.vy+=n.y*(520*pull)*dt*8+h.vy*.018;
    p.stun=Math.max(p.stun,.08);p.rollAngle+=dt*8;
    if(Math.random()<.18)burst(p.x,p.y,'#dfffe8',1);
   }
  }
  const sdx=h.x-slime.x,sdy=h.y-slime.y,sd=Math.hypot(sdx,sdy);
  if(sd<h.r+slime.r+18){
   const pull=clamp(1-sd/(h.r+slime.r+18),0,1),n=norm(sdx,sdy);
   slime.vx+=n.x*(650*pull)*dt*8+h.vx*.022;
   slime.vy+=n.y*(650*pull)*dt*8+h.vy*.022;
   slime.wobble+=dt*9;slime.hop=Math.max(slime.hop,.18);slime.scared=Math.max(slime.scared,.25);
  }
  if(Math.random()<.55)burst(h.x+rand(-22,22),h.y+rand(-22,22),'#c8ffd4',1);
 }
 hurricanes=hurricanes.filter(h=>h.life>0);
}
function drawHurricanes(){
 for(const h of hurricanes){
  const fade=clamp(h.life/.28,0,1),pulse=1+Math.sin(h.spin*1.7)*.08;
  ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.spin);ctx.scale(pulse,pulse);ctx.globalAlpha=.82*fade;
  for(let i=0;i<4;i++){ctx.strokeStyle=i%2?'#effff3':'#9beab1';ctx.lineWidth=8-i;ctx.beginPath();ctx.arc(0,0,18+i*10,i*.8,Math.PI*1.55+i*.8);ctx.stroke();}
  ctx.globalAlpha=.42*fade;ctx.fillStyle='#dffff0';ctx.beginPath();ctx.ellipse(0,18,47,17,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}

function drawRockBalls(){for(const r of rockBalls){ctx.save();ctx.translate(r.x,r.y-(r.z||0));ctx.rotate(r.spin);ctx.fillStyle='#8b6542';ctx.strokeStyle='#4f3928';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-20,-9);ctx.lineTo(-8,-22);ctx.lineTo(12,-18);ctx.lineTo(22,-2);ctx.lineTo(13,18);ctx.lineTo(-9,21);ctx.lineTo(-23,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#c9a06f';ctx.beginPath();ctx.moveTo(-9,-12);ctx.lineTo(5,-15);ctx.lineTo(13,-5);ctx.lineTo(-2,-2);ctx.closePath();ctx.fill();ctx.restore();}}

function drawIceWaves(){for(const w of iceWaves){const p=1-w.life/w.maxLife,a=Math.atan2(w.dy,w.dx),r=w.range*p;ctx.save();ctx.translate(w.x,w.y);ctx.rotate(a);ctx.globalAlpha=.3*(1-p);const g=ctx.createRadialGradient(0,0,10,0,0,r);g.addColorStop(0,'#efffff');g.addColorStop(.45,'#8deeff');g.addColorStop(1,'#73bfff00');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,-w.angle,w.angle);ctx.closePath();ctx.fill();ctx.globalAlpha=.85;ctx.strokeStyle='#dffcff';ctx.lineWidth=3;for(let i=0;i<5;i++){const aa=-w.angle+i*(w.angle*2/4),rr=r*rand(.65,.95);ctx.beginPath();ctx.moveTo(Math.cos(aa)*rr*.4,Math.sin(aa)*rr*.4);ctx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr);ctx.stroke();}ctx.restore();}}

function drawFireballs(){for(const f of fireballs){const a=Math.atan2(f.vy,f.vx);ctx.save();ctx.translate(f.x,f.y-(f.z||0));ctx.rotate(a);ctx.globalAlpha=.35;ctx.fillStyle='#ff6b1f';ctx.beginPath();ctx.ellipse(-f.r*1.35,0,f.r*1.75,f.r*.65,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;const g=ctx.createRadialGradient(-5,-6,3,0,0,f.r+5);g.addColorStop(0,'#fff7ba');g.addColorStop(.35,'#ffd447');g.addColorStop(1,'#f0441d');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,f.r,0,Math.PI*2);ctx.fill();ctx.restore();}}

function goal(team){goalScene={team,life:1.1};message='押し込み成功！';messageLife=1.3;chiefLine=team===0?'見事だ！ 褒美に近づいたぞ！':'押し返せー！ まだ終わっておらん！';chiefLife=2.2;shake=18;if(Math.max(...score)>=3)return endGame();reset(true);}
function collisions(){for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const a=players[i],b=players[j];if(a.respawnT>0||b.respawnT>0||a.buriedT>0||b.buriedT>0||a.wallStickT>0||b.wallStickT>0||a.isAirborne()||b.isAirborne())continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d<min){const n=norm(dx,dy),push=(min-d)*.62;a.x-=n.x*push;b.x+=n.x*push;a.y-=n.y*push;b.y+=n.y*push;const repel=95+(min-d)*10;a.vx-=n.x*repel;b.vx+=n.x*repel;a.vy-=n.y*repel;b.vy+=n.y*repel;if(a.frozen>0){a.vx-=n.x*360;a.vy-=n.y*360;}if(b.frozen>0){b.vx+=n.x*360;b.vy+=n.y*360;}}}
 for(const p of players){if(p.respawnT>0||p.buriedT>0||p.wallStickT>0||p.isAirborne())continue;const dx=slime.x-p.x,dy=slime.y-p.y,d=Math.hypot(dx,dy),min=p.r+slime.r;if(d<min){const n=norm(dx,dy),push=min-d;slime.x+=n.x*push;slime.y+=n.y*push;const boost=slime.frozen>0?430:80;slime.vx+=n.x*boost;slime.vy+=n.y*boost;slime.scared=.35;if(slime.frozen>0){message='凍ったスライムがツルーッ！';messageLife=.7;}}}}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,7),s=rand(50,240);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),color});}}
function updateParticles(dt){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;}particles=particles.filter(p=>p.life>0);}
function draw(){ctx.save();if(shake)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawField();drawChiefs();for(const p of players)p.draw();drawSlime();drawFireballs();drawIceWaves();drawRockBalls();drawHurricanes();drawGoalScene();for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fill();}ctx.globalAlpha=1;drawHud();ctx.restore();}
function drawField(){
 const isBrifo=currentStage===1,isSalubie=currentStage===2,isSalubibi=currentStage===3,isTakezo=currentStage===4;
 const opponentBase=isBrifo?'#dff4fb':isSalubie?'#7c4938':isSalubibi?'#71bfae':'#6f614c';
 const opponentLight=isBrifo?'#edfaff':isSalubie?'#b97955':isSalubibi?'#a9dfc4':'#9b886b';
 const opponentMid=isBrifo?'#b9dce8':isSalubie?'#9c6248':isSalubibi?'#65b99b':'#7f6f57';
 const opponentDark=isBrifo?'#7899aa':isSalubie?'#5c3027':isSalubibi?'#357866':'#4d4234';

 // 画面外周も左右それぞれの村の景色。
 ctx.fillStyle='#77a957';ctx.fillRect(0,0,W/2,H);
 ctx.fillStyle=opponentBase;ctx.fillRect(W/2,0,W/2,H);

 // 左：ぷれん村の素朴な地面模様
 for(let y=0;y<H;y+=42)for(let x=(y/42%2)*24;x<W/2;x+=48){
  ctx.fillStyle=((x+y)/48)%2?'#8dbc68':'#67974c';ctx.fillRect(x,y,25,3);
 }
 // 右：対戦村の地面模様
 for(let y=0;y<H;y+=42)for(let x=W/2+(y/42%2)*24;x<W;x+=48){
  ctx.fillStyle=isBrifo?(((x+y)/48)%2?'#c5e7f2':'#eefbff'):isSalubie?(((x+y)/48)%2?'#8f5843':'#6f3f31'):isSalubibi?(((x+y)/48)%2?'#7bcbb2':'#59a78f'):(((x+y)/48)%2?'#806f58':'#5e5241');
  ctx.fillRect(x,y,25,3);
 }

 drawVillage(0,0);drawVillage(1,W);

 // 削り取られた外縁。左は土、右は氷崖または焼けた岩。
 ctx.save();ctx.translate(FIELD.cx,FIELD.cy);
 ctx.beginPath();ctx.ellipse(0,0,FIELD.rx+25,FIELD.ry+25,0,0,Math.PI*2);ctx.clip();

 ctx.fillStyle='#6f5538';ctx.fillRect(-FIELD.rx-35,-FIELD.ry-35,FIELD.rx+35,(FIELD.ry+35)*2);
 ctx.fillStyle=opponentDark;ctx.fillRect(0,-FIELD.ry-35,FIELD.rx+35,(FIELD.ry+35)*2);

 ctx.strokeStyle='#493a26';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,FIELD.rx+25,FIELD.ry+25,0,0,Math.PI*2);ctx.stroke();
 ctx.restore();

 // コート内側も中央線で景色が切り替わる。
 ctx.save();ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx+8,FIELD.ry+8,0,0,Math.PI*2);ctx.clip();
 ctx.fillStyle='#789b55';ctx.fillRect(FIELD.cx-FIELD.rx-12,FIELD.cy-FIELD.ry-12,FIELD.rx+12,(FIELD.ry+12)*2);
 ctx.fillStyle=opponentMid;ctx.fillRect(FIELD.cx,FIELD.cy-FIELD.ry-12,FIELD.rx+12,(FIELD.ry+12)*2);

 ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx-4,FIELD.ry-4,0,0,Math.PI*2);ctx.clip();
 ctx.fillStyle='#92bd69';ctx.fillRect(FIELD.cx-FIELD.rx,FIELD.cy-FIELD.ry,FIELD.rx,FIELD.ry*2);
 ctx.fillStyle=opponentLight;ctx.fillRect(FIELD.cx,FIELD.cy-FIELD.ry,FIELD.rx,FIELD.ry*2);

 // ぷれん村側：草、白と黄色の花、踏み固められた土。
 ctx.globalAlpha=.65;
 for(let i=0;i<34;i++){
  const x=110+(i*73)%380,y=135+(i*49)%360;
  ctx.fillStyle=i%3===0?'#ffffff':i%3===1?'#f2d44f':'#4f813f';
  ctx.beginPath();ctx.arc(x,y,2+(i%2),0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;

 // 対戦村側だけにステージ固有の空気感。
 if(isBrifo){
  ctx.save();ctx.beginPath();ctx.rect(W/2,0,W/2,H);ctx.clip();ctx.globalAlpha=.74;
  for(let i=0;i<30;i++){const x=W/2+((i*83+portalTime*18)%(W/2)),y=(i*47+portalTime*28)%H;ctx.fillStyle=i%3?'#ffffff':'#c7efff';ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill();}
  ctx.restore();
  ctx.fillStyle='#bceeff';ctx.strokeStyle='#6ebbd2';ctx.lineWidth=2;
  for(let i=0;i<6;i++){const x=545+i*70,top=i%2?102:118;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x+9,top);ctx.lineTo(x+4,top+25+(i%3)*7);ctx.closePath();ctx.fill();ctx.stroke();}
 }else if(isSalubie){
  ctx.save();ctx.beginPath();ctx.rect(W/2,0,W/2,H);ctx.clip();
  for(let i=0;i<26;i++){const x=W/2+((i*91+portalTime*(20+i%4*8))%(W/2)),y=H-((i*53+portalTime*(36+i%3*14))%H);ctx.globalAlpha=.35+(i%4)*.12;ctx.fillStyle=i%3?'#ff9b3d':'#ffd36a';ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=.2;ctx.fillStyle='#2c1b1a';
  for(let i=0;i<4;i++){const x=590+i*115+Math.sin(portalTime*.35+i)*14,y=105+(i%2)*38;ctx.beginPath();ctx.arc(x,y,27+i%2*8,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  ctx.strokeStyle='#4e2d25';ctx.lineWidth=3;ctx.globalAlpha=.55;
  for(let y=145;y<505;y+=34)for(let x=530+(y/34%2)*18;x<900;x+=42)ctx.strokeRect(x,y,36,24);
  ctx.globalAlpha=1;
 }else if(isSalubibi){
  ctx.save();ctx.beginPath();ctx.rect(W/2,0,W/2,H);ctx.clip();
  for(let i=0;i<24;i++){const x=W/2+((i*97+portalTime*(55+i%3*12))%(W/2)),y=110+(i*43)%390;ctx.globalAlpha=.28+(i%4)*.12;ctx.strokeStyle=i%2?'#effff8':'#b9f5df';ctx.lineWidth=3+(i%2);ctx.beginPath();ctx.moveTo(x-24,y);ctx.quadraticCurveTo(x,y-8,x+32,y);ctx.stroke();}
  ctx.restore();
  for(let i=0;i<4;i++){const x=570+i*105,y=128+(i%2)*42;ctx.strokeStyle='#386858';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+72);ctx.stroke();ctx.fillStyle=i%2?'#2db7b1':'#8ce6d3';ctx.beginPath();ctx.moveTo(x+2,y+5);ctx.lineTo(x+42,y+17);ctx.lineTo(x+2,y+29);ctx.closePath();ctx.fill();}
  const wx=805,wy=205,spin=portalTime*2.4;ctx.strokeStyle='#e8fff6';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx,365);ctx.stroke();ctx.save();ctx.translate(wx,wy);ctx.rotate(spin);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillStyle='#dffff4';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,-9);ctx.lineTo(70,-3);ctx.lineTo(70,8);ctx.lineTo(18,9);ctx.closePath();ctx.fill();}ctx.restore();
 }else{
  // たけぞ村：竹林、石垣、土煙
  ctx.save();ctx.beginPath();ctx.rect(W/2,0,W/2,H);ctx.clip();
  ctx.globalAlpha=.22;ctx.fillStyle='#d8c6a4';
  for(let i=0;i<18;i++){const x=540+(i*61)%430,y=130+(i*47)%360;ctx.beginPath();ctx.arc(x,y,10+(i%3)*5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  for(let i=0;i<8;i++){
   const x=550+i*53,h=120+(i%3)*25;ctx.strokeStyle='#3f6b3a';ctx.lineWidth=9;
   ctx.beginPath();ctx.moveTo(x,500);ctx.lineTo(x,500-h);ctx.stroke();
   ctx.strokeStyle='#274d28';ctx.lineWidth=2;for(let y=500-h+18;y<500;y+=28){ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.stroke();}
   ctx.fillStyle='#548650';ctx.beginPath();ctx.ellipse(x-13,500-h+25,18,7,-.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(x+14,500-h+46,18,7,.5,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#5c5248';ctx.strokeStyle='#342d27';ctx.lineWidth=3;
  for(let row=0;row<4;row++)for(let col=0;col<7;col++){const x=610+col*46+(row%2)*20,y=400+row*27;ctx.beginPath();ctx.roundRect(x,y,40,22,5);ctx.fill();ctx.stroke();}
 }
 ctx.restore();

 // 縁の石も左右で材質を変える。
 for(let i=0;i<38;i++){
  const a=i/38*Math.PI*2,x=FIELD.cx+Math.cos(a)*(FIELD.rx+18),y=FIELD.cy+Math.sin(a)*(FIELD.ry+18);
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  ctx.fillStyle=x<FIELD.cx?'#708f4d':(isBrifo?'#8fc9dd':isSalubie?'#6c3c2d':isSalubibi?'#438b75':'#665846');
  ctx.beginPath();ctx.roundRect(-12,-7,24,14,5);ctx.fill();ctx.restore();
 }

 // 競技線
 ctx.strokeStyle='#fff9';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx-24,FIELD.ry-24,0,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(500,112);ctx.lineTo(500,520);ctx.stroke();ctx.setLineDash([]);
 ctx.beginPath();ctx.arc(500,316,72,0,Math.PI*2);ctx.stroke();

 // 村へつながる破れた入口
 drawBrokenGate(0,FIELD.goalT,FIELD.goalB,0);drawBrokenGate(905,FIELD.goalT,FIELD.goalB,1);

 // 中心のゲートも左右の色が混ざる。
 const pulse=1+Math.sin(performance.now()/260)*.08;
 ctx.save();ctx.translate(500,316);ctx.scale(pulse,1/pulse);
 const glow=ctx.createRadialGradient(0,0,2,0,0,52);
 glow.addColorStop(0,'#fff');
 glow.addColorStop(.22,'#fff4aa');
 glow.addColorStop(.48,isBrifo?'#a9efff':isSalubie?'#ffb35e':isSalubibi?'#b9ffe7':'#e8c68a');
 glow.addColorStop(.72,isBrifo?'#4aa8dc':isSalubie?'#d94b28':isSalubibi?'#29a78e':'#8b643b');
 glow.addColorStop(1,'#2b163d00');
 ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,52,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=isBrifo?'#dffcff':isSalubie?'#ffe2a6':isSalubibi?'#e5fff6':'#ffe0a8';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,24,10,0,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<4;i++){
  const a=portalTime*(1.7+i*.24)+i*1.55,r=17+i*5;
  ctx.fillStyle=i%2?'#fff1a8':(isBrifo?'#62d6ff':isSalubie?'#ff6b32':isSalubibi?'#55dfc3':'#b9874f');ctx.globalAlpha=.8;
  ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r*.46,3+i*.45,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();ctx.globalAlpha=1;
}
function drawVillage(team,edge){
 const left=team===0,x0=left?0:910;
 const isHome=left;
 const isBrifo=!left&&currentStage===1;
 const isSalubie=!left&&currentStage===2,isSalubibi=!left&&currentStage===3,isTakezo=!left&&currentStage===4;
 const villageName=isHome?homeVillageName():(isBrifo?'ぶりふぉ村':isSalubie?'さるびえ村':isSalubibi?'さるびび村':'たけぞ村');
 const villageColor=isHome?'#fff4a8':(isBrifo?'#79cfe9':isSalubie?'#7b2438':isSalubibi?'#29b8b4':'#ec73ad');

 // 村の地面
 ctx.fillStyle=isHome?'#78a958':(isBrifo?'#c9effa':isSalubie?'#754338':isSalubibi?'#6fbaa4':'#6e604d');ctx.fillRect(x0,172,90,286);

 // 家
 for(let i=0;i<3;i++){
  const yy=192+i*82;
  ctx.fillStyle=isHome?'#f1ead0':(isBrifo?'#e7f7fb':isSalubie?'#a66850':isSalubibi?'#d9f4e9':'#d8c7a8');ctx.fillRect(x0+7,yy,72,48);
  ctx.fillStyle=isHome?'#e0c95e':(isBrifo?'#77cce7':isSalubie?'#562335':isSalubibi?'#258d86':'#24375f');ctx.beginPath();ctx.moveTo(x0+2,yy);ctx.lineTo(x0+43,yy-28);ctx.lineTo(x0+84,yy);ctx.closePath();ctx.fill();
  ctx.fillStyle='#744629';ctx.fillRect(x0+17,yy+20,15,28);
  ctx.fillStyle=isHome?'#fff6ba':(isBrifo?'#9bd1df':isSalubie?'#ffb45d':isSalubibi?'#bff9ea':'#f3a6cc');ctx.fillRect(x0+47,yy+13,18,15);
  if(isSalubie){
   ctx.fillStyle='#3b2724';ctx.fillRect(x0+62,yy-29,10,27);
   ctx.globalAlpha=.35;ctx.fillStyle='#2b2020';ctx.beginPath();ctx.arc(x0+67,yy-39-(i%2)*8,10+i*2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
 }

 // 村旗
 ctx.strokeStyle='#55341f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(left?30:970,116);ctx.lineTo(left?30:970,180);ctx.stroke();
 ctx.fillStyle=villageColor;ctx.beginPath();ctx.moveTo(left?32:968,120);ctx.lineTo(left?77:923,134);ctx.lineTo(left?32:968,148);ctx.closePath();ctx.fill();

 // 村名札
 ctx.fillStyle='#f5e7c0';ctx.strokeStyle='#5a3a25';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x0+5,153,80,31,7);ctx.fill();ctx.stroke();
 ctx.fillStyle='#3a2a1f';ctx.font='900 14px sans-serif';ctx.textAlign='center';ctx.fillText(villageName,left?45:955,174);

 // 壊れた塀
 ctx.fillStyle=isHome?'#8b7148':(isBrifo?'#a8e2f2':isSalubie?'#824b39':isSalubibi?'#4b9b86':'#5b4d3f');for(let y=202;y<440;y+=27)ctx.fillRect(left?82:900,y,18,18);

 // 荷車と樽
 ctx.fillStyle='#704526';ctx.fillRect(left?8:942,474,48,18);ctx.strokeStyle='#2f2118';ctx.lineWidth=5;ctx.beginPath();ctx.arc(left?18:952,495,10,0,Math.PI*2);ctx.arc(left?49:983,495,10,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#9b6a3b';ctx.beginPath();ctx.roundRect(left?60:914,468,24,34,6);ctx.fill();

 // 村固有の装飾
 if(isHome){
  // ぷれん村：白と黄色の素朴な花壇
  const fx=42,fy=445;ctx.fillStyle='#8b6a36';ctx.fillRect(fx-26,fy+14,52,9);
  for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#fff':'#ffe45c';ctx.beginPath();ctx.arc(fx-22+i*11,fy+4+(i%2)*5,5,0,Math.PI*2);ctx.fill();}
 }else if(isBrifo){
  const sx=958;ctx.fillStyle='#fff';ctx.strokeStyle='#8fc9dd';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(sx,450,18,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(sx,423,13,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ef8a35';ctx.beginPath();ctx.moveTo(sx,423);ctx.lineTo(sx-15,427);ctx.lineTo(sx,430);ctx.closePath();ctx.fill();
 }else if(isSalubie){
  const fx=958,fy=446;
  const glow=ctx.createRadialGradient(fx,fy,2,fx,fy,37);glow.addColorStop(0,'#fff3a4');glow.addColorStop(.4,'#ff8b32');glow.addColorStop(1,'#ff3e1600');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(fx,fy,37,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3a2d2a';ctx.fillRect(fx-24,fy+16,48,10);
 }else if(isSalubibi){
  const wx=958,wy=435;ctx.strokeStyle='#4c796a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx,493);ctx.stroke();
  ctx.save();ctx.translate(wx,wy);ctx.rotate(portalTime*2.6);ctx.fillStyle='#e5fff6';
  for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillRect(5,-4,25,8);}ctx.restore();
 }else{
  const bx=952;ctx.strokeStyle='#355a32';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(bx,500);ctx.lineTo(bx,418);ctx.stroke();
  ctx.fillStyle='#4f7e48';ctx.beginPath();ctx.ellipse(bx-12,442,18,7,-.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(bx+13,462,18,7,.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4e443a';for(let i=0;i<3;i++){ctx.beginPath();ctx.roundRect(928+i*18,474-(i%2)*8,22,18,5);ctx.fill();}
 }

 for(let i=0;i<3;i++)drawSpectator(left?24+i*25:926+i*25,535+(i%2)*7,team,i);
}
function drawSpectator(x,y,team,i){
 const bounce=Math.sin(performance.now()/220+i*1.7)*3;ctx.save();ctx.translate(x,y+bounce);
 ctx.fillStyle=team===0?'#fff4a8':(currentStage===1?'#8edcff':currentStage===2?'#7b2438':currentStage===3?'#29b8b4':'#ec73ad');ctx.fillRect(-7,-2,14,18);ctx.fillStyle='#f2c895';ctx.beginPath();ctx.arc(0,-10,7,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#51321f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-5,3);ctx.lineTo(-12,-5);ctx.moveTo(5,3);ctx.lineTo(12,-7);ctx.stroke();ctx.restore();
}
function drawBrokenGate(x,top,bottom,team){
 ctx.fillStyle=teamColor(team);ctx.globalAlpha=.72;ctx.fillRect(x,top,95,bottom-top);ctx.globalAlpha=1;
 ctx.fillStyle='#6d4728';ctx.fillRect(x,top-13,95,13);ctx.fillRect(x,bottom,95,13);
 ctx.fillStyle='#d0ae70';for(let i=0;i<4;i++){const xx=team===0?72+i*10:905+i*10;ctx.beginPath();ctx.arc(xx,top-5-(i%2)*8,9,0,7);ctx.fill();ctx.beginPath();ctx.arc(xx,bottom+5+(i%2)*8,9,0,7);ctx.fill();}
}
function drawChiefs(){drawChief(105,42,0);drawChief(895,42,1);if(chiefLife>0){ctx.fillStyle='#fff';ctx.strokeStyle='#573d28';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(330,66,340,42,12);ctx.fill();ctx.stroke();ctx.fillStyle='#2c241d';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText(chiefLine,500,93);}}
function drawChief(x,y,team){ctx.save();ctx.translate(x,y);ctx.fillStyle='#f1c798';ctx.strokeStyle='#4b3021';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,21,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#eee';ctx.beginPath();ctx.arc(0,15,17,0,Math.PI);ctx.fill();ctx.fillStyle=teamColor(team);ctx.fillRect(-22,21,44,14);ctx.fillStyle='#2a1812';ctx.beginPath();ctx.arc(-7,-4,2,0,7);ctx.arc(7,-4,2,0,7);ctx.fill();ctx.restore();}
function drawSlime(){
 const speed=Math.hypot(slime.vx,slime.vy),squash=clamp(speed/900,0,.3),hop=slime.hop>0?Math.sin((1-slime.hop/Math.max(.01,slime.hopMax||.58))*Math.PI)*26:0;
 const wob=Math.sin(performance.now()/120)*.035;
 if(slime.airVolleyT>0){
  ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle='#fff4b5';ctx.lineWidth=8;
  ctx.beginPath();ctx.moveTo(slime.x-Math.sign(slime.vx)*72,slime.y-hop);ctx.lineTo(slime.x-Math.sign(slime.vx)*24,slime.y-hop);ctx.stroke();ctx.restore();
 }
 ctx.save();ctx.translate(slime.x,slime.y-hop);ctx.rotate(slime.airVolleyT>0?slime.airSpin:slime.wobble*.08);ctx.scale(1+squash+wob,1-squash-wob);
 const g=ctx.createRadialGradient(-10,-15,4,0,0,45);g.addColorStop(0,'#e8fbff');g.addColorStop(.35,'#61ccff');g.addColorStop(1,'#0874da');ctx.fillStyle=g;ctx.strokeStyle='#073d92';ctx.lineWidth=5;
 ctx.beginPath();ctx.moveTo(-34,10);ctx.quadraticCurveTo(-42,-12,-22,-25);ctx.quadraticCurveTo(0,-42,23,-25);ctx.quadraticCurveTo(44,-10,34,13);ctx.quadraticCurveTo(0,34,-34,10);ctx.fill();ctx.stroke();
 ctx.fillStyle='#fff';ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(-13,-18,10,7,-.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 ctx.fillStyle='#063a78';ctx.beginPath();if(slime.blinkT>0){ctx.ellipse(-10,-4,4,1,0,0,7);ctx.ellipse(10,-4,4,1,0,0,7);}else{const look=clamp(slime.vx/240,-2,2);ctx.arc(-10+look,-4,3,0,Math.PI*2);ctx.arc(10+look,-4,3,0,Math.PI*2);}ctx.fill();
 if(slime.type==='jumpy'){ctx.fillStyle='#ffe36a';ctx.strokeStyle='#7a5b00';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-9,-31);ctx.lineTo(-3,-44);ctx.lineTo(3,-31);ctx.lineTo(10,-45);ctx.lineTo(14,-27);ctx.closePath();ctx.fill();ctx.stroke();}
 ctx.strokeStyle='#063a78';ctx.lineWidth=3;ctx.beginPath();if(slime.scared>0){ctx.arc(0,7,5,0,Math.PI*2);}else{ctx.arc(0,4,7,.15,Math.PI-.15);}ctx.stroke();ctx.restore();if(slime.frozen>0){ctx.save();ctx.globalAlpha=.48;ctx.fillStyle='#bff7ff';ctx.strokeStyle='#edffff';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(slime.x-45,slime.y-hop-45,90,82,22);ctx.fill();ctx.stroke();ctx.restore();}
 // 本当に微かな臭い
 ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle='#d7e78a';ctx.lineWidth=5;for(let i=0;i<2;i++){const t=performance.now()/700+i*1.8;ctx.beginPath();ctx.moveTo(slime.x-8+i*16,slime.y-hop-40);ctx.bezierCurveTo(slime.x-20+i*18,slime.y-hop-58,slime.x+14-i*8,slime.y-hop-69,slime.x-2+i*10,slime.y-hop-86);ctx.stroke();}ctx.restore();
}

function drawGoalScene(){
 if(!goalScene)return;
 const t=1-goalScene.life/1.1,dir=goalScene.team===0?1:-1,x=goalScene.team===0?915:85;
 ctx.save();ctx.globalAlpha=Math.sin(Math.min(1,t)*Math.PI)*.95;
 ctx.fillStyle='#fff4c2';ctx.strokeStyle='#5a3b25';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(x-74,204,148,48,14);ctx.fill();ctx.stroke();
 ctx.fillStyle='#3a291e';ctx.font='900 18px sans-serif';ctx.textAlign='center';ctx.fillText('うわっ、臭い！',x,235);
 for(let i=0;i<3;i++){const sx=x+dir*(18+i*20),sy=302+i*28;drawSpectator(sx,sy,goalScene.team?1:0,i);}
 ctx.restore();
}
function drawHud(){
 ctx.fillStyle='#10202be8';ctx.beginPath();ctx.roundRect(300,7,400,59,13);ctx.fill();
 ctx.fillStyle='#8ed7ff';ctx.textAlign='right';ctx.font='900 16px sans-serif';ctx.fillText(playerVillageName(),420,28);
 ctx.fillStyle='#ffaaaa';ctx.textAlign='left';ctx.fillText(enemyVillageName(),580,28);
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 30px sans-serif';ctx.fillText(`${score[0]} － ${score[1]}`,500,38);
 ctx.font='bold 13px sans-serif';ctx.fillStyle='#ffeeb0';ctx.fillText(`押し付け数　　残り ${Math.ceil(timeLeft)}秒　　3回で褒美！`,500,58);
 // 褒美までの簡易印
 for(let team=0;team<2;team++)for(let i=0;i<3;i++){ctx.fillStyle=i<score[team]?'#ffd85a':'#ffffff33';ctx.beginPath();ctx.arc(team===0?265-i*18:735+i*18,37,6,0,Math.PI*2);ctx.fill();}
 if(messageLife>0){ctx.fillStyle='#fff4a3';ctx.font='900 36px sans-serif';ctx.fillText(message,500,145);}if(freeze>0){ctx.fillStyle='#b9efff';ctx.font='900 25px sans-serif';ctx.fillText(`TIME STOP ${freeze.toFixed(1)}`,500,174);}
 ctx.textAlign='left';ctx.font='bold 14px sans-serif';ctx.fillStyle='#fff';const spirit=players.find(p=>p.isHuman)?.spirit||selectedSpirit;ctx.fillText(spirit==='plain'?'ぷれん：強いフィジカル＋ホームランジャンプキック':spirit==='earth'?'土：ロックキャノン＋強烈なアースキック':spirit==='ice'?'氷：コールドブレス＋凍結するアイスキック':spirit==='wind'?'風：ハリケーン＋吹き飛ばすウインドキック':'炎：ファイアボール＋燃えるファイアキック',18,585);
}
function loop(t){if(!running)return;const dt=Math.min(.033,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop);}

addEventListener('keydown',e=>{keys[e.key]=true;keys[e.key.toLowerCase()]=true;e.preventDefault();});addEventListener('keyup',e=>{keys[e.key]=false;keys[e.key.toLowerCase()]=false;});
// 開始ボタンは読み込み演出とは切り離し、最初から押せるようにする。
// 一部の折りたたみ端末/WebViewでclickが落ちる場合に備え、pointerupも受ける。
let startLock=false;
function startFromIntro(e){
 // Android WebViewや折りたたみ端末でも確実に開始できるよう、
 // class切替だけに頼らず要素の表示状態を直接切り替える。
 if(startLock||running)return false;
 startLock=true;
 try{
  const checked=document.querySelector('input[name="spirit"]:checked');
  if(checked)applySpirit(checked.value);
  ui.startBtn.textContent='開始します…';
  ui.startBtn.disabled=true;
  ui.intro.classList.add('hidden');
  ui.intro.style.display='none';
  ui.result.classList.add('hidden');
  ui.result.style.display='none';
  ui.controls.classList.remove('hidden');
  ui.controls.style.display='block';
  // 画面切替を先に描画させてからゲーム初期化する。
  setTimeout(()=>{
   try{ startGame(); }
   catch(err){
    console.error(err);
    running=false;
    ui.intro.style.display='grid';
    ui.intro.classList.remove('hidden');
    ui.controls.style.display='none';
    ui.controls.classList.add('hidden');
    ui.startBtn.disabled=false;
    ui.startBtn.textContent='もう一度開始する';
    if(ui.loadingText)ui.loadingText.textContent='開始処理でエラーが発生しました。もう一度お試しください。';
    startLock=false;
   }
  },0);
 }catch(err){
  console.error(err);
  startLock=false;
  ui.startBtn.disabled=false;
 }
 return false;
}
window.startSlimeGame=startFromIntro;

const loadingLines=['異次元の穴を安定させています…','削れた土壁を点検中…','村人を招集中…','少し臭うスライムを確認中…','村長が褒美を準備中…','押し付け合いの準備完了！'];
let loadIndex=0;
const loadingTimer=setInterval(function(){
 loadIndex++;
 ui.loadingText.textContent=loadingLines[Math.min(loadIndex,loadingLines.length-1)];
 if(loadIndex>=loadingLines.length-1)clearInterval(loadingTimer);
},420);

// 精霊選択はブラウザ標準のラジオボタンを使う。
// 初期描画より先に登録し、描画互換エラーの影響を受けないようにする。
const spiritNames={plain:'ぷれん',fire:'炎',ice:'氷',wind:'風',earth:'土'};
function applySpirit(value){
 if(!spiritNames[value])return;
 selectedSpirit=value;
 ui.skillBtn.textContent=value==='plain'?'気合い':value==='ice'?'冷気':value==='wind'?'竜巻':value==='earth'?'岩砲':'火球';
 if(ui.spiritStatus)ui.spiritStatus.textContent='選択中：'+spiritNames[value];
}
const spiritRadios=document.querySelectorAll('input[name="spirit"]');
for(let i=0;i<spiritRadios.length;i++){
 spiritRadios[i].addEventListener('change',function(){if(this.checked)applySpirit(this.value);});
}
let firstChecked=document.querySelector('input[name="spirit"]:checked');
applySpirit(firstChecked?firstChecked.value:'plain');
refreshSpiritLocks();

// 説明文領域では縦スクロールを優先する。
ui.introScroll.addEventListener('pointerdown',function(e){e.stopPropagation();});
ui.introScroll.addEventListener('pointermove',function(e){e.stopPropagation();});
ui.introScroll.addEventListener('wheel',function(e){e.stopPropagation();},{passive:true});

// 開始処理は1本だけにする。clickは通常のタップでも発火する。
ui.startBtn.disabled=false;

function showClearSequence(){
 const newlyUnlocked=unlockSpirit('ice');
 clearSequence=true;
 if(ui.clearCard){
  ui.clearCard.classList.remove('hidden');
  ui.clearCard.style.display='flex';
 }else{
  clearSequence=false;
  ui.result.classList.remove('hidden');
  ui.result.style.display='grid';
  ui.resultTitle.textContent='褒美獲得！';
  ui.resultText.textContent='❄ アイス技を習得！　次の接続先：🔥 さるびえ村';
  if(ui.nextStageBtn){ui.nextStageBtn.hidden=false;ui.nextStageBtn.textContent='さるびえ村へ進む';}
 }
 chiefLine='ぶりふぉ村の氷技を習得した！';chiefLife=2.4;
}
function closeClearSequence(){
 clearSequence=false;
 if(ui.clearCard){ui.clearCard.classList.add('hidden');ui.clearCard.style.display='none';}
 currentStage=2;selectedSlime='jumpy';
 if(ui.slimeSelect)ui.slimeSelect.value='jumpy';
 ui.result.classList.remove('hidden');ui.result.style.display='grid';
 ui.resultTitle.textContent='新たな異次元空間が発生！';
 ui.resultText.textContent='❄ アイス技を習得！　次の接続先：🔥 さるびえ村';
 if(ui.nextStageBtn){ui.nextStageBtn.hidden=false;ui.nextStageBtn.textContent='さるびえ村へ進む';}
}
if(ui.clearNextBtn)ui.clearNextBtn.addEventListener('click',closeClearSequence);

function backToMenu(){
 running=false;
 ui.controls.classList.add('hidden');ui.controls.style.display='none';
 ui.result.classList.add('hidden');ui.result.style.display='none';
 ui.intro.classList.remove('hidden');ui.intro.style.display='grid';
 if(ui.startBtn){
  ui.startBtn.disabled=false;
  ui.startBtn.classList.remove('disabled');
  ui.startBtn.textContent='村長の合図で開始';
 }
}
function nextStage(){
 currentStage=Math.min(4,currentStage+1);
 selectedSlime=currentStage>=2?'jumpy':'normal';
 if(ui.slimeSelect)ui.slimeSelect.value=selectedSlime;
 startGame();
}
if(ui.rematchBtn)ui.rematchBtn.addEventListener('click',startGame);
if(ui.menuBtn)ui.menuBtn.addEventListener('click',backToMenu);
if(ui.nextStageBtn)ui.nextStageBtn.addEventListener('click',nextStage);
if(ui.slimeSelect)ui.slimeSelect.addEventListener('change',e=>selectedSlime=e.target.value);

ui.startBtn.addEventListener('click',startFromIntro);
ui.retryBtn.addEventListener('click',startGame);

let stickId=null;
function stickMove(e){const r=ui.stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,d=Math.hypot(dx,dy)||1,k=Math.min(1,max/d);input.x=dx/d*k;input.y=dy/d*k;ui.knob.style.transform='translate('+input.x*max+'px,'+input.y*max+'px)';}
ui.stick.addEventListener('pointerdown',function(e){stickId=e.pointerId;ui.stick.setPointerCapture(e.pointerId);stickMove(e);});
ui.stick.addEventListener('pointermove',function(e){if(e.pointerId===stickId)stickMove(e);});
ui.stick.addEventListener('pointerup',function(e){if(e.pointerId===stickId){stickId=null;input.x=input.y=0;ui.knob.style.transform='';}});
document.querySelectorAll('[data-action]').forEach(function(b){
 b.addEventListener('pointerdown',function(e){input[b.dataset.action]=true;e.preventDefault();});
 b.addEventListener('pointerup',function(e){input[b.dataset.action]=false;e.preventDefault();});
 b.addEventListener('pointercancel',function(){input[b.dataset.action]=false;});
});

// タイトル画面の背景用に初期状態を作ってから描画する。
// 以前はslime未生成のままdraw()して例外が発生し、以降の初期化が止まっていた。
reset();
running=false;
draw();
