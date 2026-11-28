const steps=['waiting','cake_base','cake_layers','frosting','decoration','candle','completed'];
const styles={berry:'Dâu tây ngọt ngào',flower:'Khu vườn hoa nhỏ',star:'Ngôi sao lấp lánh'};
const messages=['Theo ánh sao đến bàn bánh','Đặt chiếc đĩa lên bàn','Xếp từng lớp bánh mềm','Phủ một vòng kem hồng','Chọn một chút ngọt ngào','Thắp nến điều ước','Một chiếc bánh nhỏ, cho một năm thật đặc biệt.'];
const delays=[500,750,1450,1100,1700,1300,6500];

function buildCake(){
  const cake=document.createElement('div');cake.className='wish-cake';cake.setAttribute('role','img');
  cake.innerHTML='<i class="wc-plate"></i><div class="wc-body"><i class="wc-layer wc-bottom"></i><i class="wc-layer wc-middle"></i><i class="wc-layer wc-icing"></i><div class="wc-finished"></div><i class="wc-candle"><b></b></i></div>';
  return cake;
}
export class CakeAtelierController {
  constructor({root,signal,next,phase,story,arrival}){
    this.story=story;this.next=next;this.phase=phase;this.signal=signal;this.index=0;this.active=false;this.paused=false;this.manual=false;this.leaving=false;
    root.innerHTML=`<section class="atelier"><header><p>Xưởng bánh của Bảo &amp; Kim</p><h1>Xưởng bánh phép màu</h1></header><div class="atelier-plate"></div>
      <div class="atelier-panel"><p class="atelier-status" aria-live="polite"></p><div class="atelier-choices" role="group" aria-label="Trang trí bánh">${Object.entries(styles).map(([key,label])=>`<button type="button" data-style="${key}" aria-pressed="false"><img src="./art/cake-${key}.webp" alt="" width="72" height="60">${label}</button>`).join('')}</div>
      <div class="atelier-actions"><button class="secondary atelier-pause">Tạm dừng</button><button class="secondary atelier-skip">Hoàn thành ngay</button><button class="primary atelier-next" hidden>Mang bánh đến bữa tiệc</button></div></div></section>`;
    this.el=root.querySelector('.atelier');this.cake=story.cake=buildCake();this.el.querySelector('.atelier-plate').append(this.cake);
    this.buttons=[...this.el.querySelectorAll('[data-style]')];
    this.buttons.forEach(btn=>btn.addEventListener('click',()=>{this.manual=true;this.decorate(btn.dataset.style);this.schedule();},{signal}));
    this.el.querySelector('.atelier-pause').addEventListener('click',()=>{this.paused=!this.paused;this.render();},{signal});
    this.el.querySelector('.atelier-skip').addEventListener('click',()=>{this.manual=true;this.set(6);},{signal});
    this.el.querySelector('.atelier-next').addEventListener('click',()=>this.advance(),{signal});
    this.el.addEventListener('pointerdown',()=>{this.manual=true;this.schedule();},{signal});
    this.el.addEventListener('focusin',()=>{this.manual=true;this.schedule();},{signal});
    document.addEventListener('visibilitychange',()=>this.schedule(),{signal});
    signal.addEventListener('abort',()=>clearTimeout(this.timer),{once:true});
    this.decorate(story.cakeStyle);this.render();
    Promise.resolve(arrival).then(()=>{this.active=true;this.schedule();});
  }
  decorate(style){
    this.story.cakeStyle=style;this.cake.dataset.style=style;
    const kind=style==='garden-berry' ? 'berry' : style;
    const picture='./art/cake-'+kind+'.webp';
    this.cake.style.setProperty('--cake-picture','url("'+picture+'")');
    this.cake.setAttribute('aria-label','Bánh kỷ niệm · '+styles[kind]);
    this.buttons.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.style===style)));
  }
  set(i){
    if(this.leaving || this.signal.aborted || i<=this.index)return;
    this.index=i;if(i===6)this.phase('cakeComplete');this.render();
  }
  render(){
    this.el.dataset.stage=this.cake.dataset.stage=steps[this.index];this.cake.dataset.level=this.index;
    this.el.querySelector('.atelier-status').textContent=messages[this.index];
    this.el.querySelector('.atelier-pause').textContent=this.paused?'Tiếp tục làm bánh':'Tạm dừng';
    this.el.querySelector('.atelier-pause').hidden=this.index===6;this.el.querySelector('.atelier-skip').hidden=this.index===6;
    this.el.querySelector('.atelier-next').hidden=this.index!==6;this.schedule();
  }
  schedule(){
    clearTimeout(this.timer);
    if(!this.active || this.signal.aborted || this.leaving || document.hidden || (this.paused && this.index<6) || (this.index===6 && this.manual))return;
    this.timer=setTimeout(()=>this.index===6?this.advance():this.set(this.index+1),delays[this.index]);
  }
  advance(){
    if(this.leaving || this.index!==6 || this.signal.aborted)return;
    this.leaving=true;clearTimeout(this.timer);this.next();
  }
}
export function mountAtelier(ctx){new CakeAtelierController(ctx);}

