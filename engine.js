const manifestUrl = new URL('./cats/manifest.json?v=92570a2e8c4f',import.meta.url);
export async function createCats(container) {
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error('Không thể mở bộ hoạt họa.');
  const {fps,characters} = await response.json();
  const who = ['kim','bao'];
  const canvas = document.createElement('canvas');
  canvas.className='storybook-cats'; canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Kim đeo nơ hồng và Bảo đeo nơ xanh');
  container.replaceChildren(canvas);
  const ctx=canvas.getContext('2d');
  const cache=new Map();
  function atlas(url) {
    const key=new URL(url,import.meta.url).href;
    if (cache.has(key)) {const promise=cache.get(key);cache.delete(key);cache.set(key,promise);return promise;}
    const image=new Image(); image.src=key;
    const promise=image.decode().then(()=>image).catch(e=>{cache.delete(key);throw e;});
    cache.set(key,promise);
    if(cache.size>6)cache.delete(cache.keys().next().value);
    return promise;
  }
  let state, ticket=0, raf=0, previousTime=null, paused=false, walking=false, distance=0, destroyed=false;
  let lanePosition=0, lastPhoto=null;
  let width=0,height=0,dpr=1, mouth=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function resize() {
    width=container.clientWidth; height=container.clientHeight;
    if(!width||!height)return;
    dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    paint(); schedule();
  }
  function paint() {
    if(!state||!width||!height||!container.isConnected)return;
    const frame=state.frame, name=state.name;
    const snuggle=name==='sleep'?1:name==='curl'?frame/23:0;
    const trail=container.closest('.bk-trail');
    const separation=trail ? 174 : 153-82*snuggle;
    const scale=Math.min(height*.97/157,width*(trail ? .56 : .95)/(187+separation));
    const ground=height*.94;
    let x=width/2;
    if(trail){
      const progress=Number(trail.dataset.progress || 0);
      if(reduced.matches || (paused && progress!==lastPhoto)) lanePosition=progress;
      lastPhoto=progress;
      const margin = Math.max(5, width * .015);
      const travel = Math.max(0,width - 2*margin - (187+separation)*scale);
      const shift = travel * lanePosition;
      x += shift - travel/2;
      trail.style.setProperty('--travel',(shift-distance*scale)+'px');
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    for(let i=0;i<2;i++) {
      const tile=state.meta[i], bitmap=state.images[i];
      const idx=frame%tile.count, col=idx%tile.columns,row=Math.floor(idx/tile.columns);
      const rect=tile.frames?.[idx] || {x:col*tile.width,y:row*tile.height,w:tile.width,h:tile.height};
      const anchorX=x+(i===0?-1:1)*separation*scale/2;
      const anchorY=ground-(i===0?4:0)*scale;
      const left=anchorX-(tile.anchor[0]-(rect.offsetX||0))*scale;
      const top=anchorY-(tile.anchor[1]-(rect.offsetY||0))*scale;
      ctx.drawImage(bitmap,rect.x,rect.y,rect.w,rect.h,left,top,rect.w*scale,rect.h*scale);
      if(i===1 && tile.releaseFrame!==undefined){
        const [mx,my]=tile.releaseMouth??[181,135];
        mouth={x:anchorX+(mx-tile.anchor[0])*scale,y:anchorY+(my-tile.anchor[1])*scale};
      }
    }
    canvas.dataset.frame=String(frame);canvas.dataset.clip=name;
  }
  function schedule() {
    if(!raf&&!destroyed&&state&&!state.finished&&!paused&&!document.hidden&&container.isConnected&&width&&height)raf=requestAnimationFrame(tick);
  }
  function tick(now) {
    raf=0;
    if(!state||paused||document.hidden||destroyed||!container.isConnected){previousTime=null;return;}
    const delta=previousTime===null?0:(now-previousTime)/1000;previousTime=now;
    const previousTick=Math.floor(state.elapsed*fps);
    state.elapsed+=delta;
    const lane = container.closest('.bk-trail');
    if (lane) {
      const step = Number(lane.dataset.step);
      const target = Math.min(1, Number(lane.dataset.progress || 0) + (walking ? step : 0));
      const rate = step / Number(lane.dataset.interval);
      const remaining = target-lanePosition;
      lanePosition += Math.sign(remaining)*Math.min(Math.abs(remaining),rate*delta);
    }
    const count=state.meta[1].count, n=Math.floor(state.elapsed*fps);
    const actual=state.loop?n%count:Math.min(count-1,n);
    if (state.name==='walk' && walking) distance+=(n-previousTick)*(state.meta[1].stridePx||0)/fps;
    if (state.name==='stop') {const t=Math.min(1,actual/(count-1));distance=state.baseDistance+24*(2*t-t*t);}
    const frame=reduced.matches&&state.loop?0:actual;
    if (state.frame!==frame || (walking && n!==previousTick)) {state.frame=frame;paint();}
    const release=state.meta[1].releaseFrame;
    if(!state.released&&release!==undefined&&n>=release) {
      state.released=true;
      const box=canvas.getBoundingClientRect();
      state.onRelease?.(mouth?{x:box.left+mouth.x,y:box.top+mouth.y}:undefined);
    }
    if(!state.loop && n>=count) {state.finished=true;state.resolve();return;}
    if(reduced.matches&&state.loop){previousTime=null;return;}
    schedule();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);
  function refresh(){cancelAnimationFrame(raf);raf=0;previousTime=null;paint();schedule();}
  document.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);
  return {
    async play(name,opts={}) {
      if(destroyed)return;
      if(state && state.name===name && state.loop && opts.loop!==false){refresh();return;}
      const version=++ticket;
      const meta=who.map(id=>characters[id][name]);
      const images=await Promise.all(meta.map(c=>atlas(c.src)));
      if(version!==ticket||destroyed)return;
      state?.resolve();
      const loop=opts.loop??meta[1].loop;
      let done;const completion=new Promise(r=>{done=r;});
      if(!container.closest('.bk-trail')){lanePosition=0;lastPhoto=null;}
      if(name==='walk'&&state?.name!=='walk')distance=0;
      state={name,meta,images,loop,resolve:done,elapsed:0,frame:0,finished:false,released:false,onRelease:opts.onRelease,baseDistance:distance};
      resize();refresh();
      if(!loop)await completion;
    },
    setPaused(value){if(paused!==value){paused=value;refresh();}else if(value || reduced.matches){paint();}},
    setWalking(value){walking=value;},
    destroy(){destroyed=true;ticket++;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);state?.resolve();cache.clear();canvas.remove();}
  };
}
