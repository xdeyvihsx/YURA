import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Innertube, UniversalCache, Log, YTNodes } from 'youtubei.js';

Log.setLevel(Log.Level.NONE);

const app = express();
const portArg = process.argv.indexOf('--port');
const PORT = (portArg > -1 && process.argv[portArg + 1]) || process.env.PORT || 3000;
// Built web app (expo export). When present, this server also serves the web version.
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-web');

app.use(cors({ exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Disposition'] }));
app.use(express.json());

let yt = null;
async function getYoutube(fresh = false) {
  if (!yt || fresh) yt = Innertube.create({ retrieve_player: false, lang: 'es', cache: new UniversalCache(false) });
  return yt;
}

// Tiny in-memory TTL cache so repeated searches / artist pages are instant.
const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  memo.set(key, { value, expires: Date.now() + ttlMs });
  if (memo.size > 800) memo.delete(memo.keys().next().value);
  return value;
}

/** Resolves audio URLs in the background so pressing play starts instantly. */
function warmAudio(ids, prefer = 'mp4') {
  for (const id of ids) getAudioFormat(id, prefer).catch(() => {});
}

// Clients that return direct (non-ciphered) audio URLs. VISIONOS first: it is the most permissive.
const CLIENTS = ['VISIONOS', 'ANDROID_VR', 'IOS'];
const formatCache = new Map();

function upscale(url) {
  if (!url) return null;
  return url
    .replace(/=w\d+-h\d+[^&?#]*/, '=w544-h544-l90-rj')
    .replace(/=s\d+[^&?#]*/, '=s544')
    .replace(/\/(default|mqdefault|sddefault)\.jpg/, '/hqdefault.jpg');
}

function textOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.text === 'string') return value.text;
  return null;
}

function bestThumbnail(node) {
  for (const list of [node?.thumbnail, node?.thumbnails]) {
    const arr = Array.isArray(list) ? list : Array.isArray(list?.contents) ? list.contents : null;
    if (!arr?.length) continue;
    const sorted = [...arr].sort((a, b) => (b?.width ?? 0) - (a?.width ?? 0));
    if (sorted[0]?.url) return sorted[0].url;
  }
  return null;
}

/** Returns a track in the exact shape the YURA app expects. */
function toTrack(item) {
  const videoId = typeof item?.id === 'string' ? item.id : null;
  const title = textOf(item?.title);
  if (!videoId || !title) return null;
  const artists = Array.isArray(item.artists) ? item.artists : Array.isArray(item.authors) ? item.authors : [];
  const album = item.album ?? null;
  return {
    id: `youtube:${videoId}`,
    source: 'youtube',
    sourceId: videoId,
    title,
    artistName: artists.map((a) => a?.name).filter(Boolean).join(', ') || null,
    artistId: artists.find((a) => a?.channel_id)?.channel_id ?? null,
    artists: artists.filter((a) => a?.name).map((a) => ({ name: a.name, id: a.channel_id ?? null })),
    albumName: album?.name ?? null,
    albumId: album?.id ?? null,
    durationSeconds: item.duration?.seconds ?? null,
    artworkUrl: upscale(bestThumbnail(item)) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isExplicit: Array.isArray(item.badges) ? item.badges.some((b) => /explicit/i.test(b?.label ?? '')) : false,
  };
}

async function getAudioFormat(videoId, prefer = 'mp4') {
  const key = `${videoId}:${prefer}`;
  const cached = formatCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.format;
  const errors = [];
  for (let round = 0; round < 2; round++) {
    const youtube = await getYoutube(round > 0);
    for (const client of CLIENTS) {
      try {
        const info = await youtube.getBasicInfo(videoId, { client });
        const formats = (info.streaming_data?.adaptive_formats ?? [])
          .filter((f) => f.has_audio && !f.has_video && f.url)
          .sort((a, b) => (b.mime_type.includes(prefer) ? 1 : 0) - (a.mime_type.includes(prefer) ? 1 : 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0));
        if (!formats.length) {
          errors.push(`${client}:${info.playability_status?.status}`);
          continue;
        }
        const f = formats[0];
        const format = {
          url: f.url,
          mimeType: f.mime_type.split(';')[0],
          contentLength: f.content_length ? Number(f.content_length) : null,
          info,
        };
        formatCache.set(key, { format, expires: Date.now() + 4 * 60 * 60 * 1000 });
        return format;
      } catch (error) {
        errors.push(`${client}:${error.message}`);
      }
    }
  }
  throw new Error(errors.join(' | '));
}

/** Parses "bytes=start-end" into numbers. */
function parseRange(header, total) {
  const match = /bytes=(\d*)-(\d*)/.exec(header || '');
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : total ? total - 1 : null;
  if (!match[1] && match[2] && total) {
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  }
  if (total && end !== null) end = Math.min(end, total - 1);
  return { start, end };
}

// Proxies the audio bytes. YouTube's mobile URLs reject the Range header,
// so the range is passed as a "&range=" query parameter instead.
async function streamAudio(req, res) {
  const { videoId } = req.params;
  if (!/^[\w-]{6,20}$/.test(videoId)) return res.status(400).json({ error: 'bad id' });
  // Web browsers get webm/opus (plays in every browser); phones get m4a/aac.
  const prefer = req.query.format === 'webm' ? 'webm' : 'mp4';
  const clear = () => formatCache.delete(`${videoId}:${prefer}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const format = await getAudioFormat(videoId, prefer);
      const total = format.contentLength;
      const requested = parseRange(req.headers.range, total);
      const start = requested?.start ?? 0;
      const end = requested?.end ?? (total ? total - 1 : null);
      const upstreamUrl = `${format.url}&range=${start}-${end ?? ''}`;
      const upstream = await fetch(upstreamUrl, { method: req.method === 'HEAD' ? 'HEAD' : 'GET' });
      if (!upstream.ok) {
        clear();
        continue;
      }
      res.setHeader('Content-Type', format.mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-store');
      const length = upstream.headers.get('content-length');
      if (length) res.setHeader('Content-Length', length);
      if (requested && total) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      } else {
        res.status(200);
      }
      if (req.method === 'HEAD' || !upstream.body) return res.end();
      Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
      return;
    } catch (error) {
      clear();
      if (attempt === 1) return res.status(502).json({ error: error.message });
    }
  }
  if (!res.headersSent) res.status(502).json({ error: 'stream unavailable' });
}

async function search(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
    const limit = Math.min(Number(req.query.limit) || 25, 50);
    const data = await cached(`search2:${q.toLowerCase()}:${limit}`, 30 * 60 * 1000, async () => {
      const youtube = await getYoutube();
      const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const words = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
      const nq = norm(q);
      const qWords = words(q).filter((w) => !['de', 'by', 'the', 'el', 'la', 'feat', 'ft'].includes(w) || words(q).length === 1);
      /** How well a title + artists covers the query (0..~200). */
      const relevance = (title, artistNames) => {
        const tw = new Set(words(title));
        const aw = new Set(words(artistNames.join(' ')));
        let hit = 0, titleHit = 0;
        for (const w of qWords) {
          const inT = tw.has(w) || [...tw].some((x) => x.length > 3 && x.startsWith(w));
          const inA = aw.has(w);
          if (inT) titleHit++;
          if (inT || inA) hit++;
        }
        const cover = qWords.length ? hit / qWords.length : 0;
        const nt = norm(title.replace(/\(.*?\)|\[.*?\]/g, ''));
        const exactTitle = nt === nq || artistNames.some((a) => norm(`${nt}${a}`) === nq || norm(`${a}${nt}`) === nq);
        const variant = /instrumental|sped|slowed|karaoke|remix|cover|8d|reverb|nightcore/i.test(title) && !/instrumental|sped|slowed|karaoke|remix|cover|8d|reverb|nightcore/i.test(q);
        return cover * 100 + (titleHit ? 20 : 0) + (exactTitle ? 60 : 0) + (cover === 1 ? 30 : 0) - (variant ? 40 : 0);
      };

      const artistMap = new Map();
      const addArtist = (item, bonus = 0) => {
        const id = item?.id ?? item?.endpoint?.payload?.browseId;
        const name = textOf(item?.title) ?? textOf(item?.name);
        if (!id || !name || !/^UC[\w-]{10,}$/.test(id)) return;
        const subsText = textOf(item?.subscribers) ?? textOf(item?.subtitle) ?? '';
        const m = /([\d.,]+)\s*(k|m|mil|mill)?/i.exec(subsText.replace(/\s(de\s)?suscriptores.*/i, ''));
        let subs = m ? parseFloat(m[1].replace(',', '.')) : 0;
        if (m && /^m|mill/i.test(m[2] ?? '')) subs *= 1e6; else if (m && /k|mil/i.test(m[2] ?? '')) subs *= 1e3;
        const n = norm(name);
        const inQuery = qWords.length > 1 && words(name).every((w) => qWords.includes(w));
        const score = bonus + (n === nq ? 1000 : inQuery ? 400 : n.startsWith(nq) || nq.startsWith(n) ? 300 : n.includes(nq) ? 100 : 0) + Math.log10(subs + 1) * 10;
        if (bonus < 5000 && n !== nq && !inQuery && subs < 50000) return;
        const prev = artistMap.get(id);
        if (!prev || prev.score < score) artistMap.set(id, { id, name, artworkUrl: upscale(bestThumbnail(item)) ?? prev?.artworkUrl ?? null, score });
      };

      const trackMap = new Map();
      let order = 0;
      const addTrack = (item, bonus = 0) => {
        const kind = item?.item_type;
        if (kind && kind !== 'song' && kind !== 'video') return;
        const track = toTrack(item);
        if (!track || !track.artistName) return;
        const isVideo = kind === 'video';
        if (isVideo && !/^UC[\w-]{10,}$/.test(track.artistId ?? '')) return;
        const score = relevance(track.title, (track.artists ?? []).map((a) => a.name)) + bonus + (isVideo ? 0 : 8) - order++ * 0.3;
        const prev = trackMap.get(track.sourceId);
        if (!prev || prev.score < score) trackMap.set(track.sourceId, { track, score, isVideo: prev?.isVideo === false ? false : isVideo });
      };

      const albumMap = new Map();
      const addAlbum = (item, bonus = 0) => {
        const card = toCard(item);
        if (!card || !/^MPRE/.test(card.id)) return;
        const artists = Array.isArray(item.artists) ? item.artists : Array.isArray(item.author ? [item.author] : null) ? [item.author] : [];
        const artistName = artists.map((a) => a?.name).filter(Boolean).join(', ') || null;
        const score = relevance(card.title, artistName ? [artistName] : words(card.subtitle)) + bonus;
        const prev = albumMap.get(card.id);
        if (!prev || prev.score < score) albumMap.set(card.id, { ...card, artistName, artistId: artists.find((a) => a?.channel_id)?.channel_id ?? null, score });
      };

      const route = (item, bonus = 0) => {
        const t = item?.item_type ?? item?.type;
        if (t === 'artist') addArtist(item, 50 + bonus);
        else if (t === 'album' || t === 'single' || t === 'ep') addAlbum(item, bonus);
        else addTrack(item, bonus);
      };

      const [general, songs, videos, albums, artistResult] = await Promise.all([
        youtube.music.search(q),
        youtube.music.search(q, { type: 'song' }).catch(() => null),
        youtube.music.search(q, { type: 'video' }).catch(() => null),
        youtube.music.search(q, { type: 'album' }).catch(() => null),
        youtube.music.search(q, { type: 'artist' }).catch(() => null),
      ]);

      // "Resultado principal" of YouTube Music.
      let topKind = null, topId = null;
      const topCards = general.contents_memo?.getType(YTNodes.MusicCardShelf) ?? [];
      for (const card of topCards) {
        const id = card.title?.endpoint?.payload?.browseId ?? card.on_tap?.payload?.browseId ?? card.on_tap?.payload?.videoId;
        if (id && /^UC/.test(id)) { addArtist({ id, title: card.title, subtitle: card.subtitle, thumbnail: card.thumbnail }, 5000); topKind ??= 'artist'; topId ??= id; }
        else if (id && /^MPRE/.test(id)) { addAlbum({ id, title: card.title, subtitle: card.subtitle, thumbnail: card.thumbnail, item_type: 'album' }, 25); topKind ??= 'album'; topId ??= id; }
        else if (id) { addTrack({ ...card, id, item_type: card.item_type ?? 'song' }, 25); topKind ??= 'track'; topId ??= id; }
        for (const item of card.contents ?? []) route(item);
      }
      for (const shelf of general.contents ?? []) for (const item of shelf.contents ?? []) route(item);
      for (const shelf of songs?.contents ?? []) for (const item of shelf.contents ?? []) addTrack({ ...item, item_type: item.item_type ?? 'song' }, 5);
      for (const shelf of videos?.contents ?? []) for (const item of shelf.contents ?? []) addTrack({ ...item, item_type: 'video' });
      for (const shelf of albums?.contents ?? []) for (const item of shelf.contents ?? []) addAlbum(item, 5);
      for (const shelf of artistResult?.contents ?? []) for (const item of shelf.contents ?? []) addArtist(item);

      const seenNames = new Set();
      let artists = [...artistMap.values()].filter((a) => a.artworkUrl).sort((a, b) => b.score - a.score)
        .filter((a) => { const k = norm(a.name); if (seenNames.has(k)) return false; seenNames.add(k); return true; });
      const official = artists[0];
      const isArtistQuery = official && norm(official.name) === nq;
      const allTracks = [...trackMap.values()];
      if (isArtistQuery) {
        const collab = new Map();
        for (const { track } of allTracks) {
          const list = track.artists ?? [];
          if (!list.some((a) => a.id === official.id)) continue;
          for (const a of list) if (a.id && a.id !== official.id) collab.set(a.id, a.name);
        }
        const rest = artists.slice(1).filter((a) => !collab.has(a.id));
        const collabs = [];
        await Promise.all([...collab.entries()].slice(0, 6).map(async ([cid, cname]) => {
          const known = artists.find((a) => a.id === cid);
          if (known) return collabs.push(known);
          try { const d = await loadArtistFast(cid); if (d?.artworkUrl) collabs.push({ id: cid, name: d.name ?? cname, artworkUrl: d.artworkUrl }); } catch {}
        }));
        artists = [official, ...collabs, ...rest];
        for (const t of allTracks) if ((t.track.artists ?? []).some((a) => a.id === official.id)) t.score += 50;
        for (const a of albumMap.values()) if (a.artistId === official.id || norm(a.artistName).includes(nq)) a.score += 50;
      }
      const sortedSongs = allTracks.filter((t) => !t.isVideo).sort((a, b) => b.score - a.score);
      const sortedVideos = allTracks.filter((t) => t.isVideo).sort((a, b) => b.score - a.score);
      const sortedAlbums = [...albumMap.values()].sort((a, b) => b.score - a.score);

      // Best match for the "Resultado principal" card.
      let top = null;
      const bestSong = sortedSongs[0], bestAlbum = sortedAlbums[0];
      if (isArtistQuery) top = { kind: 'artist', artist: official };
      else {
        const cands = [
          bestSong && { kind: 'track', score: bestSong.score, track: bestSong.track },
          bestAlbum && { kind: 'album', score: bestAlbum.score - 5, album: bestAlbum },
          official && topKind === 'artist' && { kind: 'artist', score: official.score >= 5000 ? 120 : 0, artist: official },
        ].filter(Boolean).sort((a, b) => b.score - a.score);
        top = cands[0] ?? null;
      }
      const strip = ({ score, ...rest }) => rest;
      if (top?.artist) top.artist = strip(top.artist);
      if (top?.album) top.album = strip(top.album);
      return {
        top,
        artists: artists.slice(0, 8).map(strip),
        tracks: sortedSongs.slice(0, limit).map((t) => t.track),
        videos: sortedVideos.slice(0, 12).map((t) => t.track),
        albums: sortedAlbums.slice(0, 12).map(strip),
      };
    });
    warmAudio(data.tracks.slice(0, 3).map((t) => t.sourceId), req.query.format === 'webm' ? 'webm' : 'mp4');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
}

/** Full file download (audio, or a muxed audio+video MP4). */
async function getMuxedFormat(videoId) {
  const errors = [];
  for (let round = 0; round < 2; round++) {
    const youtube = await getYoutube(round > 0);
    // Only some clients hand out playable audio+video (muxed) links.
    for (const client of ['ANDROID', 'ANDROID_VR', ...CLIENTS]) {
      try {
        const info = await youtube.getBasicInfo(videoId, { client });
        const f = (info.streaming_data?.formats ?? []).filter((x) => x.has_audio && x.has_video && x.url).sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
        if (f && (await fetch(`${f.url}&range=0-1`).catch(() => null))?.ok) return { url: f.url, mimeType: f.mime_type.split(';')[0], contentLength: f.content_length ? Number(f.content_length) : null, info };
        errors.push(`${client}:none`);
      } catch (e) { errors.push(`${client}:${e.message}`); }
    }
  }
  throw new Error(errors.join(' | '));
}

async function download(req, res) {
  const { videoId } = req.params;
  if (!/^[\w-]{6,20}$/.test(videoId)) return res.status(400).json({ error: 'bad id' });
  const kind = req.query.kind === 'video' ? 'video' : 'audio';
  const name = String(req.query.name || videoId).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 120) || videoId;
  try {
    const format = kind === 'video' ? await getMuxedFormat(videoId) : await getAudioFormat(videoId, req.query.format === 'webm' ? 'webm' : 'mp4');
    const total = format.contentLength;
    let upstream = await fetch(kind === 'video' ? format.url : `${format.url}&range=0-${total ? total - 1 : ''}`);
    if (!upstream.ok && kind === 'video' && total) upstream = await fetch(`${format.url}&range=0-${total - 1}`);
    if (!upstream.ok || !upstream.body) throw new Error(`upstream ${upstream.status}`);
    const ext = kind === 'video' ? 'mp4' : format.mimeType.includes('webm') ? 'webm' : 'm4a';
    res.setHeader('Content-Type', format.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`);
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);
    Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ error: error.message });
  }
}

