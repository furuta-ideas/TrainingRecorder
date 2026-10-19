export function timerSeconds(menu,override){
  if(Number.isFinite(override?.timerSeconds))return Math.max(0,Math.min(3600,Math.round(override.timerSeconds)));
  if(Number.isFinite(menu?.timerSeconds))return Math.max(0,Math.min(3600,Math.round(menu.timerSeconds)));
  if(Number.isFinite(menu?.repetitions)&&Number.isFinite(menu?.perRepSeconds)&&Number.isFinite(menu?.sets))return Math.max(1,Math.min(3600,Math.round(menu.repetitions*menu.perRepSeconds*menu.sets+(menu.sets-1)*30)));
  const text=(override?.prescription??menu.prescription+' '+menu.durationNote).normalize('NFKC');
  const matches=[...text.matchAll(/(\d+(?:\.\d+)?)\s*(分|秒)/g)];
  if(!matches.length)return 60;
  const seconds=matches.reduce((sum,m)=>sum+Number(m[1])*(m[2]==='分'?60:1),0);
  const sets=text.match(/(\d+)\s*セット/);
  return Math.max(1,Math.min(3600,Math.round(seconds*(sets?Number(sets[1]):1))));
}
export function applyMenuOrder(menus,order=[]){
  const rank=new Map(order.map((id,i)=>[id,i]));
  return [...menus].sort((a,b)=>(rank.get(a.id)??order.length)-(rank.get(b.id)??order.length));
}
