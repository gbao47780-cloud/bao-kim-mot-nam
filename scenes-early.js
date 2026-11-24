const PHOTO_COUNT = 18;
const WALK_INTERVAL = 3200;
const PHOTO_DWELL = 550;
const ALBUM_INTERVAL = 5200;
const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const find = (root, selector) => root.querySelector(selector);
const source = item => item?.src || item?.full || item?.url || item?.image || '';
const videoItem = item => /^(video)(\/|$)/i.test(item?.type || item?.kind || item?.mimeType || '') ||
  /\.(mp4|webm|m4v|mov)(?:[?#]|$)/i.test(source(item));
const photoAlt = item => item.alt || item.caption || 'Ảnh kỷ niệm của Bảo và Kim';

function listen(target, type, callback, signal) {
  target.addEventListener(type, callback, {signal});
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
        <p class="bk-photo-count" aria-live="polite"></p>
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
  let image;
  catsAt(ctx, find(root, '.bk-walk-cats'), running ? 'walk' : 'idle');

  function sync() {
    const paused = !running || failed || !loaded || !inView || document.hidden || dialog.open;
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

  function show(position) {
    index = position;
    loaded = false;
    failed = false;
    open.disabled = true;
    polaroid.hidden = false;
    state.textContent = 'Đang tải ảnh…';
    const item = entries[index];
    const current = image = photo(item);
    open.replaceChildren(current);
    caption.textContent = [item.dateLabel || item.date, item.caption].filter(Boolean).join(' · ');
    trail.dataset.progress = String(index / (PHOTO_COUNT - 1));
    listen(current, 'load', () => {
      if (image !== current || !current.naturalWidth) return;
      polaroid.style.setProperty('--photo-ratio', current.naturalWidth / current.naturalHeight);
      loaded = true;
      open.disabled = false;
      state.textContent = '';
      schedule();
    }, signal);
    listen(current, 'error', () => {
      if (image !== current) return;
      failed = true;
      running = false;
      polaroid.hidden = true;
      state.textContent = 'Ảnh này hiện không tải được từ nguồn kỷ niệm.';
      schedule();
    }, signal);
    current.src = source(item);
    schedule();
  }

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
  listen(open, 'click', () => {
    const item = entries[index];
    const full = photo(item);
    const url = item.full || item.fullSrc || source(item);
    large.replaceChildren(full);
    find(dialog, 'figcaption').textContent = caption.textContent;
    listen(full, 'error', () => {
      if (full.getAttribute('src') !== source(item)) full.src = source(item);
      else large.textContent = 'Ảnh lớn hiện không tải được.';
    }, signal);
    full.src = url;
    dialog.showModal();
    schedule();
  }, signal);
  listen(find(dialog, '.bk-photo-close'), 'click', () => dialog.close(), signal);
  listen(dialog, 'click', event => {
    if (event.target === dialog) dialog.close();
  }, signal);
  listen(dialog, 'close', () => {
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

export function mountAlbum(ctx) {
  const {root, signal} = ctx;
  const pages = ctx.memories.album ?? [];
  root.innerHTML = `
    <section class="bk-early bk-album" aria-labelledby="bk-album-title">
      <header class="bk-scene-head">
        <h1 id="bk-album-title">Album của hai đứa</h1>
        <p class="bk-page-count" aria-live="polite"></p>
      </header>
      <div class="bk-album-stage">
        <div class="bk-book">
          <div class="bk-book-page" hidden>
            <figure><div class="bk-page-media"></div><figcaption></figcaption></figure>
            <p class="bk-media-state" role="status"></p>
          </div>
          <button type="button" class="bk-book-cover" aria-label="Mở bìa album hoa hồng"></button>
        </div>
        <div class="bk-album-cats"></div>
      </div>
      <div class="bk-controls">
        <button type="button" class="primary bk-album-open">Mở album</button>
        <button type="button" class="secondary bk-prev" aria-label="Trang trước" hidden>← <span>Trước</span></button>
        <button type="button" class="secondary bk-auto" hidden></button>
        <button type="button" class="secondary bk-next" aria-label="Trang sau" hidden><span>Sau</span> →</button>
        <button type="button" class="secondary bk-retry" hidden>Thử tải lại</button>
        <button type="button" class="primary bk-continue" hidden></button>
        <button type="button" class="secondary bk-review-close" ${ctx.review ? '' : 'hidden'}>Đóng album</button>
      </div>
    </section>`;
  const book = find(root, '.bk-book');
  const cover = find(root, '.bk-book-cover');
  const page = find(root, '.bk-book-page');
  const media = find(root, '.bk-page-media');
  const caption = find(page, 'figcaption');
  const counter = find(root, '.bk-page-count');
  const state = find(root, '.bk-media-state');
  const open = find(root, '.bk-album-open');
  const prev = find(root, '.bk-prev');
  const next = find(root, '.bk-next');
  const auto = find(root, '.bk-auto');
  const proceed = find(root, '.bk-continue');
  const retry = find(root, '.bk-retry');
  const timer = later(signal);
  const animationTimer = later(signal);
  let opened = false;
  let turning = false;
  let running = false;
  let ready = false;
  let failed = false;
  let advanced = false;
  let index = 0;
  let current;
  let animation;
  const seen = new Set();

  if (!ctx.review) {
    ctx.cats.mount(find(root, '.bk-album-cats'));
    ctx.cats.setPaused(false); ctx.cats.setWalking(false);
    void ctx.cats.play('sit', {loop:false});
  }
  else find(root, '.bk-album-cats').hidden = true;

  function stopVideo() {
    if (current instanceof HTMLVideoElement) current.pause();
  }

  signal.addEventListener('abort', () => {
    stopVideo();
    animation?.kill();
  }, {once: true});

  function complete() {
    return pages.length > 0 && seen.size === pages.length;
  }

  function sync() {
    counter.textContent = opened && pages.length ? 'Trang ' + (index + 1) + ' / ' + pages.length : '';
    prev.hidden = auto.hidden = next.hidden = !opened || pages.length < 2;
    prev.disabled = turning || index === 0;
    next.disabled = turning || (!ready && !ctx.review) || index >= pages.length - 1;
    auto.disabled = turning || failed || !ready || index >= pages.length - 1;
    auto.textContent = running ? 'Dừng tự lật' : 'Tự lật';
    retry.hidden = !failed || !pages.length;
    proceed.hidden = !!ctx.review || !opened || turning || !(complete() || (ctx.preview === true && failed));
    proceed.textContent = complete() ? 'Đọc thư của Bảo' : 'Tiếp tục bản xem thử';
  }

  function schedule() {
    timer.clear();
    sync();
    if (!running || turning || !ready || document.hidden || index >= pages.length - 1) return;
    if (current instanceof HTMLVideoElement && !current.ended) return;
    timer.set(() => turn(1), ALBUM_INTERVAL);
  }

  function draw() {
    stopVideo();
    current = undefined;
    media.replaceChildren();
    ready = false;
    failed = false;
    const item = pages[index];
    caption.textContent = [item?.dateLabel || item?.date, item?.caption].filter(Boolean).join(' · ');
    state.textContent = '';
    if (!source(item)) {
      failed = true;
      running = false;
      state.textContent = pages.length
        ? 'Trang này hiện chưa có ảnh hoặc video.'
        : 'Album hiện chưa có ảnh hoặc video từ thư mục “Ảnh kỉ niệm”.';
      schedule();
      return;
    }
    const isVideo = videoItem(item);
    const element = current = isVideo ? document.createElement('video') : photo(item);
    if (isVideo) {
      element.controls = true;
      element.preload = 'auto';
      element.playsInline = true;
      element.setAttribute('aria-label', item.caption || 'Video kỷ niệm');
      if (item.poster) element.poster = item.poster;
      for (const event of ['play', 'pause', 'ended']) listen(element, event, schedule, signal);
    }
    state.textContent = isVideo ? 'Đang tải video…' : 'Đang tải ảnh…';
    media.append(element);
    listen(element, isVideo ? 'loadeddata' : 'load', () => {
      if (current !== element) return;
      state.textContent = '';
      ready = true;
      seen.add(index);
      schedule();
    }, signal);
    listen(element, 'error', () => {
      if (current !== element) return;
      element.remove();
      ready = false;
      seen.delete(index);
      failed = true;
      running = false;
      state.textContent = isVideo ? 'Video này hiện không phát được.' : 'Ảnh này hiện không tải được.';
      schedule();
    }, signal);
    element.src = source(item);
    schedule();
  }

  function turn(direction) {
    const target = index + direction;
    if (turning || target < 0 || target >= pages.length || (direction > 0 && !ready && !ctx.review)) return;
    stopVideo();
    timer.clear();
    index = target;
    if (motion() || !window.gsap) {
      draw();
      return;
    }
    turning = true;
    sync();
    animation = window.gsap.timeline({
      onComplete: () => {
        turning = false;
        schedule();
      }
    }).to(page, {rotationY: direction * -86, duration: .23, ease: 'power2.in'})
      .call(draw)
      .set(page, {rotationY: direction * 76})
      .to(page, {rotationY: 0, duration: .32, ease: 'power2.out', clearProps: 'transform'});
  }

  listen(cover, 'click', () => open.click(), signal);
  listen(open, 'click', () => {
    if (opened) return;
    opened = true;
    turning = true;
    page.hidden = false;
    open.disabled = true;
    book.classList.add('bk-book-opened');
    if (!ctx.review) ctx.phase('albumOpen');
    draw();
    animationTimer.set(() => {
      cover.hidden = true;
      open.hidden = true;
      turning = false;
      sync();
      (pages.length > 1 ? auto : proceed.hidden ? find(root, '#bk-album-title') : proceed).focus();
    }, motion() ? 30 : 735);
  }, signal);
  find(root, '#bk-album-title').tabIndex = -1;
  listen(prev, 'click', () => turn(-1), signal);
  listen(next, 'click', () => turn(1), signal);
  listen(auto, 'click', () => {
    running = !running;
    schedule();
  }, signal);
  listen(retry, 'click', draw, signal);
  listen(document, 'visibilitychange', schedule, signal);
  listen(proceed, 'click', () => {
    if (advanced || ctx.review || turning || !(complete() || (ctx.preview === true && failed))) return;
    advanced = true;
    stopVideo();
    ctx.phase(complete() ? 'albumComplete' : 'albumSourceUnavailablePreview');
    ctx.next();
  }, signal);
  listen(find(root, '.bk-review-close'), 'click', () => {
    stopVideo();
    ctx.closeReview();
  }, signal);
  sync();
}