/** Album / single / EP / video / artist card from a carousel. */
function toCard(item) {
  const id = item?.id ?? item?.endpoint?.payload?.browseId ?? item?.endpoint?.payload?.videoId;
  const title = textOf(item?.title);
  if (!id || !title) return null;
  const subtitle = textOf(item?.subtitle);
  const year = /\b(19|20)\d{2}\b/.exec(subtitle ?? '')?.[0] ?? null;
  let type = item.item_type ?? 'album';
  if (/\bEP\b/.test(subtitle ?? '')) type = 'ep';
  else if (/single|sencillo/i.test(subtitle ?? '')) type = 'single';
  return { id, title, subtitle, year, type, artworkUrl: upscale(bestThumbnail(item)) };
}

function sectionKind(title, cards) {
  const t = (title ?? '').toLowerCase();
  if (/single|sencillo|\bep\b/.test(t)) return 'singles';
  if (/álbum|album/.test(t)) return 'albums';
  if (/aparece|featured|colabora|destacado/.test(t)) return 'appears';
  if (/v[ií]deo|directo|live/.test(t)) return 'videos';
  if (/fans|similar|relacionad|también/.test(t)) return 'related';
  if (/playlist|lista/.test(t)) return 'playlists';
  return cards[0]?.type === 'artist' ? 'related' : 'other';
}

