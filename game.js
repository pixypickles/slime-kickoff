'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const ui={intro:document.getElementById('intro'),result:document.getElementById('result'),controls:document.getElementById('controls'),startBtn:document.getElementById('startBtn'),retryBtn:document.getElementById('retryBtn'),resultTitle:document.getElementById('resultTitle'),resultText:document.getElementById('resultText'),loadingText:document.getElementById('loadingText'),skillBtn:document.querySelector('[data-action="skill"]'),stick:document.getElementById('stick'),knob:document.getElementById('knob')};
const W=1000,H=600,FIELD={cx:500,cy:316,rx:405,ry:216,goalT:238,goalB:394,gateDepth:92};
const keys={},input={x:0,y:0,dash:false,kick:false,jump:false,skill:false};
let players=[],slime,score=[0,0],timeLeft=75,running=false,last=0,message='',messageLife=0,shake=0,freeze=0,particles=[],fireballs=[],iceWaves=[],chiefLine='',chiefLife=0,chiefThink=0,portalTime=0,goalScene=null,selectedSpirit='fire';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
const rand=(a,b)=>a+Math.random()*(b-a);
const teamColor=t=>t?'#d95757':'#3e9cdc';

function insideEllipse(x,y,margin=0){const rx=FIELD.rx-margin,ry=FIELD.ry-margin;return ((x-FIELD.cx)**2)/(rx*rx)+((y-FIELD.cy)**2)/(ry*ry)<=1;}
function constrainToField(o){const inGate=o.y>FIELD.goalT&&o.y<FIELD.goalB;if(inGate&&o.x<FIELD.cx-FIELD.rx+o.r)return;if(inGate&&o.x>FIELD.cx+FIELD.rx-o.r)return;const rx=FIELD.rx-o.r,ry=FIELD.ry-o.r,dx=o.x-FIELD.cx,dy=o.y-FIELD.cy,q=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry);if(q>1){const k=1/Math.sqrt(q);o.x=FIELD.cx+dx*k;o.y=FIELD.cy+dy*k;const nx=dx/(rx*rx),ny=dy/(ry*ry),n=norm(nx,ny),dot=o.vx*n.x+o.vy*n.y;if(dot>0){o.vx-=1.75*dot*n.x;o.vy-=1.75*dot*n.y;}}}

