import { createSoundtrack } from './soundtrack.js?v=9722f61cf8c1';

const root = document.querySelector('#scene');
const reviewDialog = document.querySelector('#review');
const sound = createSoundtrack(document.querySelector('#music'), document.querySelector('#music-label'));
const chapterNames = ['Cánh cửa', 'Con đường ký ức', 'Album kỷ niệm', 'Lá thư của Bảo', 'Bữa tiệc'];
const chapterMounts = ['mountDoor','mountWalk','mountAlbum','mountLetter','mountParty'];
let chapter = 0, active, reviewSession, cats, catEngine, kittyGeneration = 0;
let released = false, albumComplete = false, navigated = false;
const pair = document.createElement('div');
pair.className = 'story-cat-pair';
Object.assign(pair.style, {width:'100%',height:'100%',position:'relative'});
let memoriesPromise;
function readMemories() {
  return memoriesPromise ||= fetch('./memories.json', {cache:'no-cache'}).then(async response => {
    if (!response.ok) throw new Error('Không đọc được danh sách kỷ niệm.');
    const result = await response.json();
    if (!Array.isArray(result.timeline) || !Array.isArray(result.album)) throw new Error('Danh sách ảnh sai định dạng.');
    return result;
  }).catch(error => {
    memoriesPromise = undefined;
    return {timeline:[], album:[], loadError:error.message};
  });
}
function engine() {
  const generation = kittyGeneration;
  return catEngine ||= import('./engine.js?v=79c32783273e').then(m => m.createCats(pair)).then(instance => {
    if (generation !== kittyGeneration) { instance.destroy(); throw new DOMException('Đã phát lại', 'AbortError'); }
    return cats = instance;
  });
}
function writePhase(name) {
  document.body.dataset.phase = name;
  document.dispatchEvent(new CustomEvent('storybook:phase',{detail:{chapter,phase:name}}));
}
function scopedCats(session) {
  return {
    mount(el) { if (!session.signal.aborted && el) el.append(pair); },
    async play(name, options) {
      if (session.signal.aborted || (name === 'release' && (!albumComplete || released))) return;
      const player = await engine();
      if (session.signal.aborted) return;
      if (name === 'release') released = true;
      return player.play(name, options);
    },
    setPaused(value) { if (!session.signal.aborted) engine().then(p => {if(!session.signal.aborted) p.setPaused(value);}).catch(()=>{}); },
    setWalking(value) { if (!session.signal.aborted) engine().then(p => {if(!session.signal.aborted) p.setWalking(value);}).catch(()=>{}); }
  };
}
function sessionFor(container) {
  const ctrl = new AbortController();
  const session = {ctrl, signal:ctrl.signal, cleanup:null, stop() {
    ctrl.abort(); this.cleanup?.(); this.cleanup = null;
    container.querySelectorAll('video').forEach(v=>v.pause());
  }};
  return session;
}
function showError(container, error) {
  if (error?.name === 'AbortError') return;
  console.error(error);
  const box = document.createElement('section'), title = document.createElement('h1'), message = document.createElement('p'), retry = document.createElement('button');
  box.className = 'story-error'; title.textContent = 'Trang truyện chưa mở được'; message.textContent = 'Vui lòng mở lại cuốn truyện từ máy đang lưu bản kỷ niệm.'; retry.className = 'primary'; retry.textContent = 'Mở lại'; retry.onclick = () => location.reload();
  box.append(title,message,retry); container.replaceChildren(box);
}
async function openChapter(number) {
  active?.stop();
  const session = active = sessionFor(root);
  chapter = number; navigated = false;
  document.body.dataset.scene = number;
  root.replaceChildren(); root.setAttribute('aria-label', chapterNames[number-1]);
  document.querySelector('#chapter-no').textContent = String(number).padStart(2,'0');
  document.querySelectorAll('#chapters li').forEach((el,i)=>{if (i+1===number) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');});
  root.focus({preventScroll:true}); window.scrollTo(0,0);
  try {
    const module = await (number <= 3 ? import('./scenes-early.js?v=98e36f3393ff') : import('./scenes-late.js?v=67ff55410fcc'));
    const memories = number === 1 ? {timeline:[],album:[]} : await readMemories();
    if (session.signal.aborted) return;
    const ctx = {root,signal:session.signal,memories,
      warmWalk: () => readMemories().then(data => module.warmPrint(data.timeline[0])),
      cats:scopedCats(session),review:false,
      phase:name=>{if(!session.signal.aborted)writePhase(name);},
      next() {
        if (session.signal.aborted || navigated || number >= 5) return;
        if (number === 3) albumComplete = true;
        navigated = true; return openChapter(number+1);
      }, replay,reviewAlbum,closeReview
    };
    const cleanup = await module[chapterMounts[number-1]](ctx);
    if (typeof cleanup === 'function') { if(session.signal.aborted) cleanup(); else session.cleanup = cleanup; }
  } catch(e) { if(!session.signal.aborted) showError(root,e); }
}
function closeReview() {
  if (!reviewSession) return;
  reviewSession.stop(); reviewSession = null;
  if (reviewDialog.open) reviewDialog.close();
  document.querySelector('#review-body').replaceChildren();
}
async function reviewAlbum() {
  if (chapter !== 5 || reviewSession) return;
  const container = document.querySelector('#review-body');
  const session = reviewSession = sessionFor(container);
  reviewDialog.showModal();
  try {
    const [{mountAlbum},memories] = await Promise.all([import('./scenes-early.js?v=98e36f3393ff'),readMemories()]);
    if (session.signal.aborted) return;
    const cleanup = await mountAlbum({root:container,signal:session.signal,memories,review:true,closeReview,
      next:closeReview,phase(){},cats:{mount(){},play:async()=>{},setPaused(){},setWalking(){}}});
    if (typeof cleanup === 'function') { if(session.signal.aborted) cleanup(); else session.cleanup=cleanup; }
  } catch(e){ if(!session.signal.aborted) showError(container,e); }
}
reviewDialog.addEventListener('cancel', e=>{e.preventDefault();closeReview();});
reviewDialog.addEventListener('click', e=>{if(e.target===reviewDialog)closeReview();});
function replay() {
  closeReview(); active?.stop(); kittyGeneration++; cats?.destroy(); cats = null; catEngine = null;
  pair.replaceChildren(); albumComplete = false; released = false; return openChapter(1);
}
root.addEventListener('click', e=>{if(chapter===1 && e.target.closest('button,[role="button"]')) sound.startAfterGesture();},true);
openChapter(1);