/** Follows the "ver todo" link of a carousel to get the complete list. */
async function expandSection(youtube, section) {
  const endpoint = section.header?.more_content?.endpoint;
  if (!endpoint) return null;
  try {
    const response = await Promise.race([
      endpoint.call(youtube.actions, { client: 'YTMUSIC', parse: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
    ]);
    const items = response?.contents_memo?.getType(YTNodes.MusicTwoRowItem) ?? [];
    const cards = [...items].map(toCard).filter(Boolean);
    return cards.length ? cards : null;
  } catch {
    return null;
  }
}

const expanding = new Map();
/** Fast version: no carousel expansion — returns in one YouTube request. */
function loadArtistFast(id) {
  return cached(`artist-fast:${id}`, 12 * 60 * 60 * 1000, () => buildArtist(id, false));
}
function loadArtist(id) {
  return cached(`artist:${id}`, 12 * 60 * 60 * 1000, () => buildArtist(id, true));
}
function fullCached(id) {
  const hit = memo.get(`artist:${id}`);
  return hit && hit.expires > Date.now() ? hit.value : null;
}
function expandInBackground(id) {
  if (expanding.has(id) || fullCached(id)) return;
  expanding.set(id, loadArtist(id).catch(() => null).finally(() => expanding.delete(id)));
}

async function buildArtist(id, expand) {
  {
    const youtube = await getYoutube();
    const data = await youtube.music.getArtist(id);
    const header = data.header ?? {};
    const name = textOf(header.title);
    const topSongs = [];
    const sections = [];
    await Promise.all((data.sections ?? []).map(async (section, order) => {
      const title = textOf(section.header?.title) ?? '';
      const items = section.contents ?? [];
      if (section.type === 'MusicShelf') {
        for (const item of items) {
          const track = toTrack(item);
          if (track) topSongs.push({ ...track, artistName: track.artistName ?? name, artistId: track.artistId ?? id, artists: track.artists?.length ? track.artists : [{ name, id }] });
        }
        return;
      }
      let cards = items.map(toCard).filter(Boolean);
      const kind = sectionKind(title, cards);
      if (expand && kind !== 'related') cards = (await expandSection(youtube, section)) ?? cards;
      if (kind === 'albums' || kind === 'singles') cards.sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0));
      if (cards.length) sections.push({ order, title, kind, items: cards });
    }));
    const ORDER = ['albums', 'singles', 'videos', 'appears', 'playlists', 'related', 'other'];
    const TITLES = { albums: 'Álbumes', singles: 'Sencillos y EP', videos: 'Videoclips', appears: 'Aparece en', playlists: 'Playlists', related: 'Artistas similares' };
    sections.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.order - b.order);
    sections.forEach((sec, i) => { sec.order = i; if (TITLES[sec.kind]) sec.title = TITLES[sec.kind]; });
    const releases = sections.filter((x) => x.kind === 'albums' || x.kind === 'singles').flatMap((x) => x.items);
    const latestRelease = releases.reduce((best, c) => (!best || Number(c.year ?? 0) > Number(best.year ?? 0) ? c : best), null);
    return {
      latestRelease,
      id,
      name,
      artworkUrl: upscale(bestThumbnail(header)),
      description: textOf(header.description),
      subscribers: textOf(header.subscription_button?.subscriber_count) ?? textOf(header.monthly_listener_count) ?? null,
      topSongs,
      sections,
      partial: !expand,
    };
  }
}

