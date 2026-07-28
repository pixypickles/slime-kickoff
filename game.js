'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const ui={start:document.getElementById('start'),result:document.getElementById('result'),controls:document.getElementById('controls'),startBtn:document.getElementById('startBtn'),retryBtn:document.getElementById('retryBtn'),resultTitle:document.getElementById('resultTitle'),resultText:document.getElementById('resultText'),stick:document.getElementById('stick'),knob:document.getElementById('knob')};
const W=1000,H=600,FIELD={l:75,r:925,t:70,b:530,goalT:215,goalB:385};
const keys={},input={x:0,y:0,dash:false,kick:false,jump:false,skill:false};
let players=[],slime,score=[0,0],timeLeft=75,running=false,last=0,message='',messageLife=0,shake=0,freeze=0,particles=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}};
const rand=(a,b)=>a+Math.random()*(b-a);
class Player{
 constructor(team,x,y,isHuman=false,index=0){Object.assign(this,{team,x,y,isHuman,index,vx:0,vy:0,r:24,faceX:team? -1:1,faceY:0,dashTime:0,dashCd:0,kickCd:0,kickTime:0,jumpT:0,stun:0,skillCd:0,aiThink:0,aiX:0,aiY:0});}
 update(dt){
  this.dashCd=Math.max(0,this.dashCd-dt);this.kickCd=Math.max(0,this.kickCd-dt);this.skillCd=Math.max(0,this.skillCd-dt);this.stun=Math.max(0,this.stun-dt);this.kickTime=Math.max(0,this.kickTime-dt);this.jumpT=Math.max(0,this.jumpT-dt);
  let ix=0,iy=0,actions={};
  if(this.isHuman){ix=input.x+(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0);iy=input.y+(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);actions={dash:input.dash||keys.Shift,kick:input.kick||keys.j,jump:input.jump||keys.k,skill:input.skill||keys.l};}
  else ({ix,iy,actions}=this.ai(dt));
  if(this.stun<=0){
   if(Math.hypot(ix,iy)>.15){const n=norm(ix,iy);this.faceX=n.x;this.faceY=n.y;let sp=190;if(this.dashTime>0)sp=390;this.vx+=n.x*sp*dt*8;this.vy+=n.y*sp*dt*8;}
   if(actions.dash&&this.dashCd<=0){this.dashTime=.22;this.dashCd=.8;burst(this.x,this.y,this.team?'#ff8b8b':'#75c8ff',8);}
   if(actions.jump&&this.jumpT<=0)this.jumpT=.55;
   if(actions.kick&&this.kickCd<=0)this.kick();
   if(actions.skill&&this.skillCd<=0)this.skill();
  }
  this.dashTime=Math.max(0,this.dashTime-dt);
  const drag=Math.pow(.0008,dt);this.vx*=drag;this.vy*=drag;this.x+=this.vx*dt;this.y+=this.vy*dt;
  this.x=clamp(this.x,FIELD.l+this.r,FIELD.r-this.r);this.y=clamp(this.y,FIELD.t+this.r,FIELD.b-this.r);
 }
 ai(dt){
  this.aiThink-=dt;if(this.aiThink<=0){this.aiThink=rand(.1,.25);const target=this.index===2?players.find(p=>p.team!==this.team&&p.index===0):slime;let tx=target.x,ty=target.y;if(this.index===1){tx+=(this.team?1:-1)*120;ty+=this.team?90:-90;}const n=norm(tx-this.x,ty-this.y);this.aiX=n.x;this.aiY=n.y;}
  const d=Math.hypot(slime.x-this.x,slime.y-this.y),enemyNear=players.some(p=>p.team!==this.team&&Math.hypot(p.x-this.x,p.y-this.y)<80);
  return{ix:this.aiX,iy:this.aiY,actions:{dash:d>150&&Math.random()<.03,kick:(d<92||enemyNear)&&Math.random()<.16,jump:d<110&&Math.random()<.025,skill:this.skillCd<=0&&Math.random()<.004}};
 }
 kick(){this.kickCd=.42;this.kickTime=.18;const sliding=this.dashTime>0,air=this.jumpT>0;let power=sliding?760:air?680:560;if(sliding&&air)power=900;const fx=this.faceX,fy=this.faceY;const dx=slime.x-this.x,dy=slime.y-this.y;if(Math.hypot(dx,dy)<95+slime.r){const n=norm(dx+fx*25,dy+fy*25);slime.vx+=n.x*power;slime.vy+=n.y*power;slime.wobble+=rand(-2,2);shake=Math.max(shake,sliding?10:6);burst(slime.x,slime.y,'#b9efff',14);}
  for(const p of players){if(p===this||p.team===this.team)continue;const dx=p.x-this.x,dy=p.y-this.y,n=norm(dx,dy);if(Math.hypot(dx,dy)<83&&n.x*fx+n.y*fy>-.1){p.vx+=fx*power*.85;p.vy+=fy*power*.85;p.stun=Math.max(p.stun,sliding?.7:.35);shake=Math.max(shake,8);burst(p.x,p.y,'#fff1a3',10);}}
 }
 skill(){this.skillCd=12;if(this.team===0){freeze=2.2;message='時間停止！';messageLife=1.1;}else{for(const p of players)if(p.team===0)p.stun=Math.max(p.stun,1.6);message='敵チーム全員気絶！';messageLife=1.1;}burst(this.x,this.y,'#d98cff',28);}
 draw(){const jump=this.jumpT>0?Math.sin((1-this.jumpT/.55)*Math.PI)*28:0;ctx.save();ctx.translate(this.x,this.y-jump);ctx.fillStyle=this.team?'#e35e5e':'#4ca6e8';ctx.strokeStyle=this.isHuman?'#ffe45c':'#fff';ctx.lineWidth=this.isHuman?6:3;ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.faceX*8-5,this.faceY*8-5,4,0,7);ctx.arc(this.faceX*8+5,this.faceY*8-5,4,0,7);ctx.fill();if(this.stun>0){ctx.font='24px sans-serif';ctx.fillText('★',-12,-32);}ctx.restore();if(this.skillCd>0){ctx.fillStyle='#0009';ctx.fillRect(this.x-24,this.y+30,48,5);ctx.fillStyle='#d98cff';ctx.fillRect(this.x-24,this.y+30,48*(1-this.skillCd/12),5);}}
}
function reset(afterGoal=false){players=[];for(let i=0;i<3;i++){players.push(new Player(0,220,[210,300,390][i],i===0,i));players.push(new Player(1,780,[210,300,390][i],false,i));}slime={x:500,y:300,vx:0,vy:0,r:37,wobble:0,think:rand(1.5,3.5)};if(afterGoal){for(const p of players)p.stun=.45;}message='KICK OFF!';messageLife=1;}
function startGame(){score=[0,0];timeLeft=75;particles=[];freeze=0;running=true;ui.start.classList.add('hidden');ui.result.classList.add('hidden');ui.controls.classList.remove('hidden');reset();last=performance.now();requestAnimationFrame(loop);}
function endGame(){running=false;ui.controls.classList.add('hidden');ui.result.classList.remove('hidden');const win=score[0]>score[1],draw=score[0]===score[1];ui.resultTitle.textContent=draw?'引き分け！':win?'褒美獲得！':'スライムを押し付けられた…';ui.resultText.textContent=`あなたの村 ${score[0]} － ${score[1]} 隣村`}
function update(dt){if(!running)return;timeLeft-=dt;if(timeLeft<=0)return endGame();messageLife=Math.max(0,messageLife-dt);shake=Math.max(0,shake-dt*24);
 const stopped=freeze>0;freeze=Math.max(0,freeze-dt);for(const p of players){if(!stopped||p.team===0)p.update(dt);}updateSlime(dt,stopped);collisions();updateParticles(dt);input.dash=input.kick=input.jump=input.skill=false;}
