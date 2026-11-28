const LETTER_BODY = `<p>Một năm bên nhau rồi. Bảo muốn viết cho Kim vài dòng, để nói một điều thật giản dị là Bảo rất vui vì có Kim trong cuộc đời mình.</p>
            <p>Cảm ơn Kim vì đã cùng Bảo đi qua năm đầu tiên này. Bảo mong tụi mình vẫn dành thời gian lắng nghe nhau, nói cho nhau biết mình cần gì, và dịu dàng với nhau cả những lúc chẳng biết phải nói gì.</p>
            <p>Bảo háo hức nghĩ đến những điều tụi mình còn có thể làm cùng nhau. Cứ từ từ thôi, mình còn nhiều ngày để thương nhau.</p>
            <p class="late-signature">Thương Kim,<br><strong>Bảo</strong></p>`;

const ANNIVERSARY = Date.parse('2025-11-23T00:00:00+07:00');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function elapsedTogether(now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - ANNIVERSARY) / 1_000));
  return [Math.floor(seconds / 86_400), Math.floor(seconds / 3_600) % 24,
    Math.floor(seconds / 60) % 60, seconds % 60];
}

function setBackdrop(scene, name, signal) {
  const backdrop = new Image();
  backdrop.alt = '';
  backdrop.className = 'late-backdrop';
  backdrop.addEventListener('load', () => scene.prepend(backdrop), { once: true, signal });
  backdrop.src = './art/' + name + '.webp';
}