async function artist(req, res) {
  try {
    const data = fullCached(req.params.id) ?? (await loadArtistFast(req.params.id));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ id: data.id, name: data.name, artworkUrl: data.artworkUrl });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}

async function artistFull(req, res) {
  try {
    const id = req.params.id;
    let data = fullCached(id);
    if (!data) {
      // Race: if the full page arrives within 1.2s use it, otherwise answer with the fast one.
      expandInBackground(id);
      const fast = loadArtistFast(id);
      data = await Promise.race([expanding.get(id) ?? fast, new Promise((r) => setTimeout(r, 1200)).then(() => fast)]);
      if (!data) data = await fast;
    }
    warmAudio(data.topSongs.slice(0, 2).map((t) => t.sourceId), req.query.format === 'webm' ? 'webm' : 'mp4');
    res.setHeader('Cache-Control', data.partial ? 'no-store' : 'public, max-age=3600');
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}

async function album(req, res) {
  try {
    const id = req.params.id;
    const data = await cached(`album:${id}`, 6 * 60 * 60 * 1000, async () => {
      const youtube = await getYoutube();
      const result = await youtube.music.getAlbum(id);
      const header = result.header ?? {};
      const artworkUrl = upscale(bestThumbnail(header));
      const authorRuns = header.author ? [header.author] : [];
      const artistName = textOf(header.author?.name) ?? header.author?.name ?? textOf(header.strapline_text_one) ?? null;
      const artistId = header.author?.channel_id ?? header.strapline_text_one?.endpoint?.payload?.browseId ?? null;
      const title = textOf(header.title);
      const tracks = (result.contents ?? []).map(toTrack).filter(Boolean).map((t) => ({
        ...t,
        artistName: t.artistName ?? artistName,
        artistId: t.artistId ?? artistId,
        artists: t.artists?.length ? t.artists : artistName ? [{ name: artistName, id: artistId }] : [],
        albumName: t.albumName ?? title,
        albumId: t.albumId ?? id,
        artworkUrl: artworkUrl ?? t.artworkUrl,
      }));
      void authorRuns;
      return { id, title, subtitle: textOf(header.subtitle), artistName, artistId, artworkUrl, tracks };
    });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}

/** Radio / "a continuación" + credits for a song, from YouTube Music's up-next panel. */
async function upNext(req, res) {
  try {
    const id = req.params.videoId;
    if (!/^[\w-]{6,20}$/.test(id)) return res.status(400).json({ error: 'bad id' });
    const data = await cached(`upnext:${id}`, 60 * 60 * 1000, async () => {
      const youtube = await getYoutube();
      const panel = await youtube.music.getUpNext(id, true);
      const tracks = [];
      let credits = [];
      for (const item of panel.contents ?? []) {
        const vid = item.video_id;
        const title = textOf(item.title);
        if (!vid || !title) continue;
        const artists = (item.artists ?? []).filter((a) => a?.name);
        if (vid === id && !credits.length) credits = artists.map((a) => ({ name: a.name, id: a.channel_id ?? null }));
        tracks.push({
          id: `youtube:${vid}`, source: 'youtube', sourceId: vid, title,
          artistName: artists.map((a) => a.name).join(', ') || textOf(item.author) || null,
          artistId: artists.find((a) => a.channel_id)?.channel_id ?? null,
          artists: artists.map((a) => ({ name: a.name, id: a.channel_id ?? null })),
          albumName: item.album?.name ?? null, albumId: item.album?.id ?? null,
          durationSeconds: item.duration?.seconds ?? null,
          artworkUrl: upscale(bestThumbnail(item)) ?? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          isExplicit: Array.isArray(item.badges) ? item.badges.some((b) => /explicit/i.test(b?.label ?? '')) : false,
        });
      }
      return { credits, tracks: tracks.filter((t) => t.sourceId !== id) };
    });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
}

const lyricsCache = new Map();
app.get('/api/lyrics', async (req, res) => {
  const title = String(req.query.title || '');
  const artist = String(req.query.artist || '');
  if (!title) return res.json([]);
  const key = `${title}|${artist}`.toLowerCase();
  const hit = lyricsCache.get(key);
  if (hit && hit.exp > Date.now()) return res.json(hit.rows);
  try {
    const q = new URLSearchParams({ track_name: title, artist_name: artist });
    const r = await fetch(`https://lrclib.net/api/search?${q}`, { headers: { 'User-Agent': 'YURA/1.0 (https://lovable.dev)' } });
    const rows = r.ok ? await r.json() : [];
    lyricsCache.set(key, { rows, exp: Date.now() + 1000 * 60 * 60 * 24 });
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(rows);
  } catch {
    res.json([]);
  }
});


// ---- Home feed by country (YouTube Music charts + regional home shelves) ----
const ytByCountry = new Map();
function getYoutubeFor(gl) {
  if (!ytByCountry.has(gl)) ytByCountry.set(gl, Innertube.create({ retrieve_player: false, lang: 'es', location: gl, cache: new UniversalCache(false) }));
  return ytByCountry.get(gl);
}

function chartTrack(item) {
  const t = toTrack(item);
  if (!t) return null;
  if (!t.artistName || !t.artistId) {
    const runs = item?.flex_columns?.[1]?.title?.runs || [];
    const artistRuns = runs.filter((r) => r?.endpoint?.payload?.browseId?.startsWith?.('UC'));
    if (artistRuns.length) {
      t.artistName = t.artistName || artistRuns.map((r) => r.text).join(', ');
      t.artistId = t.artistId || artistRuns[0].endpoint.payload.browseId;
      if (!t.artists?.length) t.artists = artistRuns.map((r) => ({ name: r.text, id: r.endpoint.payload.browseId }));
    } else if (!t.artistName) {
      const txt = textOf(item?.flex_columns?.[1]?.title) || item?.flex_columns?.[1]?.title?.toString?.();
      if (txt) t.artistName = txt.split(' • ')[0];
    }
  }
  return t;
}

async function playlistTracks(youtube, browseId, limit) {
  try {
    const id = browseId.replace(/^VL/, '');
    const pl = await youtube.music.getPlaylist(id);
    return (pl.items || []).map(chartTrack).filter(Boolean).slice(0, limit);
  } catch { return []; }
}

async function buildHome(gl) {
  const youtube = await getYoutubeFor(gl);
  const raw = await youtube.actions.execute('/browse', { browseId: 'FEmusic_charts', client: 'YTMUSIC', formData: { selectedValues: [gl] }, parse: true });
  const shelves = raw.contents_memo?.getType(YTNodes.MusicCarouselShelf) || [];
  let chartPlaylists = [];
  let topArtists = [];
  for (const s of shelves) {
    for (const c of s.contents || []) {
      if (c.item_type === 'artist' || c.endpoint?.payload?.browseId?.startsWith?.('UC')) {
        const id = c.id || c.endpoint?.payload?.browseId;
        const name = c.flex_columns?.[0]?.title?.toString?.() || textOf(c.title);
        if (id && name) topArtists.push({ id, name, artworkUrl: upscale(bestThumbnail(c)) });
      } else if (c.item_type === 'playlist') {
        const id = c.id || c.endpoint?.payload?.browseId;
        if (id) chartPlaylists.push({ id, title: textOf(c.title) || c.title?.toString?.() });
      }
    }
  }
  const trendingPl = chartPlaylists.find((p) => /tendencias|trending/i.test(p.title || '')) || chartPlaylists[0];
  const topPl = chartPlaylists.find((p) => /100/.test(p.title || '')) || chartPlaylists[2] || chartPlaylists[1];

  const [trending, topSongs, homeFeed] = await Promise.all([
    trendingPl ? playlistTracks(youtube, trendingPl.id, 20) : [],
    topPl ? playlistTracks(youtube, topPl.id, 50) : [],
    youtube.music.getHomeFeed().catch(() => null),
  ]);

  const playlists = [];
  for (const s of homeFeed?.sections || []) {
    const title = s.header?.title?.toString?.();
    const cards = (s.contents || []).filter((c) => c.item_type === 'playlist' || c.item_type === 'album').map(toCard).filter((c) => c && c.artworkUrl).slice(0, 12);
    if (title && cards.length >= 3) playlists.push({ title, items: cards });
  }

  return {
    country: gl,
    trendingTitle: trendingPl?.title || 'Tendencias',
    topTitle: topPl?.title || 'Lo más escuchado',
    trending,
    topSongs,
    topArtists: topArtists.slice(0, 20),
    playlists: playlists.slice(0, 4),
  };
}

app.get('/api/home', async (req, res) => {
  const gl = String(req.query.gl || 'US').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'US';
  try {
    const data = await cached(`home:${gl}`, 30 * 60 * 1000, () => buildHome(gl));
    res.json(data);
  } catch (e) {
    console.error('home error', e?.message);
    res.status(500).json({ error: 'home_failed' });
  }
});


// ---- Song <-> official video counterpart ----
const normTitle = (t) => String(t || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/official|video|oficial|music|audio|lyrics?|hd|4k/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
async function findCounterpart(videoId, title, artist, artistId) {
  const youtube = await getYoutube();
  let type = null;
  try {
    const raw = await youtube.actions.execute('/next', { videoId, client: 'YTMUSIC' });
    const j = JSON.stringify(raw.data);
    const cp = /"counterpart":\[\{"counterpartRenderer":\{"playlistPanelVideoRenderer":\{.*?"videoId":"([\w-]{11})"/.exec(j);
    type = /"musicVideoType":"(\w+)"/.exec(j)?.[1] ?? null;
    if (cp) return { type, counterpartId: cp[1] };
  } catch { /* ignore */ }
  if (!title) return { type, counterpartId: null };
  const isVideo = type === 'MUSIC_VIDEO_TYPE_OMV' || type === 'MUSIC_VIDEO_TYPE_UGC';
  const want = normTitle(title);
  const firstArtist = String(artist || '').split(',')[0].trim().toLowerCase();
  try {
    const r = await youtube.music.search(`${title} ${artist || ''}`.trim(), { type: isVideo ? 'song' : 'video' });
    const list = (isVideo ? r.songs?.contents : r.videos?.contents) || r.contents?.flatMap((x) => x.contents || []) || [];
    for (const item of list) {
      if (!item?.id || item.id === videoId) continue;
      const artists = item.artists || item.authors || [];
      const okArtist = artists.some((a) => (artistId && a.channel_id === artistId) || (firstArtist && String(a.name || '').toLowerCase() === firstArtist));
      const t = normTitle(textOf(item.title));
      const okTitle = t && (t.includes(want) || want.includes(t));
      if (okArtist && okTitle) return { type, counterpartId: item.id };
    }
  } catch { /* ignore */ }
  return { type, counterpartId: null };
}

app.get('/api/counterpart/:videoId', async (req, res) => {
  const id = req.params.videoId;
  if (!/^[\w-]{6,20}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const { title = '', artist = '', artistId = '' } = req.query;
  try {
    const data = await cached(`cp:${id}`, 12 * 60 * 60 * 1000, () => findCounterpart(id, String(title), String(artist), String(artistId)));
    const isVideo = data.type === 'MUSIC_VIDEO_TYPE_OMV' || data.type === 'MUSIC_VIDEO_TYPE_UGC';
    res.json({
      type: data.type,
      songId: isVideo ? data.counterpartId : id,
      videoId: isVideo ? id : data.counterpartId,
    });
  } catch (e) {
    res.json({ type: null, songId: id, videoId: null });
  }
});

// ---- Image proxy: the desktop webview blocks Google image hosts, so it loads them from here (cached on disk). ----
const IMG_DIR = path.join(os.tmpdir(), 'yura-img');
try { mkdirSync(IMG_DIR, { recursive: true }); } catch { /* ignore */ }
const IMG_HOSTS = /(^|\.)(googleusercontent\.com|ggpht\.com|ytimg\.com)$/;
app.get('/api/img', async (req, res) => {
  let url;
  try { url = new URL(String(req.query.u || '')); } catch { return res.status(400).end(); }
  if (url.protocol !== 'https:' || !IMG_HOSTS.test(url.hostname)) return res.status(400).end();
  const file = path.join(IMG_DIR, createHash('sha1').update(url.href).digest('hex'));
  const send = (buf, type) => {
    res.set({ 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    res.end(buf);
  };
  try {
    const [buf, type] = await Promise.all([readFile(file), readFile(file + '.type', 'utf8')]);
    return send(buf, type);
  } catch { /* not cached yet */ }
  try {
    const r = await fetch(url.href);
    if (!r.ok) return res.status(r.status).end();
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get('content-type') || 'image/jpeg';
    writeFile(file, buf).then(() => writeFile(file + '.type', type)).catch(() => {});
    send(buf, type);
  } catch {
    res.status(502).end();
  }
});

// ---- Podcasts (YouTube Music episodes / podcast videos) ----
app.get('/api/podcasts', async (req, res) => {
  const q = String(req.query.q || 'podcast').slice(0, 120);
  try {
    const tracks = await cached(`pod:${q}`, 30 * 60 * 1000, async () => {
      const youtube = await getYoutube();
      const query = /podcast/i.test(q) ? q : `${q} podcast`;
      let list = [];
      for (const type of ['podcast', 'video']) {
        try {
          const r = await youtube.music.search(query, { type });
          list = (r.videos?.contents || r.contents?.flatMap((x) => x.contents || []) || []).map(toTrack).filter(Boolean);
          if (list.length) break;
        } catch { /* try next filter */ }
      }
      return list.slice(0, 30);
    });
    res.json({ tracks });
  } catch (e) {
    res.status(500).json({ error: 'podcasts_failed', tracks: [] });
  }
});

app.get('/api/up-next/:videoId', upNext);
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'YURA Backend is running' }));

app.get('/api/search', search);
app.get('/api/download/:videoId', download);
app.get('/api/public/music/search', search);

app.get('/api/stream/:videoId/audio', streamAudio);
app.head('/api/stream/:videoId/audio', streamAudio);
app.get('/api/public/music/stream/:videoId', streamAudio);

app.get('/api/artist/:id', artist);
app.get('/api/public/music/artist/:id', artist);
app.get('/api/artist/:id/full', artistFull);
app.get('/api/album/:id', album);

app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const format = await getAudioFormat(videoId);
    res.json({
      videoId,
      streamUrl: `${req.protocol}://${req.get('host')}/api/stream/${videoId}/audio`,
      title: format.info.basic_info.title,
      artist: format.info.basic_info.author,
      duration: format.info.basic_info.duration,
    });
  } catch (error) {
    res.status(502).json({ error: 'Failed to get stream URL', message: error.message });
  }
});

if (existsSync(WEB_DIR)) {
  app.use('/app', express.static(WEB_DIR, { extensions: ['html'] }));
  app.use(express.static(WEB_DIR, { extensions: ['html'] }));
  app.get(/^(?!\/api\/|\/health).*/, (_req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
}

export default app;

// Only start a standalone server when run directly (Tauri sidecar / dev:backend).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain || process.pkg) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YURA Backend running on port ${PORT}`);
    // Warm up the YouTube session so the first search is instant.
    getYoutube().then((y) => y.music.search('música', { type: 'song' })).catch(() => {});
  });
}
