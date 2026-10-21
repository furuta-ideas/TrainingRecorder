export const SLOT_SECONDS=5;
export const MAX_SLOTS=24;
export function normalizePlan(config){
 const active=Math.min(MAX_SLOTS,Math.round(config.durationSeconds/SLOT_SECONDS));
 return Array.from({length:MAX_SLOTS},(_,i)=>i<active?{...(config.steps[i]||{}),active:true}:{top:'',bottom:'',active:false});
}
export function slotAt(elapsedMs){return Math.max(0,Math.min(MAX_SLOTS-1,Math.floor(elapsedMs/(SLOT_SECONDS*1000))))}
export function applyMenuOrder(menus,order=[]){const rank=new Map(order.map((id,i)=>[id,i]));return [...menus].sort((a,b)=>(rank.get(a.id)??order.length)-(rank.get(b.id)??order.length))}
