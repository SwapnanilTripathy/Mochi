const ids=["wander","cursorAware","sounds","notifications","startWithWindows","personality","napDuration"];
const $=id=>document.getElementById(id);
function render(data){
  const {settings,stats}=data;
  ids.forEach(id=>{if($(id).type==="checkbox")$(id).checked=!!settings[id];else $(id).value=settings[id]});
  $("napValue").textContent=`${Math.round(Number(settings.napDuration)/1000)}s`;
  $("affection").textContent=stats.affection||0;$("pats").textContent=stats.pats||0;$("naps").textContent=stats.naps||0;$("walks").textContent=stats.walks||0;
  const a=Number(stats.affection||0);$("mood").textContent=a>=75?"♥":a>=40?"☺":a>=15?"◡":"♡";
}
function push(){
  const next={sounds:$("sounds").checked,wander:$("wander").checked,cursorAware:$("cursorAware").checked,notifications:$("notifications").checked,startWithWindows:$("startWithWindows").checked,personality:$("personality").value,napDuration:Number($("napDuration").value)*1000};
  window.mochi.updateSettings(next);
}
["wander","cursorAware","sounds","notifications","startWithWindows","personality","napDuration"].forEach(id=>$(id).addEventListener("change",()=>{if(id==="napDuration")$("napValue").textContent=`${$("napDuration").value}s`;push()}));
$("resetStats").addEventListener("click",()=>{if(confirm("Reset Mochi's affection and stats?"))window.mochi.resetStats()});
$("close").addEventListener("click",()=>window.mochi.closeSettings());
window.mochi.onSettings(render);window.mochi.requestSettings();