class Player{
 constructor(team,x,y,isHuman=false,index=0){Object.assign(this,{team,x,y,isHuman,index,vx:0,vy:0,r:25,faceX:team?-1:1,faceY:0,dashTime:0,dashCd:0,kickCd:0,kickTime:0,jumpT:0,stun:0,burn:0,burnTick:0,frozen:0,rollAngle:0,speedBoost:0,skillCd:0,spirit:null,aiThink:0,aiX:0,aiY:0});}
 update(dt){
  this.dashCd=Math.max(0,this.dashCd-dt);this.kickCd=Math.max(0,this.kickCd-dt);this.skillCd=Math.max(0,this.skillCd-dt);this.stun=Math.max(0,this.stun-dt);this.burn=Math.max(0,this.burn-dt);this.frozen=Math.max(0,this.frozen-dt);this.speedBoost=Math.max(0,this.speedBoost-dt);this.kickTime=Math.max(0,this.kickTime-dt);this.jumpT=Math.max(0,this.jumpT-dt);if(this.burn>0){this.rollAngle+=dt*14;this.stun=Math.max(this.stun,.08);this.burnTick-=dt;if(this.burnTick<=0){this.burnTick=.12;const a=rand(0,Math.PI*2);this.vx+=Math.cos(a)*95;this.vy+=Math.sin(a)*95;burst(this.x+rand(-12,12),this.y-18,'#ff8b2c',2);}}
  let ix=0,iy=0,actions={};
  if(this.isHuman){ix=input.x+(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);iy=input.y+(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);actions={dash:input.dash||keys.Shift,kick:input.kick||keys.j,jump:input.jump||keys.k,skill:input.skill||keys.l};}
  else ({ix,iy,actions}=this.ai(dt));
  if(this.stun<=0&&this.frozen<=0){
   if(Math.hypot(ix,iy)>.15){const n=norm(ix,iy);this.faceX=n.x;this.faceY=n.y;let sp=this.dashTime>0?390:190;if(this.speedBoost>0)sp*=1.72;this.vx+=n.x*sp*dt*8;this.vy+=n.y*sp*dt*8;}
   if(actions.dash&&this.dashCd<=0){this.dashTime=.22;this.dashCd=.8;burst(this.x,this.y,teamColor(this.team),8);}
   if(actions.jump&&this.jumpT<=0)this.jumpT=.55;
   if(actions.kick&&this.kickCd<=0)this.kick();
   if(actions.skill&&this.skillCd<=0&&this.index===0)this.skill();
  }
  this.dashTime=Math.max(0,this.dashTime-dt);const drag=Math.pow(.0008,dt);this.vx*=drag;this.vy*=drag;this.x+=this.vx*dt;this.y+=this.vy*dt;constrainToField(this);
 }
 ai(dt){
  this.aiThink-=dt;if(this.aiThink<=0){this.aiThink=rand(.1,.25);const target=this.index===2?players.find(p=>p.team!==this.team&&p.index===0):slime;let tx=target.x,ty=target.y;if(this.index===1){tx+=(this.team?1:-1)*120;ty+=this.team?90:-90;}const n=norm(tx-this.x,ty-this.y);this.aiX=n.x;this.aiY=n.y;}
  const d=Math.hypot(slime.x-this.x,slime.y-this.y),enemyNear=players.some(p=>p.team!==this.team&&Math.hypot(p.x-this.x,p.y-this.y)<80);
  return{ix:this.aiX,iy:this.aiY,actions:{dash:d>150&&Math.random()<.03,kick:(d<92||enemyNear)&&Math.random()<.16,jump:d<110&&Math.random()<.025,skill:this.index===0&&this.skillCd<=0&&d<430&&Math.random()<.012}};
 }
 kick(){
  this.kickCd=.42;this.kickTime=.18;const sliding=this.dashTime>0,air=this.jumpT>0;let power=sliding?760:air?680:560;if(sliding&&air)power=900;const fx=this.faceX,fy=this.faceY,dx=slime.x-this.x,dy=slime.y-this.y;
  if(Math.hypot(dx,dy)<95+slime.r){const n=norm(dx+fx*25,dy+fy*25);slime.vx+=n.x*power;slime.vy+=n.y*power;slime.wobble+=rand(-2,2);shake=Math.max(shake,sliding?10:6);burst(slime.x,slime.y,'#b9efff',14);}
  for(const p of players){if(p===this||p.team===this.team)continue;const px=p.x-this.x,py=p.y-this.y,n=norm(px,py);if(Math.hypot(px,py)<88&&n.x*fx+n.y*fy>-.1){p.vx+=fx*power*.85;p.vy+=fy*power*.85;p.stun=Math.max(p.stun,sliding?.7:.35);shake=Math.max(shake,8);burst(p.x,p.y,'#fff1a3',10);}}
 }
 skill(){if(this.spirit==='ice')return this.coldBreath();if(this.spirit==='wind')return this.windBoost();this.skillCd=5.2;const n=norm(this.faceX,this.faceY);fireballs.push({x:this.x+n.x*42,y:this.y+n.y*42-6,vx:n.x*520,vy:n.y*520,team:this.team,owner:this,life:1.35,r:15,trail:0});message='ファイアボール！';messageLife=.8;shake=Math.max(shake,4);burst(this.x+n.x*35,this.y+n.y*35,'#ffb13b',14);}
 windBoost(){this.skillCd=2.4;this.speedBoost=1.35;const n=norm(this.faceX,this.faceY);this.vx+=n.x*240;this.vy+=n.y*240;message='風の加速！';messageLife=.65;burst(this.x,this.y,'#c8ffd4',22);}
 coldBreath(){this.skillCd=6.4;const n=norm(this.faceX,this.faceY);iceWaves.push({x:this.x+n.x*28,y:this.y+n.y*28,dx:n.x,dy:n.y,team:this.team,owner:this,life:.38,maxLife:.38,range:210,angle:.52});message='コールドブレス！';messageLife=.9;shake=Math.max(shake,3);burst(this.x+n.x*34,this.y+n.y*34,'#bff7ff',18);}
 draw(){
  const jump=this.jumpT>0?Math.sin((1-this.jumpT/.55)*Math.PI)*28:0;
  const ang=Math.atan2(this.faceY,this.faceX),kicking=this.kickTime>0;
  ctx.save();ctx.translate(this.x,this.y-jump);if(this.burn>0)ctx.rotate(this.rollAngle);
  ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(0,30+jump,31,10,0,0,Math.PI*2);ctx.fill();

  // 胴体は常に上向き。靴だけが移動・キック方向を向く。
  ctx.fillStyle=teamColor(this.team);ctx.strokeStyle=this.isHuman?'#ffe45c':'#fff';ctx.lineWidth=this.isHuman?5:3;
  ctx.beginPath();ctx.roundRect(-20,-7,40,42,11);ctx.fill();ctx.stroke();
  ctx.fillStyle=this.team?'#803737':'#25688f';ctx.fillRect(-15,17,30,7);

  ctx.save();ctx.rotate(ang);
  ctx.fillStyle='#6a4328';ctx.strokeStyle='#29180e';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(-7,23,21,12,-.18,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.ellipse(kicking?38:15,kicking?2:23,kicking?29:22,12,kicking?-.08:.18,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#d9b36c';ctx.fillRect(kicking?28:6,kicking?-3:18,kicking?22:18,5);
  ctx.restore();

  // 頭・顔は画面上向きに固定。
  ctx.fillStyle='#f2c895';ctx.strokeStyle='#5d3924';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-25,19,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=this.spirit==='ice'?'#b7efff':this.spirit==='fire'?'#d9482f':this.spirit==='wind'?'#85d69a':'#53321f';ctx.beginPath();ctx.arc(0,-31,15,Math.PI,Math.PI*2);ctx.fill();if(this.spirit==='fire'){ctx.fillStyle='#ffcf45';ctx.beginPath();ctx.moveTo(-12,-39);ctx.quadraticCurveTo(-4,-58,1,-41);ctx.quadraticCurveTo(10,-58,13,-37);ctx.closePath();ctx.fill();}
  if(this.spirit==='ice'){ctx.fillStyle='#e9fdff';ctx.beginPath();ctx.moveTo(-14,-38);ctx.lineTo(-5,-55);ctx.lineTo(0,-40);ctx.lineTo(8,-56);ctx.lineTo(14,-37);ctx.closePath();ctx.fill();}
  if(this.spirit==='wind'){ctx.strokeStyle='#e2ffe9';ctx.lineWidth=5;ctx.beginPath();ctx.arc(-2,-39,15,Math.PI*1.05,Math.PI*1.9);ctx.stroke();ctx.beginPath();ctx.arc(5,-43,10,Math.PI*.9,Math.PI*1.75);ctx.stroke();}
  ctx.fillStyle='#2b1b15';ctx.beginPath();ctx.arc(-6,-25,2.3,0,Math.PI*2);ctx.arc(6,-25,2.3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#8a4d3b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-19,5,.2,Math.PI-.2);ctx.stroke();
  ctx.restore();
  if(this.speedBoost>0){ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle='#d9ffe2';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(this.x-38-i*8,this.y-18+i*14);ctx.lineTo(this.x-68-i*12,this.y-18+i*14);ctx.stroke();}ctx.restore();}
  if(this.frozen>0){ctx.save();ctx.globalAlpha=.55;ctx.fillStyle='#bff7ff';ctx.strokeStyle='#ecffff';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(this.x-30,this.y-jump-55,60,95,15);ctx.fill();ctx.stroke();ctx.restore();ctx.font='23px sans-serif';ctx.fillText('❄️',this.x-13,this.y-jump-65);}
  if(this.stun>0&&this.burn<=0&&this.frozen<=0){ctx.font='24px sans-serif';ctx.fillText('★',this.x-12,this.y-jump-58);}if(this.burn>0){ctx.font='25px sans-serif';ctx.fillText('🔥',this.x-13,this.y-jump-62);}if(this.skillCd>0&&this.index===0){ctx.fillStyle='#0009';ctx.fillRect(this.x-24,this.y+40,48,5);ctx.fillStyle=this.spirit==='ice'?'#8deeff':this.spirit==='wind'?'#87eda2':'#ff8b2c';const maxCd=this.spirit==='ice'?6.4:this.spirit==='wind'?2.4:5.2;ctx.fillRect(this.x-24,this.y+40,48*(1-this.skillCd/maxCd),5);}
 }
}

function reset(afterGoal=false){players=[];for(let i=0;i<3;i++){const a=new Player(0,250,[225,310,395][i],i===0,i),b=new Player(1,750,[225,310,395][i],false,i);if(i===0){a.spirit=selectedSpirit;b.spirit=selectedSpirit==='fire'?'ice':selectedSpirit==='ice'?'wind':'fire';}players.push(a,b);}slime={x:500,y:310,vx:0,vy:0,r:37,wobble:0,think:rand(1.5,3.5),hop:0,blink:rand(1.2,3.4),blinkT:0,startT:afterGoal?0:.9,startY:316,scared:0,frozen:0};if(afterGoal)for(const p of players)p.stun=.45;message='押し付け合い、始めぇぇ！！';messageLife=1.2;chiefLine='相手の村へ押し込め！ 褒美は弾むぞ！';chiefLife=2.5;chiefThink=rand(4,7);goalScene=null;}
function startGame(){score=[0,0];timeLeft=75;particles=[];fireballs=[];iceWaves=[];freeze=0;running=true;ui.intro.classList.add('hidden');ui.result.classList.add('hidden');ui.controls.classList.remove('hidden');reset();last=performance.now();requestAnimationFrame(loop);}
function endGame(){running=false;ui.controls.classList.add('hidden');ui.result.classList.remove('hidden');const win=score[0]>score[1],draw=score[0]===score[1];ui.resultTitle.textContent=draw?'引き分け！':win?'褒美獲得！':'スライムを押し付けられた…';ui.resultText.textContent=`あなたの村 ${score[0]} － ${score[1]} となり村`;}
function update(dt){if(!running)return;timeLeft-=dt;if(timeLeft<=0)return endGame();portalTime+=dt;messageLife=Math.max(0,messageLife-dt);chiefLife=Math.max(0,chiefLife-dt);chiefThink-=dt;if(chiefThink<=0&&chiefLife<=0){const lines=['押し返せー！','褒美は目の前だぞ！','臭いのは向こうへやれ！','靴を止めるなー！','おおっ、その調子だ！'];chiefLine=lines[(Math.random()*lines.length)|0];chiefLife=2.1;chiefThink=rand(5,9);}shake=Math.max(0,shake-dt*24);const stopped=freeze>0;freeze=Math.max(0,freeze-dt);for(const p of players)if(!stopped||p.team===0)p.update(dt);updateSlime(dt,stopped);updateFireballs(dt,stopped);updateIceWaves(dt,stopped);collisions();updateParticles(dt);if(goalScene){goalScene.life-=dt;if(goalScene.life<=0)goalScene=null;}input.dash=input.kick=input.jump=input.skill=false;}
function updateSlime(dt,stopped){if(stopped)return;slime.think-=dt;slime.hop=Math.max(0,slime.hop-dt);slime.blink-=dt;slime.blinkT=Math.max(0,slime.blinkT-dt);slime.scared=Math.max(0,slime.scared-dt);slime.frozen=Math.max(0,(slime.frozen||0)-dt);if(slime.blink<=0){slime.blink=rand(1.5,4);slime.blinkT=.13;}if(slime.frozen>0){slime.vx*=Math.pow(.75,dt);slime.vy*=Math.pow(.75,dt);slime.x+=slime.vx*dt;slime.y+=slime.vy*dt;constrainToField(slime);if(slime.x<-slime.r){score[1]++;goal(1);}else if(slime.x>W+slime.r){score[0]++;goal(0);}return;}if(slime.startT>0){slime.startT=Math.max(0,slime.startT-dt);slime.hop=.45;const burstOut=1-slime.startT/.9;slime.y=slime.startY-Math.sin(burstOut*Math.PI)*42;slime.vx*=.8;slime.vy*=.8;return;}if(slime.think<=0){slime.think=rand(.9,2.7);const a=rand(0,Math.PI*2),f=rand(70,190);slime.vx+=Math.cos(a)*f;slime.vy+=Math.sin(a)*f;slime.wobble=rand(-3,3);slime.hop=.45;}
 slime.vx*=Math.pow(.12,dt);slime.vy*=Math.pow(.12,dt);slime.x+=slime.vx*dt;slime.y+=slime.vy*dt;slime.wobble*=Math.pow(.05,dt);constrainToField(slime);if(slime.x<-slime.r){score[1]++;goal(1);}else if(slime.x>W+slime.r){score[0]++;goal(0);}}

function updateFireballs(dt,stopped){
 if(stopped)return;
 for(const f of fireballs){
  f.life-=dt;f.trail-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;
  if(f.trail<=0){f.trail=.035;particles.push({x:f.x+rand(-4,4),y:f.y+rand(-4,4),vx:rand(-35,35),vy:rand(-35,35),life:rand(.18,.38),color:Math.random()<.5?'#ffcf45':'#ff6b2c'});}
  if(!insideEllipse(f.x,f.y,-8)){f.life=0;burst(f.x,f.y,'#ff8b2c',8);continue;}
  const sd=Math.hypot(slime.x-f.x,slime.y-f.y);
  if(sd<slime.r+f.r){const n=norm(f.vx,f.vy);slime.vx+=n.x*760;slime.vy+=n.y*760;slime.scared=.8;slime.hop=.45;f.life=0;message='スライムが熱くて転がった！';messageLife=.9;shake=10;burst(slime.x,slime.y,'#ff9a32',22);continue;}
  for(const target of players){if(target.team===f.team||target===f.owner)continue;if(Math.hypot(target.x-f.x,target.y-f.y)<target.r+f.r){const n=norm(f.vx,f.vy);target.vx+=n.x*430;target.vy+=n.y*430;target.burn=1.65;target.burnTick=0;target.stun=.2;f.life=0;message='燃えた！ コロコロ消火中！';messageLife=1;shake=9;burst(target.x,target.y,'#ff7a24',24);break;}}
 }
 fireballs=fireballs.filter(f=>f.life>0);
}

function updateIceWaves(dt,stopped){
 if(stopped)return;
 for(const w of iceWaves){
  w.life-=dt;const progress=1-w.life/w.maxLife;
  for(const target of players){if(target.team===w.team||target===w.owner||target.frozen>0)continue;const dx=target.x-w.x,dy=target.y-w.y,d=Math.hypot(dx,dy);if(d>w.range*progress+45||d<20)continue;const n=norm(dx,dy),dot=n.x*w.dx+n.y*w.dy;if(dot>Math.cos(w.angle)){target.frozen=1.8;target.vx*=.15;target.vy*=.15;target.stun=0;message='カチンコチン！ 触れると滑る！';messageLife=1;burst(target.x,target.y,'#bff7ff',22);}}
  const dx=slime.x-w.x,dy=slime.y-w.y,d=Math.hypot(dx,dy),n=norm(dx,dy);if(!slime.frozen&&d<w.range*progress+slime.r&&d>20&&n.x*w.dx+n.y*w.dy>Math.cos(w.angle)){slime.frozen=2.2;slime.vx*=.08;slime.vy*=.08;slime.hop=0;message='スライムが凍った！ 蹴ると滑る！';messageLife=1;burst(slime.x,slime.y,'#d9fbff',26);}
 }
 iceWaves=iceWaves.filter(w=>w.life>0);
}
function drawIceWaves(){for(const w of iceWaves){const p=1-w.life/w.maxLife,a=Math.atan2(w.dy,w.dx),r=w.range*p;ctx.save();ctx.translate(w.x,w.y);ctx.rotate(a);ctx.globalAlpha=.3*(1-p);const g=ctx.createRadialGradient(0,0,10,0,0,r);g.addColorStop(0,'#efffff');g.addColorStop(.45,'#8deeff');g.addColorStop(1,'#73bfff00');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,-w.angle,w.angle);ctx.closePath();ctx.fill();ctx.globalAlpha=.85;ctx.strokeStyle='#dffcff';ctx.lineWidth=3;for(let i=0;i<5;i++){const aa=-w.angle+i*(w.angle*2/4),rr=r*rand(.65,.95);ctx.beginPath();ctx.moveTo(Math.cos(aa)*rr*.4,Math.sin(aa)*rr*.4);ctx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr);ctx.stroke();}ctx.restore();}}