function updateSlime(dt,stopped){if(stopped)return;slime.think-=dt;if(slime.think<=0){slime.think=rand(1.2,3.2);const a=rand(0,Math.PI*2),f=rand(70,180);slime.vx+=Math.cos(a)*f;slime.vy+=Math.sin(a)*f;slime.wobble=rand(-3,3);}
 slime.vx*=Math.pow(.12,dt);slime.vy*=Math.pow(.12,dt);slime.x+=slime.vx*dt;slime.y+=slime.vy*dt;slime.wobble*=Math.pow(.05,dt);
 if(slime.y-slime.r<FIELD.t){slime.y=FIELD.t+slime.r;slime.vy=Math.abs(slime.vy)*.76;}if(slime.y+slime.r>FIELD.b){slime.y=FIELD.b-slime.r;slime.vy=-Math.abs(slime.vy)*.76;}
 const inGoal=slime.y>FIELD.goalT&&slime.y<FIELD.goalB;if(!inGoal&&slime.x-slime.r<FIELD.l){slime.x=FIELD.l+slime.r;slime.vx=Math.abs(slime.vx)*.76;}if(!inGoal&&slime.x+slime.r>FIELD.r){slime.x=FIELD.r-slime.r;slime.vx=-Math.abs(slime.vx)*.76;}
 if(slime.x<-slime.r){score[1]++;goal();}else if(slime.x>W+slime.r){score[0]++;goal();}}
