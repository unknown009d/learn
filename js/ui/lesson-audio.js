/**
 * Lesson audio summary player.
 */

import { escapeHtml, showToast } from '../core/utils.js';
import { appState } from '../core/state.js';

const AUDIO_SPEED_STORAGE_KEY = 'druba_web_audio_speed';
const AUDIO_SPEEDS = [1, 1.25, 1.5];

export async function loadAudioManifest() {
  try {
    const res = await fetch('./audio/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return { lessons: {} };
    const data = await res.json();
    appState.audioManifest = data && typeof data === 'object' ? data : { lessons: {} };
    return appState.audioManifest;
  } catch {
    appState.audioManifest = { lessons: {} };
    return appState.audioManifest;
  }
}

function formatAudioTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function renderLessonAudioGistHtml(sec) {
  const entry = appState.audioManifest?.lessons?.[sec.id];
  if (!entry || !entry.file) return '';
  const durLabel = entry.duration ? formatAudioTime(entry.duration) : '';

  return `
    <div class="m3-audio-gist no-print" data-audio-gist="${escapeHtml(sec.id)}">
      <button type="button" class="m3-audio-gist-trigger" data-ag-open aria-label="Listen to lesson summary">
        <span class="m3-audio-gist-play-dot" aria-hidden="true">
          <span class="material-symbols-outlined text-[16px]">play_arrow</span>
        </span>
        <span>Listen to Summary</span>
        ${durLabel ? `<span class="m3-audio-gist-dur">&middot; ${durLabel}</span>` : ''}
      </button>

      <div class="m3-audio-gist-bar hidden" data-ag-bar>
        <button type="button" class="m3-audio-gist-ctrl" data-ag-toggle aria-label="Play or pause lesson summary">
          <span class="material-symbols-outlined icon-18" data-ag-icon>pause</span>
        </button>

        <div class="m3-audio-gist-track">
          <div class="m3-audio-gist-meta">
            <span class="m3-audio-gist-label">
              <span class="m3-audio-gist-eq" aria-hidden="true"><span></span><span></span><span></span></span>
              <span>Lesson Summary</span>
            </span>
            <span class="m3-audio-gist-time" data-ag-time>0:00 / ${durLabel || '0:00'}</span>
          </div>
          <input type="range" class="m3-audio-gist-range" min="0" max="${entry.duration || 100}" step="0.1" value="0" aria-label="Audio summary progress" data-ag-seek>
        </div>

        <button type="button" class="m3-audio-gist-speed" data-ag-speed title="Playback speed" aria-label="Change playback speed">1&times;</button>
      </div>
    </div>
  `;
}

export function initLessonAudioGist(view, sec) {
  const root = view.querySelector('[data-audio-gist]');
  const entry = appState.audioManifest?.lessons?.[sec.id];
  if (!root || !entry?.file) return null;

  const openBtn = root.querySelector('[data-ag-open]');
  const barEl = root.querySelector('[data-ag-bar]');
  const toggleBtn = root.querySelector('[data-ag-toggle]');
  const iconEl = root.querySelector('[data-ag-icon]');
  const timeEl = root.querySelector('[data-ag-time]');
  const seekEl = root.querySelector('[data-ag-seek]');
  const speedBtn = root.querySelector('[data-ag-speed]');

  let audio = null;
  let isSeeking = false;
  let isDisposed = false;
  let savedSpeed = 1;
  try {
    const raw = Number(localStorage.getItem(AUDIO_SPEED_STORAGE_KEY));
    if (AUDIO_SPEEDS.includes(raw)) savedSpeed = raw;
  } catch {}

  const updateSpeedUi = () => {
    if (speedBtn) speedBtn.textContent = `${savedSpeed}×`;
    if (audio) audio.playbackRate = savedSpeed;
  };
  updateSpeedUi();

  const updateSeekTrack = (cur, total) => {
    if (!seekEl) return;
    const pct = total > 0 ? Math.min(100, Math.max(0, (cur / total) * 100)) : 0;
    seekEl.style.background = `linear-gradient(to right, var(--m3-primary) ${pct}%, var(--m3-surface-container-highest) ${pct}%)`;
  };

  const updateTimeUi = () => {
    if (!audio || isDisposed) return;
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (entry.duration || 0);
    const cur = audio.currentTime || 0;
    if (timeEl) timeEl.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(total)}`;
    if (seekEl && !isSeeking && total > 0) {
      seekEl.max = String(total);
      seekEl.value = String(cur);
      updateSeekTrack(cur, total);
    }
  };

  const setPlayingState = (playing) => {
    root.classList.toggle('is-playing', playing);
    if (iconEl) iconEl.textContent = playing ? 'pause' : 'play_arrow';
    if (toggleBtn) toggleBtn.setAttribute('aria-label', playing ? 'Pause lesson summary' : 'Play lesson summary');
  };

  const ensureAudio = () => {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.src = entry.file;
    audio.playbackRate = savedSpeed;

    audio.addEventListener('loadedmetadata', updateTimeUi);
    audio.addEventListener('timeupdate', updateTimeUi);
    audio.addEventListener('play', () => {
      if (!isDisposed) setPlayingState(true);
    });
    audio.addEventListener('pause', () => {
      if (!isDisposed) setPlayingState(false);
    });
    audio.addEventListener('ended', () => {
      if (isDisposed) return;
      setPlayingState(false);
      if (seekEl) seekEl.value = '0';
      if (audio) audio.currentTime = 0;
      updateSeekTrack(0, audio?.duration || entry.duration || 0);
      updateTimeUi();
    });
    audio.addEventListener('error', () => {
      if (isDisposed || !audio || !audio.getAttribute('src')) return;
      setPlayingState(false);
      showToast('Could not load audio summary for this lesson.', 'error');
    });
    return audio;
  };

  const togglePlay = async () => {
    const a = ensureAudio();
    if (a.paused) {
      try {
        await a.play();
      } catch {
        setPlayingState(false);
      }
    } else {
      a.pause();
    }
  };

  openBtn?.addEventListener('click', () => {
    openBtn.classList.add('hidden');
    barEl?.classList.remove('hidden');
    togglePlay();
  });

  toggleBtn?.addEventListener('click', togglePlay);

  seekEl?.addEventListener('input', () => {
    isSeeking = true;
    const a = ensureAudio();
    const val = Number(seekEl.value) || 0;
    const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : (entry.duration || 0);
    if (timeEl) timeEl.textContent = `${formatAudioTime(val)} / ${formatAudioTime(total)}`;
    updateSeekTrack(val, total);
  });

  const commitSeek = () => {
    if (!isSeeking) return;
    isSeeking = false;
    if (audio) {
      audio.currentTime = Number(seekEl.value) || 0;
    }
  };
  seekEl?.addEventListener('change', commitSeek);
  seekEl?.addEventListener('pointerup', commitSeek);

  speedBtn?.addEventListener('click', () => {
    const idx = AUDIO_SPEEDS.indexOf(savedSpeed);
    savedSpeed = AUDIO_SPEEDS[(idx + 1) % AUDIO_SPEEDS.length];
    try {
      localStorage.setItem(AUDIO_SPEED_STORAGE_KEY, String(savedSpeed));
    } catch {}
    updateSpeedUi();
  });

  const pauseOnly = () => {
    if (audio && !audio.paused) {
      audio.pause();
    }
  };

  const cleanup = () => {
    isDisposed = true;
    if (audio) {
      const ref = audio;
      audio = null;
      ref.pause();
      ref.removeAttribute('src');
      ref.load();
    }
    setPlayingState(false);
  };

  return { pauseOnly, cleanup };
}