function drawFireballs(){for(const f of fireballs){const a=Math.atan2(f.vy,f.vx);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(a);ctx.globalAlpha=.35;ctx.fillStyle='#ff6b1f';ctx.beginPath();ctx.ellipse(-20,0,27,10,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;const g=ctx.createRadialGradient(-4,-5,2,0,0,18);g.addColorStop(0,'#fff7ba');g.addColorStop(.35,'#ffd447');g.addColorStop(1,'#f0441d');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.restore();}}

function goal(team){goalScene={team,life:1.1};message='押し込み成功！';messageLife=1.3;chiefLine=team===0?'見事だ！ 褒美に近づいたぞ！':'押し返せー！ まだ終わっておらん！';chiefLife=2.2;shake=18;if(Math.max(...score)>=3)return endGame();reset(true);}
function collisions(){for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const a=players[i],b=players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d<min){const n=norm(dx,dy),push=(min-d)*.5;a.x-=n.x*push;b.x+=n.x*push;a.y-=n.y*push;b.y+=n.y*push;if(a.frozen>0){a.vx-=n.x*360;a.vy-=n.y*360;}if(b.frozen>0){b.vx+=n.x*360;b.vy+=n.y*360;}}}
 for(const p of players){const dx=slime.x-p.x,dy=slime.y-p.y,d=Math.hypot(dx,dy),min=p.r+slime.r;if(d<min){const n=norm(dx,dy),push=min-d;slime.x+=n.x*push;slime.y+=n.y*push;const boost=slime.frozen>0?430:80;slime.vx+=n.x*boost;slime.vy+=n.y*boost;slime.scared=.35;if(slime.frozen>0){message='凍ったスライムがツルーッ！';messageLife=.7;}}}}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,7),s=rand(50,240);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),color});}}
