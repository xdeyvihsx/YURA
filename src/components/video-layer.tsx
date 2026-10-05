import { useEffect, useRef } from 'react';
import { usePlayer } from '@/context/player';
import { getCounterpart } from '@/services/youtube';

/* ---------- YouTube IFrame API loader ---------- */
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}
let ytApi: Promise<any> | null = null;
export function loadYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApi) {
    ytApi = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return ytApi;
}

/** Fires 'yura:video-status' with { videoId, failed } so the full player knows what it can show. */
const status = (detail: { videoId: string | null; failed: boolean; ready: boolean }) => {
  (window as any).__yuraVideoStatus = detail;
  window.dispatchEvent(new CustomEvent('yura:video-status', { detail }));
};

/**
 * One persistent, chrome-less YouTube player. It loads the current song's videoclip in the background
 * (muted, kept in sync with the audio) so switching to "Video" is instant, and floats over the
 * `[data-video-slot]` element of the full player when visible. All controls are YURA's own.
 */
export function VideoLayer() {
  const { current, queue, index, mode, isPlaying, currentTime, volume, muted, reportVideoTime, next, toggle } = usePlayer();
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const ready = useRef(false);
  const videoId = useRef<string | null>(null);
  const live = useRef({ mode, isPlaying, currentTime, volume, muted, next });
  live.current = { mode, isPlaying, currentTime, volume, muted, next };

  const applyVolume = () => {
    const p = player.current;
    if (!p?.setVolume || !ready.current) return;
    const { mode: m, volume: v, muted: mu } = live.current;
    if (m === 'video' && !mu) { p.unMute(); p.setVolume(Math.round(v * 100)); } else p.mute();
  };

  // Create the player once.
  useEffect(() => {
    let dead = false;
    loadYT().then((YT) => {
      if (dead || !host.current) return;
      const el = document.createElement('div');
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com',
        width: '100%', height: '100%',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1, cc_load_policy: 0 },
        events: {
          onReady: () => {
            ready.current = true;
            player.current.mute();
            if (videoId.current) player.current.loadVideoById({ videoId: videoId.current, startSeconds: live.current.currentTime });
          },
          onStateChange: (e: any) => {
            if (live.current.mode !== 'video') return;
            if (e.data === 0) live.current.next();
            window.dispatchEvent(new CustomEvent('yura:video-state', { detail: e.data === 1 }));
          },
          onError: () => status({ videoId: videoId.current, failed: true, ready: false }),
        },
      });
    });
    return () => { dead = true; try { player.current?.destroy?.(); } catch { /* ignore */ } };
  }, []);

  // Resolve the videoclip for the current song and preload it; look ahead for the next ones.
  useEffect(() => {
    if (!current) { videoId.current = null; status({ videoId: null, failed: false, ready: false }); try { player.current?.stopVideo?.(); } catch { /* ignore */ } return; }
    let alive = true;
    status({ videoId: null, failed: false, ready: false });
    getCounterpart(current).then((p) => {
      if (!alive) return;
      videoId.current = p.videoId;
      status({ videoId: p.videoId, failed: false, ready: false });
      const pl = player.current;
      if (p.videoId && pl?.loadVideoById && ready.current && navigator.onLine) {
        pl.mute();
        pl.loadVideoById({ videoId: p.videoId, startSeconds: live.current.currentTime });
      }
    });
    queue.slice(index + 1, index + 3).forEach((t) => getCounterpart(t));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.sourceId]);

  // Keep the hidden video in step with the audio; in video mode the video is the clock.
  useEffect(() => {
    const t = setInterval(() => {
      const p = player.current;
      if (!p?.getCurrentTime || !ready.current || !videoId.current) return;
      const { mode: m, isPlaying: playing, currentTime: at } = live.current;
      if (m === 'video') {
        reportVideoTime(p.getCurrentTime(), p.getDuration?.());
        return;
      }
      const state = p.getPlayerState?.();
      if (playing && state !== 1 && state !== 3) p.playVideo();
      if (!playing && state === 1) p.pauseVideo();
      if (Math.abs(p.getCurrentTime() - at) > 1.5) p.seekTo(at, true);
    }, 500);
    return () => clearInterval(t);
  }, [reportVideoTime]);

  // Switching modes: hand the sound over between audio and video at the same second.
  useEffect(() => {
    const p = player.current;
    if (!p?.seekTo || !ready.current) return;
    if (mode === 'video') {
      if (Math.abs(p.getCurrentTime() - live.current.currentTime) > 0.6) p.seekTo(live.current.currentTime, true);
      p.playVideo();
    }
    applyVolume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(applyVolume, [volume, muted, mode]);

  // YURA's own controls drive the video while it is visible.
  useEffect(() => {
    const onToggle = () => {
      const p = player.current;
      if (!p?.getPlayerState) return;
      p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo();
    };
    const onSeek = (e: Event) => player.current?.seekTo?.((e as CustomEvent).detail, true);
    window.addEventListener('yura:video-toggle', onToggle);
    window.addEventListener('yura:video-seek', onSeek);
    return () => {
      window.removeEventListener('yura:video-toggle', onToggle);
      window.removeEventListener('yura:video-seek', onSeek);
    };
  }, []);

  // Float over the full player's video slot, or park offscreen (still loaded) when hidden.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = box.current;
      const slot = document.querySelector<HTMLElement>('[data-video-slot]');
      if (el) {
        if (live.current.mode === 'video' && slot) {
          const r = slot.getBoundingClientRect();
          Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, opacity: '1', pointerEvents: 'auto' });
        } else {
          Object.assign(el.style, { left: '-10000px', top: '0px', width: '480px', height: '270px', opacity: '0', pointerEvents: 'none' });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={box} className="fixed z-20 overflow-hidden rounded-2xl bg-background" style={{ left: -10000, width: 480, height: 270 }} aria-hidden={mode !== 'video'}>
      {/* Oversized and cropped so YouTube's title bar and logo stay outside the visible area. */}
      <div ref={host} className="absolute left-0 right-0 top-[-60px] bottom-[-60px] [&>iframe]:h-full [&>iframe]:w-full" />
      {/* Click shield: hides YouTube's hover UI; a click plays/pauses with YURA's controls. */}
      <button type="button" aria-label="Reproducir o pausar video" className="absolute inset-0 cursor-pointer" onClick={toggle} />
    </div>
  );
}
