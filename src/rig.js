const MOCHI_RIG_MANIFEST={"canvas":[629,630],"z_order_back_to_front":["body","head","left-ear","right-ear","muzzle","left-eye","right-eye","headphone-band","headphone-left-cup","headphone-right-cup","left-arm","right-arm","headphone-details","mouth","eye-closed-left","eye-closed-right"],"layers":{"body":{"file":"body.png","x":26,"y":-40,"w":590,"h":670},"head":{"file":"head.png","x":154,"y":112,"w":308,"h":378},"left-ear":{"file":"left-ear.png","x":136,"y":2,"w":235,"h":224},"right-ear":{"file":"right-ear.png","x":282,"y":40,"w":290,"h":263},"muzzle":{"file":"muzzle.png","x":157,"y":258,"w":234,"h":231},"left-eye":{"file":"left-eye.png","x":120,"y":242,"w":157,"h":149},"right-eye":{"file":"right-eye.png","x":265,"y":244,"w":142,"h":147},"headphone-band":{"file":"headphone-band.png","x":150,"y":76,"w":279,"h":154},"headphone-left-cup":{"file":"headphone-left-cup.png","x":102,"y":123,"w":142,"h":196},"headphone-right-cup":{"file":"headphone-right-cup.png","x":332,"y":132,"w":214,"h":227},"left-arm":{"file":"left-arm.png","x":28,"y":205,"w":243,"h":388},"right-arm":{"file":"right-arm.png","x":358,"y":160,"w":214,"h":439},"headphone-details":{"file":"headphone-details.png","x":130,"y":98,"w":329,"h":175},"mouth":{"file":"mouth.png","x":206,"y":343,"w":176,"h":140},"eye-closed-left":{"file":"eye-closed-left.png","x":145,"y":268,"w":122,"h":118},"eye-closed-right":{"file":"eye-closed-right.png","x":265,"y":276,"w":134,"h":113}}};
class MochiRig{
constructor(root){this.root=root;this.layers=new Map();this.state="idle";this.direction=1;this.startTime=performance.now();this.blinkUntil=0;this.patUntil=0;this.nextBlink=performance.now()+2200+Math.random()*2600;this.build();this.tick=this.tick.bind(this);requestAnimationFrame(this.tick)}
build(){const [cw,ch]=MOCHI_RIG_MANIFEST.canvas;this.root.innerHTML="";for(const name of MOCHI_RIG_MANIFEST.z_order_back_to_front){const m=MOCHI_RIG_MANIFEST.layers[name],img=document.createElement("img");img.className="rig-layer";img.alt="";img.draggable=false;img.src="./assets/rig/"+m.file;img.style.left=(m.x/cw)*100+"%";img.style.top=(m.y/ch)*100+"%";img.style.width=(m.w/cw)*100+"%";img.style.height=(m.h/ch)*100+"%";img.dataset.name=name;this.root.appendChild(img);this.layers.set(name,img);img.addEventListener("error",()=>{this.root.dataset.ready="false";this.root.dispatchEvent(new CustomEvent("rig-error"))})}this.root.dataset.ready="true";this.applyEyeState(true)}
setState(next){if(!["idle","walk","sleep","stretch","drag","edge","curious"].includes(next))next="idle";if(this.state===next)return;this.state=next;if(next==="sleep")this.applyEyeState(false);else this.scheduleBlink()}
setDirection(d){this.direction=d<0?-1:1}
pat(){this.patUntil=performance.now()+520}
scheduleBlink(){this.nextBlink=performance.now()+2200+Math.random()*3400}
applyEyeState(open){const lo=this.layers.get("left-eye"),ro=this.layers.get("right-eye"),lc=this.layers.get("eye-closed-left"),rc=this.layers.get("eye-closed-right");if(!lo||!ro||!lc||!rc)return;lo.style.opacity=open?"1":"0";ro.style.opacity=open?"1":"0";lc.style.opacity=open?"0":"1";rc.style.opacity=open?"0":"1"}
transform(name,x,y,r,sx=1,sy=1){const el=this.layers.get(name);if(el)el.style.transform=`translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`}
tick(now){
const t=(now-this.startTime)/1000,w=Math.sin(t*Math.PI*2),f=Math.sin(t*Math.PI*4),slow=Math.sin(t*Math.PI*.9),d=this.direction,s=this.state;
for(const el of this.layers.values())el.style.transform="";
let by=0,bsx=1,bsy=1,hy=0,hr=0,al=0,ar=0,elv=0,erv=0;
const blinkActive=this.blinkUntil&&now<this.blinkUntil;

// Base life: tiny breathing, ear/headphone micro motion.
if(s==="idle"||s==="curious"||s==="edge"){
  by=-.7+w*.7;
  hy=w*.8;
  this.transform("left-ear",0,Math.sin(t*3.7)*.65,-Math.sin(t*2.3)*.35);
  this.transform("right-ear",0,Math.sin(t*3.1+1.2)*.55,Math.sin(t*2.1)*.3);
  this.transform("headphone-band",0,Math.sin(t*1.8)*.35,Math.sin(t*1.4)*.12);
}
if(s==="walk"){
  by=-1+Math.abs(f)*-1.4;
  hy=f*.7;
  al=f*3.5;
  ar=-f*3.5;
  elv=f*1.2;
  erv=-f*1.2;
  this.transform("left-ear",0,f*.8,-f*.7);
  this.transform("right-ear",0,-f*.7,f*.55);
  this.transform("headphone-band",0,f*.35,f*.2);
  this.transform("headphone-details",0,f*.35,f*.2);
}
if(s==="curious"){
  hr=-3*d;
  hy=-1.5+w*.6;
  elv=-2*d;
  erv=-d;
  this.transform("left-ear",0,-1.5+w*1.4,-5*d);
  this.transform("right-ear",0,-.5+w*.7,4*d);
  this.transform("headphone-band",0,-1,hr*.5);
}
if(s==="sleep"){
  by=1+w*.8;
  bsy=.985+w*.012;
  hr=5*d;
  hy=2+w*.5;
  this.transform("left-ear",0,Math.sin(t*1.7)*.5,2*d);
  this.transform("right-ear",0,Math.sin(t*1.5+1)*.4,2*d);
  this.applyEyeState(false);
}
if(s==="stretch"){
  bsx=1.055+w*.008;
  bsy=.95;
  hr=-2*d;
  al=-5*d;
  ar=5*d;
  this.transform("left-ear",0,w*.8,-2*d);
  this.transform("right-ear",0,w*.8,2*d);
}
if(s==="drag"){
  by=-2+w*1.2;
  hr=-2*d;
  al=-3*d;
  ar=3*d;
}
if(s==="edge")hr=-1.5*d;

// Body + limbs
this.transform("body",0,by,0,bsx,bsy);
this.transform("left-arm",0,by,al);
this.transform("right-arm",0,by,ar);

// Head group
const hp=["head","left-ear","right-ear","muzzle","left-eye","right-eye","eye-closed-left","eye-closed-right","mouth","headphone-band","headphone-left-cup","headphone-right-cup","headphone-details"];
for(const n of hp)this.transform(n,0,hy,hr);

// Subtle arm/hand asymmetry while idle makes the character breathe rather than pulse as one block.
if(s==="idle"||s==="edge"){
  this.transform("left-arm",0,by+Math.sin(t*2.1)*.35,Math.sin(t*1.7)*.7);
  this.transform("right-arm",0,by+Math.sin(t*2.1+1)*.35,-Math.sin(t*1.5)*.6);
}

// Blink naturally, including an occasional slightly longer blink.
if(now>=this.nextBlink&&s!=="sleep"&&s!=="drag"&&!blinkActive){
  this.applyEyeState(false);
  this.blinkUntil=now+105+Math.random()*90;
  this.nextBlink=now+2300+Math.random()*4300;
}
if(this.blinkUntil&&now>=this.blinkUntil&&s!=="sleep"){
  this.applyEyeState(true);
  this.blinkUntil=0;
}

// Pat reaction overlays all normal movement.
const pat=this.patUntil&&now<this.patUntil?1:0;
const py=pat?-4:0;
const ps=pat?1.045:1;
this.root.style.transform="scaleX("+d+") translateY("+py+"px) scale("+ps+")";
requestAnimationFrame(this.tick)}

}