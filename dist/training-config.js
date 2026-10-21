const repeat=(count,top,bottom)=>Array.from({length:count},(_,i)=>({top:typeof top==='function'?top(i):top,bottom:typeof bottom==='function'?bottom(i):bottom}));
const circled=n=>'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[n-1]||String(n);
const phase=(rounds,labels)=>Array.from({length:rounds},(_,round)=>labels.map(bottom=>({top:circled(round+1),bottom}))).flat();
const alternate=(count,a,b)=>Array.from({length:count},(_,i)=>({top:circled(Math.floor(i/2)+1),bottom:i%2?b:a}));
const standby=()=>repeat(2,'','スタンバイ');

export const trainingConfig=[
 {name:'深いお辞儀',minutes:2,memo:'吸う（5秒）＞吐く（5秒）＞止める（5秒）\n肩の力を抜いてリラックスする',steps:phase(8,['吸う','吐く','停止'])},
 {name:'肩甲骨伸ばし',minutes:2,memo:'ポールを肩甲骨の下に＞吐く＞胸を開く\n腰を反らさず、腰を固定する意識で',steps:[...standby(),...repeat(10,i=>circled(i+1),''),...standby(),...repeat(10,i=>circled(i+1),'')]},
 {name:'キャットカウ',minutes:2,memo:'四つん這い＞肩甲骨を開きながら丸める＞肩甲骨を寄せながら反らせる',steps:alternate(24,'丸める','反る')},
 {name:'肋骨の呼吸',minutes:2,memo:'吸う（5秒）＞吐く（5秒）＞止める（5秒）\n背骨が床につくように',steps:phase(8,['吸う','吐く','停止'])},
 {name:'片足下ろし',minutes:2,memo:'片足ずつ下ろす\n肋骨と腰の位置を保つ',steps:alternate(24,'右','左')},
 {name:'ブリッジ',minutes:2,memo:'ボールを内ももに挟む＞かかとで押す＞おしりから順にあげる\n肋骨が上がらないように',steps:alternate(24,'床','ブリッジ')},
 {name:'プランク',minutes:2,memo:'頭から足まで一直線\n呼吸を止めない',steps:[...repeat(6,'','スタンバイ'),...repeat(6,'①','プランク'),...repeat(6,'','スタンバイ'),...repeat(6,'②','プランク')]},
 {name:'背骨ねじり',minutes:2,memo:'膝を折る＞腕を前に倣え＞腕を背面の床へ\n親指を床に',steps:[...standby(),...repeat(10,i=>'右'+circled(Math.floor(i/2)+1),i=>i%2?'背面':'前'),...standby(),...repeat(10,i=>'左'+circled(Math.floor(i/2)+1),i=>i%2?'背面':'前')]},
 {name:'背骨ライン伸ばし',minutes:2,memo:'左足を折る＞右足を後ろへ伸ばす＞右手を伸ばす\n呼吸を止めず背筋を伸ばす',steps:[...standby(),...repeat(10,i=>'右'+circled(Math.floor(i/2)+1),i=>i%2?'伸ばす':'床'),...standby(),...repeat(10,i=>'左'+circled(Math.floor(i/2)+1),i=>i%2?'伸ばす':'床')]},
 {name:'片膝立ち全身ストレッチ',minutes:2,memo:'右足をたて、左足を後方へ＞左手を天井＞横に反る\n左手を右膝へ、右手を後頭部に添えて後方へ反る',steps:[...standby(),...repeat(10,i=>'右'+circled(Math.floor(i/5)+1),i=>['天井','横','横','後方','後方'][i%5]),...standby(),...repeat(10,i=>'左'+circled(Math.floor(i/5)+1),i=>['天井','横','横','後方','後方'][i%5])]},
 {name:'斜め腕立て',minutes:2,memo:'頭から踵まで一直線＞胸をバーに近づける',steps:[...standby(),...repeat(10,i=>circled(i+1),'腕立て'),...standby(),...repeat(10,i=>circled(i+1),'腕立て')]},
 {name:'肩甲骨の水平運動',minutes:1,memo:'前にならえ＞肘を引いて肩甲骨を寄せる',steps:repeat(12,i=>circled(Math.floor(i/2)+1),'水平運動')},
 {name:'肩甲骨の垂直運動',minutes:1,memo:'腕を天井に上げる＞肘を引いて肩甲骨を寄せる',steps:repeat(12,i=>circled(Math.floor(i/2)+1),'垂直運動')},
 {name:'スクワット',minutes:2,memo:'おもりを胸の前に＞スクワット\n膝とつま先の向きを揃える',steps:[...standby(),...repeat(10,i=>circled(i+1),'スクワット'),...standby(),...repeat(10,i=>circled(i+1),'スクワット')]},
 {name:'バーベル',minutes:2,memo:'棒を肩に担ぐ＞上体を前へ倒す＞戻す',steps:[...standby(),...repeat(10,i=>circled(i+1),'前傾'),...standby(),...repeat(10,i=>circled(i+1),'前傾')]}
].map((item,index)=>({...item,index,durationSeconds:item.minutes*60}));
