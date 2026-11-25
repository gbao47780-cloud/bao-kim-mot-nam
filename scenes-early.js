const PHOTO_COUNT = 18;
const WALK_INTERVAL = 2800;
const PHOTO_DWELL = 550;
const ALBUM_INTERVAL = 4600;
const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const find = (root, selector) => root.querySelector(selector);
const source = item => item?.src || item?.full || item?.url || item?.image || '';
const videoItem = item => /^(video)(\/|$)/i.test(item?.type || item?.kind || item?.mimeType || '') ||
  /\.(mp4|webm|m4v|mov)(?:[?#]|$)/i.test(source(item));
const photoAlt = item => item.alt || item.caption || 'Ảnh kỷ niệm của Bảo và Kim';

function listen(target, type, callback, signal) {
  target.addEventListener(type, callback, {signal});
}

const favoritesKey = 'bao-kim-mot-nam:favorites';
let favorites = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
  if (Array.isArray(saved)) favorites = new Set(saved.filter(id => typeof id === 'string'));
} catch { /* The hearts still work for this visit if storage is unavailable. */ }

function isFavorite(item) { return favorites.has(item?.id || source(item)); }
function toggleFavorite(item) {
  const id = item.id || source(item);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  try { localStorage.setItem(favoritesKey, JSON.stringify([...favorites])); } catch {}
}
function syncHeart(button, item, visible) {
  button.hidden = !visible;
  const liked = isFavorite(item);
  button.setAttribute('aria-pressed', String(liked));
  button.setAttribute('aria-label', liked ? 'Bỏ yêu thích ảnh này' : 'Thả tim cho ảnh này');
  button.textContent = liked ? '♥' : '♡';
}

function swipePages(surface, prev, next, signal) {
  let start, swiped = false;
  listen(surface, 'pointerdown', e => {
    swiped = false;
    start = undefined;
    if (!e.isPrimary || e.pointerType === 'mouse' || e.target.closest('video')) return;
    start = {id:e.pointerId, x:e.clientX, y:e.clientY};
  }, signal);
  listen(surface, 'pointercancel', () => { start = undefined; }, signal);
  listen(surface, 'pointerup', e => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = undefined;
    if (Math.abs(dx) < 38 || Math.abs(dx) < 1.6 * Math.abs(dy)) return;
    swiped = true;
    const button = dx < 0 ? next : prev;
    if (!button.disabled && !button.hidden) button.click();
  }, signal);
  surface.addEventListener('click', e => {
    if (swiped && e.detail) { e.preventDefault(); e.stopImmediatePropagation(); swiped = false; }
  }, {capture:true, signal});
}

function later(signal) {
  let id;
  const clear = () => clearTimeout(id);
  signal.addEventListener('abort', clear, {once: true});
  return {
    clear,
    set(callback, time) {
      clear();
      if (!signal.aborted) id = setTimeout(callback, time);
    }
  };
}

function catsAt(ctx, host, name) {
  ctx.cats.mount(host);
  ctx.cats.setPaused(false);
  ctx.cats.setWalking(name === 'walk');
  void ctx.cats.play(name, {loop: true});
}

function photo(item) {
  const image = new Image();
  image.alt = photoAlt(item);
  image.decoding = 'async';
  return image;
}

// Keep the current print and its neighbors decoded. Large originals are for zoom.
const prints = new Map();
function readyPrint(item, priority = 'auto') {
  const url = item.thumb || source(item);
  let pending = prints.get(url);
  if (pending) prints.delete(url);
  else {
    const image = photo(item);
    image.fetchPriority = priority;
    image.src = url;
    pending = image.decode().catch(async error => {
      if (url === source(item)) throw error;
      image.src = source(item);
      await image.decode();
    }).then(() => image);
    pending.catch(() => { if (prints.get(url) === pending) prints.delete(url); });
  }
  prints.set(url, pending);
  if (prints.size > 3) prints.delete(prints.keys().next().value);
  return pending;
}

export function warmPrint(item) {
  if (source(item) && !videoItem(item) && !document.hidden && !navigator.connection?.saveData) {
    readyPrint(item, 'low').catch(() => {});
  }
}