export function mountLetter({ root, signal, cats, next, phase, arrival }) {
  root.innerHTML = `
    <section class="late-scene late-letter" data-letter-state="waiting" aria-labelledby="late-letter-title">
      <header class="late-heading">
        <p class="late-eyebrow">Một năm của tụi mình</p>
        <h1 id="late-letter-title">Một lá thư gửi Kim</h1>
      </header>
      <div class="late-letter-stage">
        <div class="late-letter-cats">
          <div class="late-cushion" aria-hidden="true"></div>
          <div class="late-cat-host"></div>
        </div>
        <div class="late-mail">
          <p class="late-mail-status" role="status">Bảo mang thư đến cho Kim.</p>
          <button class="late-envelope" type="button" aria-label="Mở phong thư của Bảo" hidden disabled>
            <span class="late-envelope-pocket"></span><span class="late-envelope-flap"></span>
            <span class="late-envelope-seal">♥</span>
            <span class="late-seal-glints" aria-hidden="true">✦</span>
          </button>
          <button type="button" class="primary late-open" hidden>Mở thư</button>
          <article class="late-paper" aria-labelledby="late-paper-title" hidden>
            <div class="late-paper-copy" tabindex="0" aria-label="Nội dung thư"><h2 id="late-paper-title" tabindex="-1">Kim thương,</h2>
            ${LETTER_BODY}</div>
            <button type="button" class="primary late-continue">Đọc xong rồi · Tiếp tục</button>
          </article>
        </div>
      </div>
    </section>`;

  const scene = root.querySelector('.late-letter');
  const host = scene.querySelector('.late-cat-host');
  const envelope = scene.querySelector('.late-envelope');
  const open = scene.querySelector('.late-open');
  const paper = scene.querySelector('.late-paper');
  const status = scene.querySelector('.late-mail-status');
  const proceed = scene.querySelector('.late-continue');
  const motion = new Set();
  const cancelMotion = () => motion.forEach(animation => animation.cancel());
  signal.addEventListener('abort', cancelMotion, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelMotion(); }, { signal });
  setBackdrop(scene, 'letter-nook', signal);
  cats.mount(host);
  cats.setWalking(false);
  let drop;

  function animate(element, keyframes, options) {
    if (document.hidden || reducedMotion()) return Promise.resolve();
    const animation = element.animate(keyframes, options);
    motion.add(animation);
    return animation.finished.catch(() => {}).finally(() => motion.delete(animation));
  }

  async function releaseLetter() {
    await cats.play('release', {
      loop: false,
      onRelease(mouth) {
        if (signal.aborted || drop) return;
        // The sprite removes its envelope on this frame. Reveal the prop synchronously.
        const catArea = host.getBoundingClientRect();
        const target = envelope.parentElement.getBoundingClientRect();
        envelope.hidden = false;
        scene.dataset.letterState = 'falling';
        status.textContent = '';
        const landing = envelope.getBoundingClientRect();
        const originX = (mouth?.x ?? (catArea.left + catArea.width * .32)) - landing.left - landing.width / 2;
        const originY = (mouth?.y ?? (catArea.top + catArea.height * .52)) - landing.top - landing.height / 2;
        const arcY = Math.min(0, target.top - landing.top) + 35;
        drop = animate(envelope, [
          { transform: `translate(${originX}px, ${originY}px) rotate(-14deg) scale(.22)` },
          { transform: `translate(${originX * .25}px, ${arcY}px) rotate(9deg) scale(.8)`, offset: .65 },
          { transform: 'translate(0, 0) rotate(-5deg) scale(1)' }
        ], { duration: 730, easing: 'cubic-bezier(.35,.12,.3,1)' });
        phase('SCENE_4_BAO_LETTER_RELEASE');
      }
    });
    if (signal.aborted) return;
    if (!drop) {
      status.textContent = 'Chưa thể chuyển lá thư từ Bảo. Hãy tải lại trang để thử lại.';
      return;
    }
    await drop;
    if (signal.aborted) return;
    scene.dataset.letterState = 'ready';
    open.hidden = false;
    envelope.disabled = false;
  }

  envelope.addEventListener('click', () => open.click(), {signal});
  open.addEventListener('click', async () => {
    envelope.disabled = true;
    open.disabled = true;
    scene.dataset.letterState = 'opening';
    phase('SCENE_4_LETTER_OPEN');
    const flap = envelope.querySelector('.late-envelope-flap');
    animate(envelope.querySelector('.late-seal-glints'), [
      { opacity: 0, transform: 'translate(-50%, -30%) scale(.5)' },
      { opacity: 1, offset: .25 },
      { opacity: 1, offset: .73 },
      { opacity: 0, transform: 'translate(-50%, -155%) scale(1.15)' }
    ], { duration: 320, easing: 'ease-out' });
    await animate(flap, [{ transform: 'rotateX(0)' }, { transform: 'rotateX(180deg)' }], {
      duration: 320, easing: 'ease-in-out'
    });
    if (signal.aborted) return;
    scene.dataset.letterState = 'reading';
    open.hidden = true;
    paper.hidden = false;
    const reveal = animate(paper, [
      { opacity: 0, transform: 'translateY(4rem) scale(.88)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 470, easing: 'ease-out' });
    paper.querySelector('h2').focus();
    await reveal;
  }, { once: true, signal });

  proceed.addEventListener('click', async () => {
    proceed.disabled = true;
    proceed.textContent = 'Bảo và Kim đang cuộn mình…';
    scene.classList.add('letter-folding');
    phase('SCENE_4_LETTER_READ');
    try {
      phase('SCENE_4_CATS_LIE_DOWN');
      await cats.play('lie', { loop: false });
      if (signal.aborted) return;
      phase('SCENE_4_CATS_CURL_UP');
      await cats.play('curl', { loop: false });
      if (signal.aborted) return;
      await cats.play('sleep', { loop: true });
      if (!signal.aborted) next();
    } catch {
      if (!signal.aborted) proceed.textContent = 'Chưa thể chuyển cảnh. Hãy tải lại trang.';
    }
  }, { once: true, signal });

  Promise.resolve(arrival).then(() => { if (!signal.aborted) return releaseLetter(); }).catch(() => {
    if (!signal.aborted) status.textContent = 'Chưa thể mở cảnh lá thư. Hãy tải lại trang.';
  });
}

// Each ring paints once. Only the two rings and their launch trail move.
function skyBloom(color, tilt) {
  function ring(count, offset) {
    return Array.from({ length: count }, (_, i) => {
      const angle = i * 360 / count + offset;
      return `<i style="--angle:${angle}deg;--reach:${48 - i % 3 * 3}%"></i>`;
    }).join('');
  }
  return `<div class="late-salute late-${color}">
    <span class="late-shell">${ring(18, tilt)}</span>
    <span class="late-shell late-inner">${ring(10, tilt + 13)}</span>
  </div>`;
}

function heartBloom() {
  const stars = Array.from({ length: 30 }, (_, i) => {
    const t = i * 2 * Math.PI / 30;
    const x = 50 + 43 * Math.sin(t) ** 3;
    const y = 45 - 2.65 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"></i>`;
  }).join('');
  return `<div class="late-salute late-finale"><span class="late-heart">${stars}</span></div>`;
}

export function mountParty({ root, signal, cats, phase, reviewAlbum, replay, memories, arrival, story }) {
  root.innerHTML = `
    <section class="late-scene late-party" aria-labelledby="late-party-title">
      <div class="late-bunting" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
      <header class="late-heading">
        <p class="late-eyebrow">Bảo &amp; Kim · 23.11.2025</p>
        <h1 id="late-party-title">Mừng một năm, Kim ơi!</h1>
        <div class="late-clock" role="timer" aria-label="Thời gian bên nhau" aria-live="off">
          ${['ngày', 'giờ', 'phút', 'giây'].map(unit => `<span class="late-clock-part"><strong>00</strong><span>${unit}</span></span>`).join('')}
        </div>
      </header>
      <div class="late-party-stage">
        <div class="late-table" aria-hidden="true"></div>
        <div class="late-party-cats">
          <div class="late-cushion" aria-hidden="true"></div>
          <div class="late-cat-host"></div>
        </div>
        <span class="late-sprig late-sprig-left" aria-hidden="true">✿</span>
        <span class="late-sprig late-sprig-right" aria-hidden="true">✿</span>
        <div class="late-dessert">
          <button type="button" class="late-cake-touch" aria-label="Chạm bánh kem để thắp pháo hoa"></button>
          <div class="late-plate"></div>
          <div class="late-cake">
            <div class="late-icing"></div>
            <div class="late-berries"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="late-candles"><i></i><i></i><i></i></div>
            <div class="late-cake-mark">1</div>
          </div>
        </div>
        <div class="late-keepsakes">
          <button type="button" class="late-party-envelope" aria-label="Đọc lại thư của Bảo"></button>
          <span class="late-polaroid"><span>♥</span></span>
        </div>
        <button type="button" class="late-table-album" aria-label="Mở lại album kỷ niệm">
          <span class="late-cover-window" aria-hidden="true"></span>
        </button>
      </div>
      <div class="late-party-actions">
        <button type="button" class="secondary late-firework-button">Thắp pháo hoa</button>
        <button type="button" class="primary late-replay">Xem lại từ đầu</button>
      </div>
      <dialog class="late-letter-review" aria-label="Thư của Bảo gửi Kim"><div class="letter-scroll"><h2>Kim thương,</h2>${LETTER_BODY}</div><button type="button" class="secondary late-close-letter">Đóng thư</button></dialog>
      <div class="late-fireworks" aria-hidden="true"></div>
    </section>`;

  const scene = root.querySelector('.late-party');
  const clock = scene.querySelectorAll('.late-clock strong');
  const effects = scene.querySelector('.late-fireworks');
  setBackdrop(scene, 'party-garden', signal);
  if (story?.cake) {
    const dessert = scene.querySelector('.late-dessert');
    dessert.querySelector('.late-cake').remove();
    dessert.querySelector('.late-plate').remove();
    dessert.prepend(story.cake);
  }
  cats.mount(scene.querySelector('.late-cat-host'));
  phase('SCENE_5_CELEBRATION');
  phase('SCENE_5_CATS_SLEEP_LOOP');

  const updateClock = () => elapsedTogether().forEach((value, index) => {
    clock[index].textContent = String(value).padStart(2, '0');
  });
  updateClock();
  const clockInterval = setInterval(updateClock, 1_000);
  let clearFireworks;

  function stopFireworks() {
    clearTimeout(clearFireworks);
    effects.replaceChildren();
  }

  function fireworks() {
    if (document.hidden || effects.childElementCount) return;
    const skyHeight = scene.querySelector('.late-heading').offsetTop;
    const stageTop = scene.querySelector('.late-party-stage').offsetTop;
    effects.style.setProperty('--sky-height', skyHeight + 'px');
    effects.style.setProperty('--stage-top', stageTop + 'px');
    effects.innerHTML = skyBloom('rose', -8) + skyBloom('aqua', 6) + heartBloom();
    clearFireworks = setTimeout(stopFireworks, reducedMotion() ? 1900 : 3300);
  }

  Promise.resolve(arrival).then(() => { if (!signal.aborted && !reducedMotion()) fireworks(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopFireworks(); }, { signal });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', stopFireworks, { signal });
  const review = scene.querySelector('.late-letter-review');
  scene.querySelector('.late-party-envelope').addEventListener('click', () => review.showModal(), {signal});
  scene.querySelector('.late-close-letter').addEventListener('click', () => review.close(), {signal});
  review.addEventListener('click', e => {if(e.target === review) review.close();}, {signal});
  scene.querySelector('.late-cake-touch').addEventListener('click', fireworks, {signal});
  scene.querySelector('.late-firework-button').addEventListener('click', fireworks, { signal });
  const coverPortrait = memories?.album?.find(item => item.id === 'memory-2026-11-16-01') || memories?.album?.[0];
  if (coverPortrait?.thumb) {
    const image = new Image(); image.alt = ''; image.src = coverPortrait.thumb;
    scene.querySelector('.late-cover-window').append(image);
  }
  scene.querySelector('.late-table-album').addEventListener('click', () => reviewAlbum(), { signal });
  scene.querySelector('.late-replay').addEventListener('click', () => replay(), { signal });
  signal.addEventListener('abort', () => {
    clearInterval(clockInterval);
    stopFireworks();
  }, { once: true });
}
