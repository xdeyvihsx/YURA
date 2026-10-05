/** Which main page is shown; overlays (full player, album, artist) sit on top of it. */
export type View = 'home' | 'search' | 'library' | 'recents' | 'favorites' | 'downloads' | 'podcasts' | 'playlists' | `playlist:${string}`;