export function mountDoor(ctx) {
  const {root, signal} = ctx;
  root.innerHTML = `
    <section class="bk-early bk-cover" aria-labelledby="bk-cover-title">
      <div class="bk-cover-copy">
        <p class="bk-letterpress">Kỷ niệm một năm</p>
        <h1 id="bk-cover-title">Bảo <em>&amp;</em> Kim</h1>
        <p class="bk-dedication">Gửi Kim, người đã làm những ngày bình thường của Bảo trở nên thật đáng nhớ.</p>
        <button type="button" class="primary bk-cover-start">Mở cửa kỷ niệm <span aria-hidden="true">↗</span></button>
        <p class="bk-cover-date"><time datetime="2025-11-23">23.11.2025</time><span aria-hidden="true">—</span><time datetime="2026-11-23">23.11.2026</time></p>
      </div>
      <figure class="bk-print">
        <div class="bk-door-art" role="group" aria-label="Cánh cửa màu nước dẫn vào khu vườn kỷ niệm">
          <div class="bk-portal" aria-hidden="true">
            <div class="bk-door-glow"></div>
            <div class="bk-door-frame"></div>
            <div class="bk-hinge"><div class="bk-door-leaf"></div></div>
          </div>
          <div class="bk-cover-cats"></div><button type="button" class="bk-door-hotspot" aria-label="Chạm cánh cửa để bắt đầu"></button>
        </div>
        <figcaption>chuyện của hai đứa mình</figcaption>
        <span class="bk-washi" aria-hidden="true"></span>
        <span class="bk-stamp" aria-hidden="true">♥<small>23 NOV</small></span>
      </figure>
    </section>`;
  catsAt(ctx, find(root, '.bk-cover-cats'), 'idle');
  const stage = find(root, '.bk-cover');
  const hinge = find(root, '.bk-hinge');
  const button = find(root, '.bk-cover-start');
  const end = later(signal);
  for (const [asset, part] of [['door-frame', 'frame'], ['door-leaf', 'leaf']]) {
    const image = new Image();
    listen(image, 'load', () => stage.classList.add('bk-has-' + part), signal);
    image.src = './art/' + asset + '.webp';
  }

  listen(find(root, '.bk-door-hotspot'), 'click', () => button.click(), signal);
  listen(button, 'click', () => {
    button.disabled = true;
    stage.classList.add('bk-opening');
    ctx.phase('doorOpen');
    ctx.warmWalk?.();
    const advance = () => {
      end.clear();
      if (!signal.aborted) ctx.next();
    };
    if (motion()) {
      end.set(advance, 100);
      return;
    }
    listen(hinge, 'transitionend', event => {
      if (event.target === hinge && event.propertyName === 'transform') advance();
    }, signal);
    end.set(advance, 1050);
  }, signal);
}

