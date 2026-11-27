export function createSoundtrack(button, label) {
  let track, playingVideo, decided = false, enabled = false, revision = 0;

  function paint() {
    label.textContent = enabled ? 'Tắt nhạc' : 'Bật nhạc';
    button.setAttribute('aria-label', enabled ? 'Tắt nhạc nền' : 'Bật nhạc nền');
    button.setAttribute('aria-pressed', String(enabled));
  }

  function sync() {
    const version = ++revision;
    if (!enabled || document.hidden || playingVideo) {
      track?.pause();
      return;
    }
    if (!track) {
      track = new Audio(new URL('./Gửi em người bất tử Ân Ngờ FT.Mỹ Mỹ Official MV Mini Album 0 Ngờ.mp3', import.meta.url));
      track.loop = true;
      track.volume = .44;
    }
    track.play().catch(() => {
      if (revision === version) { enabled = false; paint(); }
    });
  }

  function set(value) { enabled = value; paint(); sync(); }
  button.addEventListener('click', () => { decided = true; set(!enabled); });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('play', event => {
    if (event.target instanceof HTMLVideoElement) { playingVideo = event.target; sync(); }
  }, true);
  const resumeAfterVideo = event => {
    if (event.target === playingVideo) { playingVideo = undefined; sync(); }
  };
  document.addEventListener('pause', resumeAfterVideo, true);
  document.addEventListener('ended', resumeAfterVideo, true);
  document.addEventListener('storybook:video-closed', resumeAfterVideo, true);
  return { startAfterGesture() { if (!decided) { decided = true; set(true); } } };
}