function updateParticles(dt){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;}particles=particles.filter(p=>p.life>0);}
function draw(){ctx.save();if(shake)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawField();drawChiefs();for(const p of players)p.draw();drawSlime();drawFireballs();drawIceWaves();drawGoalScene();for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fill();}ctx.globalAlpha=1;drawHud();ctx.restore();}
function drawField(){
 // 草地と村外周
 ctx.fillStyle='#527f3e';ctx.fillRect(0,0,W,H);
 for(let y=0;y<H;y+=42){for(let x=(y/42%2)*24;x<W;x+=48){ctx.fillStyle=((x+y)/48)%2?'#5f8d47':'#4c783a';ctx.fillRect(x,y,25,3);}}
 drawVillage(0,0);drawVillage(1,W);

 // 次元に削り取られた土の縁（少し不規則な二重楕円）
 ctx.save();ctx.translate(FIELD.cx,FIELD.cy);
 ctx.fillStyle='#7a4d2a';ctx.beginPath();
 for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=1+Math.sin(i*2.7)*.014+Math.sin(i*6.1)*.009;const x=Math.cos(a)*(FIELD.rx+25)*r,y=Math.sin(a)*(FIELD.ry+25)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
 ctx.strokeStyle='#3e2818';ctx.lineWidth=7;ctx.stroke();
 ctx.fillStyle='#c9aa6d';ctx.beginPath();ctx.ellipse(0,0,FIELD.rx+8,FIELD.ry+8,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#d9c084';ctx.beginPath();ctx.ellipse(0,0,FIELD.rx-4,FIELD.ry-4,0,0,Math.PI*2);ctx.fill();
 ctx.restore();

 // 土壁の石・ひび
 ctx.fillStyle='#9b6a3b';for(let i=0;i<38;i++){const a=i/38*Math.PI*2;const x=FIELD.cx+Math.cos(a)*(FIELD.rx+18),y=FIELD.cy+Math.sin(a)*(FIELD.ry+18);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.roundRect(-12,-7,24,14,5);ctx.fill();ctx.restore();}

 // 競技線
 ctx.strokeStyle='#fff8';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(FIELD.cx,FIELD.cy,FIELD.rx-24,FIELD.ry-24,0,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(500,112);ctx.lineTo(500,520);ctx.stroke();ctx.setLineDash([]);
 ctx.beginPath();ctx.arc(500,316,72,0,Math.PI*2);ctx.stroke();

 // 村へつながる破れた入口
 drawBrokenGate(0,FIELD.goalT,FIELD.goalB,0);drawBrokenGate(905,FIELD.goalT,FIELD.goalB,1);

 // 中心の小さな異次元ゲート
 const pulse=1+Math.sin(performance.now()/260)*.08;
 ctx.save();ctx.translate(500,316);ctx.scale(pulse,1/pulse);
 const glow=ctx.createRadialGradient(0,0,2,0,0,48);glow.addColorStop(0,'#fff');glow.addColorStop(.25,'#b8f7ff');glow.addColorStop(.58,'#7659cc');glow.addColorStop(1,'#2b163d00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#d8c7ff';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,24,10,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++){const a=portalTime*(1.7+i*.24)+i*1.55,r=17+i*5;ctx.fillStyle=i%2?'#d9c8ff':'#8defff';ctx.globalAlpha=.65;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r*.42,3+i*.35,0,7);ctx.fill();}ctx.globalAlpha=1;ctx.restore();
 ctx.fillStyle='#553c67';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('小さなゲート',500,374);
}
function drawVillage(team,edge){
 const left=team===0,x0=left?0:910,c=teamColor(team),dir=left?1:-1;
 // 村の地面
 ctx.fillStyle=left?'#52758a':'#8a5656';ctx.fillRect(x0,172,90,286);
 // 家と屋根
 for(let i=0;i<3;i++){
  const yy=192+i*82;ctx.fillStyle='#e3cfaa';ctx.fillRect(x0+7,yy,72,48);
  ctx.fillStyle=left?'#31556d':'#6f3737';ctx.beginPath();ctx.moveTo(x0+2,yy);ctx.lineTo(x0+43,yy-28);ctx.lineTo(x0+84,yy);ctx.closePath();ctx.fill();
  ctx.fillStyle='#744629';ctx.fillRect(x0+17,yy+20,15,28);ctx.fillStyle='#9bd1df';ctx.fillRect(x0+47,yy+13,18,15);
 }
 // 村旗
 ctx.strokeStyle='#55341f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(left?30:970,116);ctx.lineTo(left?30:970,180);ctx.stroke();
 ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(left?32:968,120);ctx.lineTo(left?77:923,134);ctx.lineTo(left?32:968,148);ctx.closePath();ctx.fill();
 // 村名札
 ctx.fillStyle='#f5e7c0';ctx.strokeStyle='#5a3a25';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x0+5,153,80,31,7);ctx.fill();ctx.stroke();
 ctx.fillStyle='#3a2a1f';ctx.font='900 14px sans-serif';ctx.textAlign='center';ctx.fillText(left?'あなたの村':'となり村',left?45:955,174);
 // 壊れた塀の切断面
 ctx.fillStyle='#8a613e';for(let y=202;y<440;y+=27){ctx.fillRect(left?82:900,y,18,18);}
 // 荷車と樽
 ctx.fillStyle='#704526';ctx.fillRect(left?8:942,474,48,18);ctx.strokeStyle='#2f2118';ctx.lineWidth=5;ctx.beginPath();ctx.arc(left?18:952,495,10,0,Math.PI*2);ctx.arc(left?49:983,495,10,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#9b6a3b';ctx.beginPath();ctx.roundRect(left?60:914,468,24,34,6);ctx.fill();
 // 応援する村人
 for(let i=0;i<3;i++)drawSpectator(left?24+i*25:926+i*25,535+(i%2)*7,team,i);
}
function drawSpectator(x,y,team,i){
 const bounce=Math.sin(performance.now()/220+i*1.7)*3;ctx.save();ctx.translate(x,y+bounce);
 ctx.fillStyle=teamColor(team);ctx.fillRect(-7,-2,14,18);ctx.fillStyle='#f2c895';ctx.beginPath();ctx.arc(0,-10,7,0,Math.PI*2);ctx.fill();
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
 const speed=Math.hypot(slime.vx,slime.vy),squash=clamp(speed/900,0,.3),hop=slime.hop>0?Math.sin((1-slime.hop/.45)*Math.PI)*17:0;
 const wob=Math.sin(performance.now()/120)*.035;
 ctx.save();ctx.translate(slime.x,slime.y-hop);ctx.rotate(slime.wobble*.08);ctx.scale(1+squash+wob,1-squash-wob);
 const g=ctx.createRadialGradient(-10,-15,4,0,0,45);g.addColorStop(0,'#e8fbff');g.addColorStop(.35,'#61ccff');g.addColorStop(1,'#0874da');ctx.fillStyle=g;ctx.strokeStyle='#073d92';ctx.lineWidth=5;
 ctx.beginPath();ctx.moveTo(-34,10);ctx.quadraticCurveTo(-42,-12,-22,-25);ctx.quadraticCurveTo(0,-42,23,-25);ctx.quadraticCurveTo(44,-10,34,13);ctx.quadraticCurveTo(0,34,-34,10);ctx.fill();ctx.stroke();
 ctx.fillStyle='#fff';ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(-13,-18,10,7,-.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 ctx.fillStyle='#063a78';ctx.beginPath();if(slime.blinkT>0){ctx.ellipse(-10,-4,4,1,0,0,7);ctx.ellipse(10,-4,4,1,0,0,7);}else{const look=clamp(slime.vx/240,-2,2);ctx.arc(-10+look,-4,3,0,Math.PI*2);ctx.arc(10+look,-4,3,0,Math.PI*2);}ctx.fill();
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
 ctx.fillStyle='#8ed7ff';ctx.textAlign='right';ctx.font='900 16px sans-serif';ctx.fillText('あなたの村',420,28);
 ctx.fillStyle='#ffaaaa';ctx.textAlign='left';ctx.fillText('となり村',580,28);
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 30px sans-serif';ctx.fillText(`${score[0]} － ${score[1]}`,500,38);
 ctx.font='bold 13px sans-serif';ctx.fillStyle='#ffeeb0';ctx.fillText(`押し付け数　　残り ${Math.ceil(timeLeft)}秒　　3回で褒美！`,500,58);
 // 褒美までの簡易印
 for(let team=0;team<2;team++)for(let i=0;i<3;i++){ctx.fillStyle=i<score[team]?'#ffd85a':'#ffffff33';ctx.beginPath();ctx.arc(team===0?265-i*18:735+i*18,37,6,0,Math.PI*2);ctx.fill();}
 if(messageLife>0){ctx.fillStyle='#fff4a3';ctx.font='900 36px sans-serif';ctx.fillText(message,500,145);}if(freeze>0){ctx.fillStyle='#b9efff';ctx.font='900 25px sans-serif';ctx.fillText(`TIME STOP ${freeze.toFixed(1)}`,500,174);}
 ctx.textAlign='left';ctx.font='bold 14px sans-serif';ctx.fillStyle='#fff';const spirit=players.find(p=>p.isHuman)?.spirit||selectedSpirit;ctx.fillText(spirit==='ice'?'氷の精霊使い：コールドブレスで凍結　／　凍ったものは触れると滑る':spirit==='wind'?'風の精霊使い：加速　／　短いクールタイムで一気に間合いを詰める':'炎の精霊使い：ファイアボール　／　燃えた相手は転がって消火',18,585);
}
function loop(t){if(!running)return;const dt=Math.min(.033,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop);}

addEventListener('keydown',e=>{keys[e.key]=true;keys[e.key.toLowerCase()]=true;e.preventDefault();});addEventListener('keyup',e=>{keys[e.key]=false;keys[e.key.toLowerCase()]=false;});ui.startBtn.onclick=startGame;ui.retryBtn.onclick=startGame;
let stickId=null;function stickMove(e){const r=ui.stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,d=Math.hypot(dx,dy)||1,k=Math.min(1,max/d);input.x=dx/d*k;input.y=dy/d*k;ui.knob.style.transform=`translate(${input.x*max}px,${input.y*max}px)`;}
ui.stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;ui.stick.setPointerCapture(e.pointerId);stickMove(e);});ui.stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)stickMove(e);});ui.stick.addEventListener('pointerup',e=>{if(e.pointerId===stickId){stickId=null;input.x=input.y=0;ui.knob.style.transform='';}});document.querySelectorAll('[data-action]').forEach(b=>{b.addEventListener('pointerdown',e=>{input[b.dataset.action]=true;e.preventDefault();});b.addEventListener('pointerup',e=>{input[b.dataset.action]=false;e.preventDefault();});b.addEventListener('pointercancel',()=>{input[b.dataset.action]=false;});});

const loadingLines=['異次元の穴を安定させています…','削れた土壁を点検中…','村人を招集中…','少し臭うスライムを確認中…','村長が褒美を準備中…','押し付け合いの準備完了！'];let loadIndex=0;const loadingTimer=setInterval(()=>{loadIndex++;ui.loadingText.textContent=loadingLines[Math.min(loadIndex,loadingLines.length-1)];if(loadIndex>=loadingLines.length-1){clearInterval(loadingTimer);ui.startBtn.classList.remove('hidden');}},650);
draw();

// 精霊選択
document.querySelectorAll('[data-spirit]').forEach(b=>b.addEventListener('click',()=>{selectedSpirit=b.dataset.spirit;document.querySelectorAll('[data-spirit]').forEach(x=>x.classList.toggle('selected',x===b));ui.skillBtn.textContent=selectedSpirit==='ice'?'氷魔法':selectedSpirit==='wind'?'加速':'炎魔法';}));
