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

export function mountLetter({ root, signal, cats, next, phase }) {
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
          <div class="late-envelope" hidden aria-hidden="true">
            <span class="late-envelope-pocket"></span><span class="late-envelope-flap"></span>
            <span class="late-envelope-seal">♥</span>
          </div>
          <button type="button" class="primary late-open" hidden>Mở thư</button>
          <article class="late-paper" aria-labelledby="late-paper-title" hidden>
            <div class="late-paper-copy" tabindex="0" aria-label="Nội dung thư"><h2 id="late-paper-title" tabindex="-1">Kim thương,</h2>
            <p>Một năm bên nhau rồi. Bảo muốn viết cho Kim vài dòng, để nói một điều thật giản dị là Bảo rất vui vì có Kim trong cuộc đời mình.</p>
            <p>Cảm ơn Kim vì đã cùng Bảo đi qua năm đầu tiên này. Bảo mong tụi mình vẫn dành thời gian lắng nghe nhau, nói cho nhau biết mình cần gì, và dịu dàng với nhau cả những lúc chẳng biết phải nói gì.</p>
            <p>Bảo háo hức nghĩ đến những điều tụi mình còn có thể làm cùng nhau. Cứ từ từ thôi, mình còn nhiều ngày để thương nhau.</p>
            <p class="late-signature">Thương Kim,<br><strong>Bảo</strong></p></div>
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
  signal.addEventListener('abort', () => motion.forEach(animation => animation.cancel()), { once: true });
  setBackdrop(scene, 'letter-nook', signal);
  cats.mount(host);
  cats.setWalking(false);
  let drop;

  function animate(element, keyframes, options) {
    if (reducedMotion()) return Promise.resolve();
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
  }

  open.addEventListener('click', async () => {
    open.disabled = true;
    scene.dataset.letterState = 'opening';
    phase('SCENE_4_LETTER_OPEN');
    const flap = envelope.querySelector('.late-envelope-flap');
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

  releaseLetter().catch(() => {
    if (!signal.aborted) status.textContent = 'Chưa thể mở cảnh lá thư. Hãy tải lại trang.';
  });
}

export function mountParty({ root, signal, cats, phase, reviewAlbum, replay }) {
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
        <div class="late-dessert" role="img" aria-label="Bánh kỷ niệm với nến, kem hồng và dâu">
          <div class="late-plate"></div>
          <div class="late-cake">
            <div class="late-icing"></div>
            <div class="late-berries"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="late-candles"><i></i><i></i><i></i></div>
            <div class="late-cake-mark">1</div>
          </div>
        </div>
        <div class="late-keepsakes" aria-hidden="true">
          <span class="late-party-envelope">♥</span>
          <span class="late-polaroid"><span>♥</span></span>
        </div>
        <button type="button" class="late-table-album" aria-label="Mở lại album kỷ niệm">
          <span class="late-book-cover"><span aria-hidden="true">✦</span><strong>Album<br>kỷ niệm</strong><small>Bảo &amp; Kim</small></span>
        </button>
      </div>
      <div class="late-party-actions">
        <button type="button" class="secondary late-firework-button">Thắp pháo hoa</button>
        <button type="button" class="primary late-replay">Xem lại từ đầu</button>
      </div>
      <div class="late-fireworks" aria-hidden="true"></div>
    </section>`;

  const scene = root.querySelector('.late-party');
  const clock = scene.querySelectorAll('.late-clock strong');
  const effects = scene.querySelector('.late-fireworks');
  setBackdrop(scene, 'party-garden', signal);
  cats.mount(scene.querySelector('.late-cat-host'));
  phase('SCENE_5_CELEBRATION');
  phase('SCENE_5_CATS_SLEEP_LOOP');

  const updateClock = () => elapsedTogether().forEach((value, index) => {
    clock[index].textContent = String(value).padStart(2, '0');
  });
  updateClock();
  const clockInterval = setInterval(updateClock, 1_000);
  let clearFireworks;

  function fireworks() {
    clearTimeout(clearFireworks);
    const particles = document.createDocumentFragment();
    const origins = [[20, 33], [76, 30], [53, 18]];
    const colors = ['#f8558b', '#ffca54', '#ffe8a2', '#fdf5ea', '#a8db98', '#e298fc'];
    for (const [burst, [x, y]] of origins.entries()) {
      for (let ray = 0; ray < 12; ray++) {
        const particle = document.createElement('i');
        const angle = ray * Math.PI / 6 + burst * .3;
        const distance = 58 + ray % 3 * 20;
        particle.style.left = x + '%';
        particle.style.top = y + '%';
        particle.style.setProperty('--spark-x', Math.cos(angle) * distance + 'px');
        particle.style.setProperty('--spark-y', Math.sin(angle) * distance + 'px');
        particle.style.setProperty('--spark-color', colors[(ray + burst) % colors.length]);
        particle.style.animationDelay = burst * .2 + 's';
        particles.append(particle);
      }
    }
    effects.replaceChildren(particles);
    clearFireworks = setTimeout(() => effects.replaceChildren(), 1_850);
  }

  scene.querySelector('.late-firework-button').addEventListener('click', fireworks, { signal });
  scene.querySelector('.late-table-album').addEventListener('click', () => reviewAlbum(), { signal });
  scene.querySelector('.late-replay').addEventListener('click', () => replay(), { signal });
  signal.addEventListener('abort', () => {
    clearInterval(clockInterval);
    clearTimeout(clearFireworks);
    effects.replaceChildren();
  }, { once: true });
}
