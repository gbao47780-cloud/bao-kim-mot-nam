const wishes = [
  ['Bình yên','Mong những hôm Kim mệt, bên Bảo luôn có một chỗ để Kim nghỉ ngơi.'],
  ['Niềm vui','Mong hai đứa vẫn tìm được chuyện để cười, cả trong những ngày thật bình thường.'],
  ['Ngày mai','Mong năm sau, tụi mình lại ngồi cạnh nhau và mở thêm một cuốn album.']
];

export function mountWishes({root, signal, cats, next, arrival, phase}) {
  root.innerHTML = `<section class="wish-garden"><header><p>Trong giấc mơ của hai đứa</p><h1>Vườn điều ước</h1></header>
    <div class="wish-sky" aria-label="Ba ngôi sao điều ước">${wishes.map(([name],i)=>`<button class="wish-star" aria-pressed="false" aria-label="Mở điều ước: ${name}"><span aria-hidden="true">✦</span>${name}</button>`).join('')}</div>
    <div class="wish-message" aria-live="polite">Chạm vào một ngôi sao để đọc điều ước.</div>
    <div class="wish-rest"><i class="wish-envelope"></i><div class="wish-cats"></div><span class="wish-guide" aria-hidden="true">✦</span></div>
    <div class="wish-actions"><button class="secondary wish-auto">Tạm dừng</button><button class="primary wish-next" disabled>Đến xưởng bánh</button></div></section>`;
  const stars=[...root.querySelectorAll('.wish-star')], proceed=root.querySelector('.wish-next'),auto=root.querySelector('.wish-auto');
  cats.mount(root.querySelector('.wish-cats'));
  const seen=new Set(); let timer,paused=false,arrived=false,leaving=false;
  function schedule(){
    clearTimeout(timer);
    if(!arrived || paused || document.hidden || leaving || signal.aborted)return;
    timer=setTimeout(()=>{const unseen=stars.findIndex((_,i)=>!seen.has(i));if(unseen<0)advance();else show(unseen);},seen.size?4000:2700);
  }
  function show(i){
    seen.add(i);stars[i].setAttribute('aria-pressed','true');
    root.querySelector('.wish-message').textContent=wishes[i][1];
    proceed.disabled=seen.size<3;schedule();
  }
  function advance(){if(leaving || seen.size!==3)return;leaving=true;clearTimeout(timer);phase('wishesComplete');next();}
  function pause(value){paused=value;auto.textContent=paused?'Tự mở sao':'Tạm dừng';schedule();}
  stars.forEach((star,i)=>star.addEventListener('click',()=>{pause(true);show(i);},{signal}));
  auto.addEventListener('click',()=>pause(!paused),{signal});proceed.addEventListener('click',advance,{signal});
  document.addEventListener('visibilitychange',schedule,{signal});signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
  Promise.resolve(arrival).then(()=>{arrived=true;schedule();});
}

