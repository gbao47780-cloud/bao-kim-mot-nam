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

const albumNotes = {
  '2025-11-23': 'Bó hoa hồng hôm ấy đã nằm gọn trong ảnh. Còn cái ôm của Kim, Bảo vẫn nhớ.',
  '2026-02-09': 'Chiếc quạt đỏ che gần hết mặt rồi. May mà hai đứa vẫn kịp nhìn nhau cười.',
  '2026-02-28': 'Một trái tim xanh vừa đủ chỗ cho hai đứa mình.',
  '2026-04-18': 'Kim ơi, hôm ấy sau lưng mình có bao nhiêu ngôi sao nhỉ? Bảo mải nhìn Kim nên quên đếm.',
  '2026-08-08': 'Bảo thích tấm hình này vì có Kim ngay bên cạnh. Mình cứ giữ nó ở đây nhé.',
  '2026-08-29': 'Cho Bảo ghé lại gần Kim thêm chút nữa, vừa đủ để hai đứa cùng lọt vào một tấm hình.',
  '2026-10-24': 'Mấy tấm ảnh cầm vừa trong tay. Bảo muốn giữ chúng để sau này còn ngồi xem cùng Kim.',
  '2026-11-16': 'Kim hỏi Bảo thích tấm nào nhất à? Khó quá, tấm nào cũng là Kim mà.'
};

function albumDays(items) {
  const groups = new Map();
  for (const item of items) {
    const iso = [item.date, item.id, item.src].map(value => String(value || '').match(/\d{4}-\d{2}-\d{2}/)?.[0]).find(Boolean);
    const caption = (item.dateLabel || item.caption || '').replace(/^Video\s*·\s*/i, '');
    const key = iso || caption || source(item);
    if (!groups.has(key)) groups.set(key, {
      key, date: iso ? iso.split('-').reverse().join('.') : caption,
      note: albumNotes[iso] || 'Bảo giữ khoảnh khắc này cho hai đứa mình.', items: []
    });
    groups.get(key).items.push(item);
  }
  // Open the anniversary with the portrait of both of them holding the bouquet.
  const firstDay = groups.get('2025-11-23');
  if (firstDay) {
    const portrait = firstDay.items.findIndex(item => item.id === 'memory-2025-11-23-04');
    if (portrait > 0) firstDay.items.unshift(firstDay.items.splice(portrait,1)[0]);
  }
  return [...groups.values()];
}

export function mountAlbum(ctx) {
  const {root, signal} = ctx;
  const all = ctx.memories.album ?? [];
  let days = albumDays(all), offset = 0, likedOnly = false;
  let opened = false, ready = false, running = false, failed = false, advanced = false;
  let generation = 0, viewerDay, viewerIndex = 0, viewerGeneration = 0;
  const seen = new Set(), timer = later(signal), opening = later(signal);
  warmPrint(all[0]);

  root.innerHTML = `
    <section class="bk-early bk-album" aria-labelledby="bk-album-title">
      <header class="bk-scene-head"><h1 id="bk-album-title">Album của hai đứa</h1>
        <div class="bk-photo-tools"><p class="bk-page-count" aria-live="polite"></p>
          <button type="button" class="bk-filter" aria-pressed="false" hidden>Ảnh đã thích</button></div></header>
      <div class="bk-album-stage">
        <div class="bk-book">
          <div class="bk-book-page" hidden></div>
          <button type="button" class="bk-book-cover" aria-label="Mở bìa album hoa hồng"></button>
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
  if (ctx.review) q('.bk-album-cats').hidden = true;
  else {
    ctx.cats.mount(q('.bk-album-cats'));
    ctx.cats.setPaused(false); ctx.cats.setWalking(false);
    void ctx.cats.play('sit', {loop:false});
  }
  function sync() {
    const last = Math.min(offset + 2, days.length);
    const range = last === offset + 1 ? String(last) : (offset + 1) + '–' + last;
    q('.bk-page-count').textContent = opened && days.length ? 'Trang ' + range + ' / ' + days.length : '';
    filter.hidden = !ctx.review || !opened || !all.some(isFavorite);
    filter.setAttribute('aria-pressed', String(likedOnly));
    filter.textContent = likedOnly ? 'Toàn bộ album' : 'Ảnh đã thích';
    prev.hidden = next.hidden = auto.hidden = !opened || days.length <= 2;
    prev.disabled = offset === 0;
    next.disabled = (!ready && !ctx.review) || last >= days.length;
    auto.disabled = next.disabled || failed;
    auto.textContent = running ? 'Dừng tự lật' : 'Tự lật';
    retry.hidden = !failed || !days.length;
    proceed.hidden = !!ctx.review || !opened || !((ready && days.length && seen.size === days.length) || (ctx.preview && failed));
    timer.clear();
    if (running && ready && !next.disabled && !document.hidden && !viewer.open)
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
    q('.bk-viewer-date').textContent = day.date;
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
    if (!day) { paper.classList.add('bk-blank'); paper.setAttribute('aria-hidden','true'); return paper; }
    paper.innerHTML = '<header><time></time><span></span></header><div class="bk-montage"></div><p class="bk-note"></p>';
    const date = find(paper, 'time'); date.textContent = day.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(day.key)) date.dateTime = day.key;
    find(paper, 'header span').textContent = String(number).padStart(2,'0');
    find(paper, '.bk-note').textContent = day.note;
    const mosaic = find(paper, '.bk-montage'), count = day.items.length;
    mosaic.dataset.count = count;
    const cells = count >= 4 ? count + 3 : count;
    if (count >= 4) mosaic.style.gridTemplateRows = 'repeat(' + Math.ceil(cells / 3) + ',minmax(0,1fr))';
    day.items.forEach((item, i) => {
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'bk-print-tile';
      tile.setAttribute('aria-label', (videoItem(item) ? 'Phát video' : 'Xem ảnh') + ' · ' + day.date + ' · ' + (i+1));
      if (videoItem(item)) tile.classList.add('bk-video-tile');
      if (i === count-1 && count >= 4 && cells % 3) tile.style.gridColumn = 'span ' + (4 - cells % 3);
      mosaic.append(tile);
      tile.onclick = () => displayMemory(day, i);
      const image = photo(item);
      const thumb = videoItem(item) ? item.poster || item.thumb : item.thumb || source(item);
      if (!thumb) return;
      image.src = thumb;
      const decoded = image.decode().catch(async error => {
        if (videoItem(item) || thumb === source(item)) throw error;
        image.src = source(item); await image.decode();
      }).then(() => tile.prepend(image));
      loads.push(decoded);
    });
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
  function turn(delta) {
    const at = offset + delta;
    if (at < 0 || at >= days.length || (delta > 0 && next.disabled) || viewer.open) return;
    offset = at; draw();
    if (!motion()) spread.children[delta > 0 ? 1 : 0].animate([
      {transform:'perspective(800px) rotateY(' + (delta > 0 ? -28 : 28) + 'deg)', opacity:.72},
      {transform:'perspective(800px) rotateY(0deg)', opacity:1}
    ], {duration:330,easing:'ease-out'});
  }
  function selectDays(onlyLiked, key) {
    likedOnly = onlyLiked && all.some(isFavorite);
    days = albumDays(likedOnly ? all.filter(isFavorite) : all);
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
  signal.addEventListener('abort',() => { stopVideo(); if (viewer.open) viewer.close(); },{once:true});
  sync();
}