function goal(){message='押し付け成功！';messageLife=1.3;shake=18;if(Math.max(...score)>=3)return endGame();reset(true);}
function collisions(){for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const a=players[i],b=players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;if(d<min){const n=norm(dx,dy),push=(min-d)*.5;a.x-=n.x*push;b.x+=n.x*push;a.y-=n.y*push;b.y+=n.y*push;}}
 for(const p of players){const dx=slime.x-p.x,dy=slime.y-p.y,d=Math.hypot(dx,dy),min=p.r+slime.r;if(d<min){const n=norm(dx,dy),push=min-d;slime.x+=n.x*push;slime.y+=n.y*push;slime.vx+=n.x*80;slime.vy+=n.y*80;}}}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,7),s=rand(50,240);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),color});}}
function updateParticles(dt){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;}particles=particles.filter(p=>p.life>0);}
function draw(){ctx.save();if(shake)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawField();for(const p of players)p.draw();drawSlime();for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fill();}ctx.globalAlpha=1;drawHud();ctx.restore();}
function drawField(){ctx.fillStyle='#78c956';ctx.fillRect(0,0,W,H);ctx.fillStyle='#9de36c';for(let y=0;y<H;y+=60)ctx.fillRect(0,y,W,30);ctx.fillStyle='#d6bd79';ctx.fillRect(FIELD.l,FIELD.t,FIELD.r-FIELD.l,FIELD.b-FIELD.t);ctx.strokeStyle='#fff9';ctx.lineWidth=5;ctx.strokeRect(FIELD.l,FIELD.t,FIELD.r-FIELD.l,FIELD.b-FIELD.t);ctx.beginPath();ctx.moveTo(500,FIELD.t);ctx.lineTo(500,FIELD.b);ctx.stroke();ctx.beginPath();ctx.arc(500,300,75,0,7);ctx.stroke();ctx.fillStyle='#5a8cab';ctx.fillRect(0,FIELD.goalT,FIELD.l,FIELD.goalB-FIELD.goalT);ctx.fillStyle='#b86868';ctx.fillRect(FIELD.r,FIELD.goalT,W-FIELD.r,FIELD.goalB-FIELD.goalT);ctx.fillStyle='#493629';ctx.fillRect(0,0,18,H);ctx.fillRect(W-18,0,18,H);ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('あなたの村',45,205);ctx.fillText('隣村',955,205);}
function drawSlime(){const speed=Math.hypot(slime.vx,slime.vy),squash=clamp(speed/900,0,.3);ctx.save();ctx.translate(slime.x,slime.y);ctx.rotate(slime.wobble*.08);ctx.scale(1+squash,1-squash);const g=ctx.createRadialGradient(-10,-15,4,0,0,45);g.addColorStop(0,'#e8fbff');g.addColorStop(.35,'#61ccff');g.addColorStop(1,'#0874da');ctx.fillStyle=g;ctx.strokeStyle='#073d92';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,4,slime.r,slime.r*.78,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.globalAlpha=.8;ctx.beginPath();ctx.ellipse(-13,-12,10,7,-.5,0,7);ctx.fill();ctx.restore();}
function drawHud(){ctx.fillStyle='#10202bd9';ctx.fillRect(330,8,340,52);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 28px sans-serif';ctx.fillText(`${score[0]}  -  ${score[1]}`,500,39);ctx.font='bold 16px sans-serif';ctx.fillText(`${Math.ceil(timeLeft)}秒 / 3点先取`,500,57);if(messageLife>0){ctx.fillStyle='#fff4a3';ctx.font='900 38px sans-serif';ctx.fillText(message,500,115);}if(freeze>0){ctx.fillStyle='#b9efff';ctx.font='900 25px sans-serif';ctx.fillText(`TIME STOP ${freeze.toFixed(1)}`,500,145);}ctx.textAlign='left';ctx.font='bold 14px sans-serif';ctx.fillStyle='#fff';ctx.fillText('ダッシュ中キック＝スライディング　ジャンプ中キック＝空中キック',18,585);}
function loop(t){if(!running)return;const dt=Math.min(.033,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop);}
addEventListener('keydown',e=>{keys[e.key]=true;keys[e.key.toLowerCase()]=true;e.preventDefault();});addEventListener('keyup',e=>{keys[e.key]=false;keys[e.key.toLowerCase()]=false;});
ui.startBtn.onclick=startGame;ui.retryBtn.onclick=startGame;
let stickId=null;function stickMove(e){const r=ui.stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,d=Math.hypot(dx,dy)||1,k=Math.min(1,max/d);input.x=dx/d*k;input.y=dy/d*k;ui.knob.style.transform=`translate(${input.x*max}px,${input.y*max}px)`;}
ui.stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;ui.stick.setPointerCapture(e.pointerId);stickMove(e)});ui.stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)stickMove(e)});ui.stick.addEventListener('pointerup',e=>{if(e.pointerId===stickId){stickId=null;input.x=input.y=0;ui.knob.style.transform=''}});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',e=>{input[b.dataset.action]=true;e.preventDefault()}));
draw();