export function mountWalk(ctx) {
  const {root, signal} = ctx;
  const entries = ctx.memories.timeline ?? [];
  const valid = entries.length === PHOTO_COUNT &&
    entries.every(item => source(item) && !videoItem(item)) &&
    new Set(entries.map(source)).size === PHOTO_COUNT;
  root.innerHTML = `
    <section class="bk-early bk-walk" aria-labelledby="bk-walk-title">
      <header class="bk-scene-head">
        <h1 id="bk-walk-title">Con đường ký ức</h1>
        <div class="bk-photo-tools"><p class="bk-photo-count" aria-live="polite"></p><button class="bk-heart" type="button" hidden></button></div>
      </header>
      <div class="bk-scrapbook">
        <span class="bk-sticker bk-sticker-heart" aria-hidden="true">♥</span>
        <span class="bk-sticker bk-sticker-star" aria-hidden="true">✦</span>
        <span class="bk-sticker bk-sticker-flower" aria-hidden="true">✿</span>
        <span class="bk-sticker bk-sticker-bow" aria-hidden="true">୨୧</span>
        <figure class="bk-polaroid" hidden>
          <button class="bk-photo-open" type="button" aria-label="Xem ảnh lớn" disabled></button>
          <figcaption></figcaption>
          <span class="bk-washi" aria-hidden="true"></span>
        </figure>
        <p class="bk-media-state" role="status"></p>
      </div>
      <div class="bk-trail" aria-label="Bảo và Kim đi trên con đường ký ức">
        <span class="bk-paw" aria-hidden="true">🐾</span>
        <div class="bk-walk-cats"></div>
      </div>
      <div class="bk-controls">
        <button type="button" class="secondary bk-prev" aria-label="Ảnh trước">← <span>Trước</span></button>
        <button type="button" class="secondary bk-auto"></button>
        <button type="button" class="secondary bk-next" aria-label="Ảnh sau"><span>Sau</span> →</button>
        <button type="button" class="secondary bk-retry" hidden>Thử tải lại</button>
        <button type="button" class="primary bk-continue" hidden></button>
      </div>
      <dialog class="bk-photo-dialog" aria-label="Ảnh kỷ niệm phóng to">
        <button type="button" class="secondary bk-photo-close" autofocus>Đóng <span aria-hidden="true">×</span></button>
        <figure><div class="bk-photo-large"></div><figcaption></figcaption></figure>
      </dialog>
    </section>`;
  const trail = find(root, '.bk-trail');
  trail.dataset.step = String(1 / (PHOTO_COUNT - 1));
  trail.dataset.interval = String(WALK_INTERVAL / 1000);
  const polaroid = find(root, '.bk-polaroid');
  const counter = find(root, '.bk-photo-count');
  const caption = find(polaroid, 'figcaption');
  const state = find(root, '.bk-media-state');
  const open = find(root, '.bk-photo-open');
  const heart = find(root, '.bk-heart');
  const dialog = find(root, '.bk-photo-dialog');
  const large = find(dialog, '.bk-photo-large');
  const prev = find(root, '.bk-prev');
  const next = find(root, '.bk-next');
  const auto = find(root, '.bk-auto');
  const proceed = find(root, '.bk-continue');
  const retry = find(root, '.bk-retry');
  const timer = later(signal);
  const dwell = later(signal);
  const seen = new Set();
  let index = 0;
  let running = valid && !motion();
  let loaded = false;
  let failed = !valid;
  let inView = false;
  let finished = false;
  let stopped = false;
  let advanced = false;
  let request = 0;
  catsAt(ctx, find(root, '.bk-walk-cats'), running ? 'walk' : 'idle');

  function sync() {
    syncHeart(heart, entries[index], loaded);
    const paused = !running || failed || !open.firstElementChild || !inView || document.hidden || dialog.open;
    ctx.cats.setPaused(paused && !finished);
    ctx.cats.setWalking(!paused && !finished);
    counter.textContent = valid
      ? 'Ảnh ' + (index + 1) + ' / ' + PHOTO_COUNT + ' · Đã xem ' + seen.size
      : 'Đã xem 0 / ' + PHOTO_COUNT + ' ảnh';
    prev.disabled = !valid || !index || dialog.open;
    next.disabled = !valid || !seen.has(index) || index === PHOTO_COUNT - 1 || dialog.open;
    auto.textContent = running ? 'Tạm dừng' : 'Tự động đi';
    auto.disabled = !valid || failed || finished || dialog.open;
    retry.hidden = !valid || !failed;
    proceed.hidden = !stopped && !(ctx.preview === true && failed && !finished);
    proceed.textContent = stopped ? 'Mở album' : 'Tiếp tục bản xem thử';
  }

  async function finish() {
    if (finished) return;
    finished = true;
    running = false;
    timer.clear();
    ctx.phase('allMemoriesShown');
    sync();
    await ctx.cats.play('stop', {loop: false});
    if (signal.aborted) return;
    stopped = true;
    void ctx.cats.play('idle', {loop: true});
    ctx.phase('catsStopped');
    sync();
  }

  function schedule() {
    timer.clear();
    dwell.clear();
    sync();
    if (!loaded || !inView || document.hidden || dialog.open || failed) return;
    if (!seen.has(index)) {
      dwell.set(() => {
        seen.add(index);
        sync();
        if (seen.size === PHOTO_COUNT) void finish();
      }, PHOTO_DWELL);
    }
    if (running && !finished && index < PHOTO_COUNT - 1) {
      timer.set(() => {
        if (seen.has(index)) show(index + 1);
      }, WALK_INTERVAL);
    }
  }

  async function show(position) {
    const version = ++request;
    index = position;
    loaded = false;
    failed = false;
    open.disabled = true;
    state.textContent = open.firstElementChild ? '' : 'Đang tải ảnh…';
    schedule();
    const item = entries[position];
    try {
      const image = await readyPrint(item, 'high');
      if (signal.aborted || version !== request) return;
      image.alt = photoAlt(item);
      polaroid.style.setProperty('--photo-ratio', image.naturalWidth / image.naturalHeight);
      if (open.firstElementChild && !motion()) {
        image.animate([{opacity: .86}, {opacity: 1}], {duration: 180, easing: 'ease-out'});
      }
      open.replaceChildren(image);
      polaroid.hidden = false;
      caption.textContent = [item.dateLabel || item.date, item.caption].filter(Boolean).join(' · ');
      trail.dataset.progress = String(position / (PHOTO_COUNT - 1));
      loaded = true;
      open.disabled = false;
      state.textContent = '';
      warmPrint(entries[position + 1]);
    } catch {
      if (signal.aborted || version !== request) return;
      failed = true;
      running = false;
      polaroid.hidden = true;
      state.textContent = 'Ảnh này hiện không tải được từ nguồn kỷ niệm.';
    }
    schedule();
  }

  swipePages(open, prev, next, signal);
  listen(heart, 'click', () => {
    if (loaded) { toggleFavorite(entries[index]); sync(); }
  }, signal);

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.intersectionRatio >= 0.5;
    schedule();
  }, {threshold: 0.5});
  observer.observe(open);
  signal.addEventListener('abort', () => {
    observer.disconnect();
    if (dialog.open) dialog.close();
  }, {once: true});
  listen(document, 'visibilitychange', schedule, signal);
  listen(auto, 'click', () => {
    running = !running;
    if (running) void ctx.cats.play('walk', {loop: true});
    schedule();
  }, signal);
  listen(prev, 'click', () => show(index - 1), signal);
  listen(next, 'click', () => show(index + 1), signal);
  listen(retry, 'click', () => show(index), signal);
  let zoomRequest = 0;
  listen(open, 'click', async () => {
    const version = ++zoomRequest;
    const item = entries[index];
    large.replaceChildren(open.firstElementChild.cloneNode());
    find(dialog, 'figcaption').textContent = caption.textContent;
    dialog.showModal();
    schedule();
    const full = photo(item);
    full.src = item.full || item.fullSrc || source(item);
    try {
      await full.decode();
      if (!signal.aborted && dialog.open && version === zoomRequest) large.replaceChildren(full);
    } catch {
      // The decoded print remains available when the original cannot be fetched.
    }
  }, signal);
  listen(find(dialog, '.bk-photo-close'), 'click', () => dialog.close(), signal);
  listen(dialog, 'click', event => {
    if (event.target === dialog) dialog.close();
  }, signal);
  listen(dialog, 'close', () => {
    zoomRequest++;
    large.replaceChildren();
    schedule();
    open.focus();
  }, signal);
  listen(proceed, 'click', () => {
    if (advanced || (!stopped && !(ctx.preview === true && failed))) return;
    advanced = true;
    if (!stopped) ctx.phase('walkSourceUnavailablePreview');
    ctx.next();
  }, signal);

  if (valid) show(0);
  else {
    state.textContent = 'Cần đủ 18 ảnh từ thư mục “Ảnh kỉ niệm” để đi hết con đường này.';
    sync();
  }
}

