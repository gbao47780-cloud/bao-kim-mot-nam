// An original three-beat music-box miniature. All sound is generated in the browser.
export function createSoundtrack(button, label) {
  const chords = [[60,64,67],[57,60,64],[53,57,60],[55,59,62],[52,55,59],[53,57,60],[55,59,65],[55,59,62]];
  const melody = [[76,0,74],[72,0,69],[72,74,77],[74,0,71],[67,71,74],[72,0,69],[71,74,77],[74,71,0]];
  let audio, track, master, timer, cursor = 0, beat = 0, enabled = false, decided = false;
  function tone(midi, when, length, volume, timbre) {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = timbre; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + .014);
    gain.gain.exponentialRampToValueAtTime(.0001, when + length);
    oscillator.connect(gain).connect(master); oscillator.start(when); oscillator.stop(when + length + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function schedule() {
    if (!audio || audio.state !== 'running' || !enabled) return;
    cursor = Math.max(cursor, audio.currentTime + .02);
    while (cursor < audio.currentTime + .25) {
      const bar = Math.floor(beat/3) % chords.length, pos = beat % 3;
      tone(chords[bar][pos] - (pos === 0 ? 12 : 0), cursor, .78, pos === 0 ? .17 : .09, 'sine');
      const note = melody[bar][pos];
      if (note) { tone(note, cursor + .025, 1.1, .13, 'sine'); tone(note + 12, cursor + .025, .38, .025, 'triangle'); }
      beat++; cursor += .51;
    }
  }
  function paint() {
    label.textContent = enabled ? 'Tắt nhạc' : 'Bật nhạc';
    button.setAttribute('aria-label', enabled ? 'Tắt nhạc nền' : 'Bật nhạc nền');
    button.setAttribute('aria-pressed', String(enabled));
  }
  async function sync() {
    clearInterval(timer);
    if (track) {
      if (enabled && !document.hidden) await track.play();
      else track.pause();
      return;
    }
    if (!audio) return;
    if (!enabled || document.hidden) { await audio.suspend(); return; }
    await audio.resume();
    if (!enabled || document.hidden) return;
    cursor = audio.currentTime + .04; schedule(); clearInterval(timer); timer = setInterval(schedule, 100);
  }
  function set(value) {
    if (value && !audio && !track) {
      const Context = window.AudioContext || window.webkitAudioContext;
      try { if (Context) audio = new Context(); } catch { /* HTML audio can render the same score. */ }
      if (audio) {
        master = audio.createGain(); master.gain.value = .44; master.connect(audio.destination);
      } else {
        track = new Audio('./music/storybook.mp3'); track.loop = true; track.volume = .44;
      }
    }
    enabled = value; paint(); sync().catch(() => { enabled = false; paint(); });
  }
  button.addEventListener('click', () => { decided = true; set(!enabled); });
  document.addEventListener('visibilitychange', () => { sync().catch(() => {}); });
  return { startAfterGesture() { if (!decided) { decided = true; set(true); } } };
}