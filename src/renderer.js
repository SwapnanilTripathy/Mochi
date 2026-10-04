const pet=document.getElementById("mochi");
const sprite=document.getElementById("sprite");

const frames={
  idle:Array.from({length:8},(_,i)=>`./assets/idle/idle-${i+1}.png`),
  walk:Array.from({length:8},(_,i)=>`./assets/walk/walk-${i+1}.png`)
};

let state="idle", direction=1, frame=0, timer=null;

function available(src){return new Promise(r=>{const im=new Image();im.onload=()=>r(true);im.onerror=()=>r(false);im.src=src})}

async function chooseFrames(){
  const idleOk=await available(frames.idle[0]);
  if(!idleOk){
    sprite.src="./assets/mochi.svg";
    return false;
  }
  return true;
}

function render(){
  const list=frames[state]||frames.idle;
  sprite.src=list[frame%list.length];
  sprite.style.transform=direction<0?"scaleX(-1)":"scaleX(1)";
  pet.className=`mochi ${state}`;
}

function setState(next){
  state=next==="walk"?"walk":"idle";
  frame=0;
  render();
}

function animate(){
  clearInterval(timer);
  timer=setInterval(()=>{frame=(frame+1)%(frames[state]?.length||1);render()},state==="walk"?95:220);
}

window.mochi.onState(setState);
window.mochi.onDirection(d=>{direction=d;render()});

pet.addEventListener("mouseenter",()=>{
  if(state==="idle") pet.className="mochi look";
});
pet.addEventListener("mouseleave",()=>{
  pet.className=`mochi ${state}`;
});

chooseFrames().then(animate);