const bookTitle = '365 Ngày Nắng Trong Mắt Nhau';
const dedication = 'Thời gian vốn vội vã, nhưng từ ngày có em, từng khoảnh khắc đều hóa thành hình hài rõ nét. Cảm ơn em vì một năm dịu dàng đến thế.';

function memoryDate(item) {
  const iso = [item.date, item.id, source(item)].join(' ').match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return iso ? iso.split('-').reverse().join('.') : item.caption || '';
}

function favoritePages(items) {
  const groups = new Map();
  for (const item of items) {
    const date = memoryDate(item);
    if (!groups.has(date)) groups.set(date, {key:date, date, items:[]});
    groups.get(date).items.push(item);
  }
  return [...groups.values()];
}

function anniversaryPages(items) {
  const byId = new Map(items.map(item => [item.id, item]));
  const pictures = (date, ...numbers) => (numbers.length ? numbers : [0]).map(n =>
    byId.get('memory-' + date + (n ? '-' + String(n).padStart(2,'0') : ''))).filter(Boolean);
  const nov = (...n) => pictures('2026-11-16', ...n);
  const first = (...n) => pictures('2025-11-23', ...n);
  const oct = (...n) => pictures('2026-10-24', ...n);
  const pages = [
    {layout:'lining', items:[]},
    {layout:'intro', note:dedication, items:[]},
    {layout:'polaroids', items:first(1,2,3,4), note:'Tám khung hình đầu tiên, tám nhịp tim còn nguyên bỡ ngỡ — ngày thế giới của anh chính thức có thêm một bầu trời để thương.'},
    {layout:'film', items:first(5,6,7,8), title:'Ngày Gió Bắt Đầu Mang Tên Em', note:'Chẳng cần lời hứa xa xôi, chỉ cần ánh mắt em dừng lại nơi anh là đủ cho một khởi đầu đẹp nhất.'},
    {layout:'postcards', items:pictures('2026-02-09',1,2), title:'Chớm Xuân & Nắng Tháng Hai', note:'Mùa xuân đầu tiên đi cạnh nhau, nụ cười em còn rạng rỡ hơn cả nắng tháng Hai.'},
    {layout:'quiet', items:pictures('2026-02-28'), note:'Hạnh phúc hóa ra giản dị lắm: là khi hai bàn tay tự nhiên tìm thấy nhau giữa những ngày cuối tháng.'},
    {layout:'layers', items:pictures('2026-04-18',1,2), note:'Tháng Tư đổ nắng vàng lên phố, còn em mang dịu dàng phủ kín lòng anh.'},
    {layout:'diagonal', items:[...pictures('2026-08-08'),...pictures('2026-08-29')], title:'Nắng Hạ & Khúc Giao Mùa', note:'Từ hạ rực rỡ sang gió cuối tháng Tám, tình yêu mình không ồn ào, chỉ lặng lẽ bén rễ sâu hơn.'},
    {layout:'autumn-left', items:oct(1,2), title:'Gió Thu Tháng Mười', note:'Tháng Mười se lạnh đầu mùa, nhưng tay em vẫn ấm. Mùa thu đẹp nhất là mùa thu có em trong từng khung hình.'},
    {layout:'autumn-right', items:oct(3), center:oct(2)[0]},
    {layout:'magazine', items:nov(1,2,3), title:'Trọn Vẹn 365 Ngày'},
    {layout:'magazine-reverse', items:nov(4,5,6), note:'365 ngày nhìn lại, từng nụ cười giòn tan nơi đây đều nhắc anh rằng: được thương em là may mắn lớn nhất.'},
    {layout:'closing', items:nov(7,8), note:'Khép lại năm đầu tiên để mở ra thật nhiều mùa xuân, mùa thu và những cuốn album tiếp theo mang tên chúng mình.'},
    {layout:'bleed', items:nov(9), date:'23.11.2025 — 23.11.2026'}
  ];
  const photos = pages.flatMap(page => page.items);
  if (photos.length !== 27 || new Set(photos).size !== items.length) return favoritePages(items);
  return pages.map((page, number) => ({number, key:'page-' + number,
    date:page.items.length ? memoryDate(page.items[0]) : '', ...page}));
}

