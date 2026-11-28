const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const smooth = 'cubic-bezier(.45,.03,.24,1)';

async function move(element, frames, duration, delay = 0) {
  if (!element || reduce.matches || document.hidden) return;
  const effect = element.animate(frames,{duration,delay,easing:smooth,fill:'both'});
  const finish = () => effect.finish();
  document.addEventListener('visibilitychange',finish);
  reduce.addEventListener('change',finish);
  try { await effect.finished; }
  finally {
    document.removeEventListener('visibilitychange',finish);
    reduce.removeEventListener('change',finish);
    effect.cancel();
  }
}

function placed(layer, element, rect) {
  const origin = layer.getBoundingClientRect();
  Object.assign(element.style,{position:'absolute',left:(rect.left-origin.left)+'px',top:(rect.top-origin.top)+'px',width:rect.width+'px',height:rect.height+'px',margin:'0'});
  layer.append(element);
  return element;
}

function between(from,to) {
  return 'translate('+(from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+(from.width/to.width)+','+(from.height/to.height)+')';
}

export async function leaveChapter(scene, number) {
  if (number === 3) {
    const page = scene.querySelector('.bk-book-page');
    if (page) await move(page.lastElementChild,[
      {transform:'perspective(1000px) rotateY(0)'},{transform:'perspective(1000px) rotateY(-9deg)',offset:.23},
      {transform:'perspective(1000px) rotateY(-178deg)',filter:'brightness(.83)'}
    ],680);
    scene.classList.add('book-resting');
  }
}

export async function revealChapter(root, old, number, memories, oldCat, cakeOrigin) {
  const scene=root.firstElementChild;
  if (!old || !scene) return;
  const layer=document.createElement('div');
  layer.className='chapter-layer'; layer.inert=true; layer.setAttribute('aria-hidden','true');
  const motions=[];
  const cat = scene.querySelector('.story-cat-pair');
  const catHost = cat?.parentElement;
  const targetCat = cat?.getBoundingClientRect();
  const originalStyle = cat?.getAttribute('style');
  try {
    if (reduce.matches || document.hidden) return;
    root.append(layer);
    const source = old.querySelector('.bk-portal, .bk-polaroid, .late-paper');
    const start = source?.getBoundingClientRect();
    if (oldCat?.width && targetCat?.width && number!==1) {
      // Keep the live canvas above both backdrops while their lighting changes.
      placed(layer,cat,targetCat);
      cat.style.transformOrigin='top left';
      motions.push(move(cat,[{transform:between(oldCat,targetCat)},{transform:'none'}],700));
    }
    const oldText = old.querySelectorAll('.bk-cover-copy,.bk-scene-head,.bk-controls,.late-heading,.late-party-actions');
    const newText = scene.querySelectorAll('.bk-cover-copy,.bk-scene-head,.late-heading');
    for (const el of oldText) {
      motions.push(move(el,[{opacity:1},{opacity:0}],190).then(() => {el.style.visibility='hidden';}));
    }
    for (const el of newText) motions.push(move(el,[{opacity:0},{opacity:1}],360,200));
    if (number===2 && start) {
      const bounds=root.getBoundingClientRect();
      const cx=(start.left+start.width/2-bounds.left)/bounds.width*100;
      const cy=(start.top+start.height/2-bounds.top)/bounds.height*100;
      const radius=Math.max(bounds.width,bounds.height)*1.45;
      motions.push(move(scene,[{clipPath:'circle('+start.width*.36+'px at '+cx+'% '+cy+'%)'},{clipPath:'circle('+radius+'px at '+cx+'% '+cy+'%)'}],780));
      motions.push(move(old.querySelector('.bk-print'),[{transform:'scale(1)'},{transform:'scale(1.22)'}],780));
    } else {
      motions.push(move(scene,[{opacity:0},{opacity:1}],number===3?820:650));
    }
    if (number===3 && start && memories.timeline.length) {
      const book=scene.querySelector('.bk-book'), dest=book.getBoundingClientRect();
      const ceiling=Math.min(oldCat?.top??Infinity,targetCat?.top??Infinity);
      const size=Math.min(start.width*.39,112,Math.max(1,(ceiling-root.getBoundingClientRect().top)*.26));
      const count=innerWidth<600?3:5;
      for(let i=0;i<count;i++){
        const item=memories.timeline[Math.round((memories.timeline.length-1)*(count-1-i)/(count-1))];
        const print=document.createElement('div'); print.className='flying-print';
        const img=new Image(); img.alt=''; img.src=item.thumb||item.src; print.append(img);
        const sticker=document.createElement('i'); sticker.className='story-sticker'; sticker.dataset.sticker=['heart','star','flower','bow','berry'][i];print.append(sticker);
        const x=start.left+start.width*(.25+.5*i/(count-1))-size/2;
        const y=Math.min(start.top+start.height*.24,ceiling-size*1.3-14);
        placed(layer,print,{left:x,top:y,width:size,height:size*1.18});
        const dx=dest.left+dest.width*.5-x-size*.5;
        const dy=Math.min(dest.top+dest.height*.38,ceiling-size*.82-12)-y-size*.59;
        motions.push(move(print,[{opacity:0,transform:'rotate(-5deg) scale(.82)'},{opacity:1,offset:.18},
          {transform:'translate('+dx*.38+'px,'+(dy*.45-19)+'px) rotate('+(i%2?10:-9)+'deg) scale(.77)',offset:.53},
          {opacity:0,transform:'translate('+dx+'px,'+dy+'px) rotate(-2deg) scale(.12)'}],840,i*88));
      }
      motions.push(move(book,[{transform:'translateY(8%) scale(.83)'},{transform:'none'}],900));
    }
    if(number===5 && start) {
      const target=scene.querySelector('.wish-envelope');
      const dest=target.getBoundingClientRect();
      const envelope=document.createElement('div'); envelope.className='travelling-envelope';
      placed(layer,envelope,dest);
      target.style.visibility='hidden';
      source.style.visibility='hidden';
      motions.push(move(envelope,[{transform:between(start,dest)},{transform:'none'}],950).finally(()=>target.style.visibility=''));

    }
    if (number === 6) {
      const star = old.querySelector('.wish-guide');
      const plate = scene.querySelector('.atelier-plate');
      if (star && plate) {
        const origin = star.getBoundingClientRect(), end = plate.getBoundingClientRect();
        const x = end.left + end.width/2 - origin.left - origin.width/2;
        const y = end.top + end.height/2 - origin.top - origin.height/2;
        const guide = document.createElement('span'); guide.className='flying-wish'; guide.textContent='✦';
        placed(layer,guide,origin); star.style.visibility='hidden';
        motions.push(move(guide,[{transform:'none'},{transform:'translate('+x*.55+'px,'+(y*.4-26)+'px) rotate(28deg)',offset:.5},{transform:'translate('+x+'px,'+y+'px) scale(.25)',opacity:0}],1050));
      }
    }
    if (number === 7 && cakeOrigin) {
      const cake = scene.querySelector('.wish-cake');
      const target = cake.getBoundingClientRect(), parent = cake.parentElement;
      const style = cake.getAttribute('style');
      placed(layer,cake,target); cake.style.transformOrigin='top left';
      motions.push(move(cake,[{transform:between(cakeOrigin,target)},{transform:'none'}],1050).finally(()=>{
        cake.setAttribute('style',style || ''); parent.prepend(cake);
      }));
    }
    if(number===1 || number===2 || number===7) {
      for(let i=0;i<(innerWidth<600?6:10);i++){
        const petal=document.createElement('i');petal.className='chapter-petal';layer.append(petal);
        petal.style.left=(i%2?88+i%8:2+i%9)+'%';petal.style.top=(3+i*8)+'%';
        motions.push(move(petal,[{opacity:0,transform:'translateY(-8px) rotate(-20deg)'},{opacity:.9,offset:.27},{opacity:0,transform:'translate(13px,54px) rotate(45deg)'}],680,i*22));
      }
    }
    await Promise.all(motions);
  } finally {
    if (cat?.parentElement === layer) {
      cat.setAttribute('style',originalStyle || '');
      catHost.append(cat);
    }
    layer.remove(); old.remove();
  }
}