export function mountAlbum(ctx) {
  const {root, signal} = ctx;
  const all = ctx.memories.album ?? [];
  let days = anniversaryPages(all), offset = 0, likedOnly = false;
  let opened = false, ready = false, running = false, failed = false, advanced = false;
  let turning = false;
  let generation = 0, viewerDay, viewerIndex = 0, viewerGeneration = 0;
  const seen = new Set(), timer = later(signal), opening = later(signal);
  warmPrint(all[0]);

  root.innerHTML = `
    <section class="bk-early bk-album" aria-labelledby="bk-album-title">
      <header class="bk-scene-head"><h1 id="bk-album-title">${bookTitle}</h1>
        <div class="bk-photo-tools"><p class="bk-page-count" aria-live="polite"></p>
          <button type="button" class="bk-filter" aria-pressed="false" hidden>Ảnh đã thích</button></div></header>
      <div class="bk-album-stage">
        <div class="bk-book">
          <div class="bk-book-page" hidden></div>
          <button type="button" class="bk-book-cover" aria-label="Mở album 365 Ngày Nắng Trong Mắt Nhau"><span class="bk-cloth-title">23.11.2025 — Một Vòng Tròn Yêu Thương</span><span class="bk-cover-window"></span></button>
        </div>
        <div class="bk-album-cats"></div>
      </div>
      <p class="bk-media-state" role="status"></p>
      <div class="bk-controls">
        <button type="button" class="primary bk-album-open">Mở album</button>
        <button type="button" class="secondary bk-prev" aria-label="Trang trước" hidden>← Trước</button>
        <button type="button" class="secondary bk-auto" hidden></button>
        <button type="button" class="secondary bk-next" aria-label="Trang sau" hidden>Sau →</button>
        <button type="button" class="secondary bk-retry" hidden>Thử tải lại</button>
        <button type="button" class="primary bk-continue" hidden>Đọc thư của Bảo</button>
        <button type="button" class="secondary bk-review-close" ${ctx.review ? '' : 'hidden'}>Đóng album</button>
      </div>
      <dialog class="bk-note-dialog" aria-label="Lời nhắn trong album">
        <h2></h2><p></p><button type="button" class="secondary">Đóng ×</button>
      </dialog>
      <dialog class="bk-photo-dialog bk-album-viewer" aria-label="Kỷ niệm trong album">
        <div class="bk-viewer-head"><p class="bk-viewer-date"></p><button type="button" class="secondary bk-photo-close" autofocus>Đóng ×</button></div>
        <div class="bk-photo-large"></div>
        <div class="bk-photo-tools"><button type="button" class="secondary bk-view-prev" aria-label="Kỷ niệm trước">←</button>
          <span class="bk-view-index"></span><button type="button" class="bk-heart"></button>
          <button type="button" class="secondary bk-view-next" aria-label="Kỷ niệm sau">→</button></div>
      </dialog>
    </section>`;
  const q = selector => find(root, selector);
  const book = q('.bk-book'), cover = q('.bk-book-cover'), spread = q('.bk-book-page');
  const open = q('.bk-album-open'), prev = q('.bk-prev'), next = q('.bk-next'), auto = q('.bk-auto');
  const filter = q('.bk-filter'), proceed = q('.bk-continue'), retry = q('.bk-retry'), status = q('.bk-media-state');
  const viewer = q('.bk-album-viewer'), large = q('.bk-photo-large'), heart = q('.bk-heart');
  const viewPrev = q('.bk-view-prev'), viewNext = q('.bk-view-next');
  const portrait = all.find(item => item.id === 'memory-2026-11-16-01') || all[0];
  if (portrait?.thumb) {
    const image = photo(portrait); image.src = portrait.thumb;
    cover.querySelector('.bk-cover-window').append(image);
  }
  const noteDialog = q('.bk-note-dialog');
  listen(find(noteDialog,'button'),'click',() => noteDialog.close(),signal);
  listen(noteDialog,'close',sync,signal);
  listen(noteDialog,'cancel',e => e.stopPropagation(),signal);
  if (ctx.review) q('.bk-album-cats').hidden = true;
  else {
    ctx.cats.mount(q('.bk-album-cats'));
    ctx.cats.setPaused(false); ctx.cats.setWalking(false);
    void ctx.cats.play('sit', {loop:false});
  }
  function sync() {
    const last = Math.min(offset + 2, days.length);
    const numbered = days.slice(offset,last).map((day,i) => day.number ?? offset+i+1).filter(Boolean);
    const total = days[0]?.number === 0 ? days.length - 1 : days.length;
    q('.bk-page-count').textContent = opened && numbered.length ? 'Trang ' + numbered.join('–') + ' / ' + total : '';
    filter.hidden = !ctx.review || !opened || !all.some(isFavorite);
    filter.setAttribute('aria-pressed', String(likedOnly));
    filter.disabled = turning;
    filter.textContent = likedOnly ? 'Toàn bộ album' : 'Ảnh đã thích';
    prev.hidden = next.hidden = auto.hidden = !opened || days.length <= 2;
    prev.disabled = turning || offset === 0;
    next.disabled = turning || (!ready && !ctx.review) || last >= days.length;
    auto.disabled = next.disabled || failed;
    auto.textContent = running ? 'Dừng tự lật' : 'Tự lật';
    retry.hidden = !failed || !days.length;
    proceed.hidden = !!ctx.review || !opened || !((!turning && ready && days.length && seen.size === days.length) || (ctx.preview && failed));
    timer.clear();
    if (running && ready && !next.disabled && !document.hidden && !viewer.open && !noteDialog.open && !turning)
      timer.set(() => turn(2), ALBUM_INTERVAL);
  }

  function stopVideo() {
    const video = large.querySelector('video');
    if (video) { video.pause(); video.dispatchEvent(new Event('storybook:video-closed', {bubbles:true})); }
  }
  async function displayMemory(day, at) {
    stopVideo();
    viewerDay = day; viewerIndex = at;
    const version = ++viewerGeneration, item = day.items[at];
    q('.bk-viewer-date').textContent = memoryDate(item);
    q('.bk-view-index').textContent = (at + 1) + ' / ' + day.items.length;
    syncHeart(heart, item, !videoItem(item));
    viewPrev.disabled = at === 0; viewNext.disabled = at + 1 === day.items.length;
    if (!viewer.open) viewer.showModal();
    sync();
    if (videoItem(item)) {
      const video = document.createElement('video');
      video.controls = true; video.playsInline = true; video.preload = 'metadata';
      if (item.poster) video.poster = item.poster;
      video.src = source(item);
      large.replaceChildren(video);
      video.play().catch(() => {});
    } else {
      const preview = photo(item); preview.src = item.thumb || source(item);
      large.replaceChildren(preview);
      const full = photo(item); full.src = item.full || item.fullSrc || source(item);
      try {
        await full.decode();
        if (!signal.aborted && viewer.open && version === viewerGeneration) large.replaceChildren(full);
      } catch { /* Keep the smaller print available. */ }
    }
  }

  function leaf(day, number, loads) {
    const paper = document.createElement('article');
    paper.className = 'bk-leaf';
    if (!day) { paper.classList.add('bk-blank'); return paper; }
    const layout = day.layout;
    if (layout) paper.dataset.layout = layout;
    if (layout === 'lining') {
      paper.innerHTML = '<div class="bk-endpaper"><i aria-hidden="true">❦</i><span>Bảo &amp; Kim</span></div>';
      return paper;
    }
    paper.innerHTML = '<header><time></time><span></span></header><div class="bk-montage"></div><div class="bk-inscription"></div>';
    const date = find(paper,'time'); date.textContent = day.date;
    find(paper,'header span').textContent = String(day.number ?? number).padStart(2,'0');
    const inscription = find(paper,'.bk-inscription');
    if (day.title) {
      const title = document.createElement('h2'); title.textContent = day.title; inscription.append(title);
    }
    if (day.note) {
      const note = document.createElement('button');
      note.type = 'button'; note.className = 'bk-note'; note.textContent = day.note;
      note.title = 'Đọc lời nhắn';
      note.onclick = () => {
        const dialog = q('.bk-note-dialog');
        find(dialog,'h2').textContent = day.title || (layout === 'intro' ? bookTitle : day.date);
        find(dialog,'p').textContent = day.note;
        dialog.showModal(); sync();
      };
      inscription.append(note);
    }
    const mosaic = find(paper,'.bk-montage'), count = day.items.length;
    mosaic.dataset.count = count;
    const cells = count + 3;
    if (!layout && count >= 4) mosaic.style.gridTemplateRows = 'repeat(' + Math.ceil(cells / 3) + ',minmax(0,1fr))';
    day.items.forEach((item, i) => {
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'bk-print-tile';
      tile.setAttribute('aria-label', (videoItem(item) ? 'Phát video' : 'Xem ảnh') + ' · ' + memoryDate(item) + ' · ' + (i+1));
      if (videoItem(item)) tile.classList.add('bk-video-tile');
      if (!layout && i === count-1 && count >= 4 && cells % 3) tile.style.gridColumn = 'span ' + (4 - cells % 3);
      mosaic.append(tile);
      tile.onclick = () => displayMemory(day, i);
      const image = photo(item);
      const thumb = videoItem(item) ? item.poster || item.thumb : item.thumb || source(item);
      if (!thumb) return;
      image.src = thumb;
      loads.push(image.decode().catch(async error => {
        if (videoItem(item) || thumb === source(item)) throw error;
        image.src = source(item); await image.decode();
      }).then(() => tile.prepend(image)));
    });
    if (day.center) {
      const otherHalf = document.createElement('button');
      otherHalf.className = 'bk-photo-seam'; otherHalf.type = 'button'; otherHalf.tabIndex = -1;
      otherHalf.setAttribute('aria-label','Xem ảnh giữa · ' + day.date);
      const image = photo(day.center); image.alt = ''; image.src = day.center.thumb;
      otherHalf.append(image); mosaic.prepend(otherHalf);
      otherHalf.onclick = () => displayMemory(days[offset],1);
    }
    return paper;
  }
  async function draw() {
    const version = ++generation, loads = [];
    ready = false; failed = false; status.textContent = '';
    const pair = days.slice(offset,offset+2);
    spread.replaceChildren(leaf(pair[0],offset+1,loads),leaf(pair[1],offset+2,loads));
    sync();
    if (!pair.length) { failed = true; status.textContent = 'Album chưa có kỷ niệm.'; sync(); return; }
    const results = await Promise.allSettled(loads);
    if (signal.aborted || version !== generation) return;
    failed = results.some(result => result.status === 'rejected');
    ready = !failed;
    if (ready) pair.forEach(day => seen.add(day.key));
    else { running = false; status.textContent = 'Một số ảnh chưa tải được.'; }
    if (!days[offset+2]) running = false;
    sync();
  }
  async function turn(delta) {
    const at = offset + delta;
    if (turning || at < 0 || at >= days.length || (delta > 0 && next.disabled) || viewer.open || noteDialog.open) return;
    // Leave the stationary half showing its old page until the sheet passes over it.
    const forward = delta > 0, moving = forward ? 1 : 0, resting = 1 - moving;
    const animate = !motion();
    const old = animate ? [...spread.children].map(el => el.cloneNode(true)) : [];
    turning = true;
    offset = at;
    spread.inert = true;
    const drawn = draw();
    let sheet, under;
    try {
      if (animate) {
        const side = forward ? 'right' : 'left';
        under = old[resting];
        under.classList.add('bk-under', 'bk-' + (forward ? 'left' : 'right'));
        sheet = document.createElement('div'); sheet.className = 'bk-turn bk-' + side;
        const front = old[moving], back = spread.children[resting].cloneNode(true);
        // draw() attaches images after decode. Populate the verso before it becomes visible.
        const prints = back.querySelectorAll('.bk-print-tile');
        days[offset+resting]?.items.forEach((item,i) => {
          if (prints[i] && !prints[i].firstElementChild) {
            const image = photo(item); image.src = item.thumb || source(item); prints[i].append(image);
          }
        });
        front.classList.add('bk-face'); back.classList.add('bk-face','bk-verso');
        sheet.append(front, back);
        for (const el of [under, sheet]) { el.inert = true; el.setAttribute('aria-hidden','true'); }
        book.append(under,sheet);
        const sign = forward ? -1 : 1;
        const flip = sheet.animate([
          {transform:'rotateY(0deg)'}, {transform:'rotateY(' + sign*82 + 'deg)',offset:.48},
          {transform:'rotateY(' + sign*180 + 'deg)'}
        ], {duration:590,easing:'cubic-bezier(.43,.05,.27,.98)',fill:'forwards'});
        const cancel = () => flip.cancel();
        signal.addEventListener('abort',cancel,{once:true});
        try { await flip.finished; } catch { /* Unmounted while turning. */ }
        signal.removeEventListener('abort',cancel);
      }
      await drawn;
    } finally {
      sheet?.remove(); under?.remove(); spread.inert = false; turning = false;
      if (!signal.aborted) sync();
    }
  }
  function selectDays(onlyLiked, key) {
    likedOnly = onlyLiked && all.some(isFavorite);
    days = likedOnly ? favoritePages(all.filter(isFavorite)) : anniversaryPages(all);
    const pos = days.findIndex(day => day.key === key);
    offset = Math.max(0, pos - pos % 2);
    seen.clear(); running = false; draw();
  }
  listen(heart,'click',() => {
    const item = viewerDay.items[viewerIndex];
    toggleFavorite(item); syncHeart(heart,item,true);
  }, signal);
  listen(viewer,'close',() => {
    viewerGeneration++; stopVideo(); large.replaceChildren();
    if (likedOnly) selectDays(true,viewerDay.key);
    else sync();
  }, signal);
  listen(viewer,'cancel',e => e.stopPropagation(),signal);
  listen(viewer,'click',e => { if (e.target === viewer) viewer.close(); },signal);
  listen(q('.bk-photo-close'),'click',() => viewer.close(),signal);
  listen(viewPrev,'click',() => displayMemory(viewerDay,viewerIndex-1),signal);
  listen(viewNext,'click',() => displayMemory(viewerDay,viewerIndex+1),signal);
  swipePages(large,viewPrev,viewNext,signal);
  swipePages(spread,prev,next,signal);
  listen(filter,'click',() => selectDays(!likedOnly,days[offset]?.key),signal);
  listen(cover,'click',() => open.click(),signal);
  listen(open,'click',() => {
    if (opened) return;
    opened = true; open.hidden = true; spread.hidden = false; book.classList.add('bk-book-opened');
    if (!ctx.review) ctx.phase('albumOpen');
    draw();
    opening.set(() => { cover.hidden = true; },motion() ? 0 : 480);
  },signal);
  listen(prev,'click',() => turn(-2),signal);
  listen(next,'click',() => turn(2),signal);
  listen(auto,'click',() => { running = !running; sync(); },signal);
  listen(retry,'click',draw,signal);
  listen(document,'visibilitychange',sync,signal);
  listen(proceed,'click',() => {
    if (advanced || ctx.review || proceed.hidden) return;
    advanced = true; ctx.phase('albumComplete'); ctx.next();
  },signal);
  listen(q('.bk-review-close'),'click',() => ctx.closeReview(),signal);
  signal.addEventListener('abort',() => { stopVideo(); if (viewer.open) viewer.close(); if (noteDialog.open) noteDialog.close(); },{once:true});
  sync();
}
