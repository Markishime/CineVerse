export type YtPlayer = {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  mute?: () => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
  getIframe?: () => HTMLIFrameElement;
};

function isAttached(player: YtPlayer | null | undefined): player is YtPlayer {
  try {
    return player?.getIframe?.()?.isConnected === true;
  } catch {
    return false;
  }
}

export function hardSilence(player: YtPlayer | null | undefined) {
  if (!isAttached(player)) return;
  try {
    player.mute?.();
    player.pauseVideo?.();
    player.stopVideo?.();
  } catch {
    // A provider can detach its iframe between events.
  }
}

export function releasePlayer(ref: { current: YtPlayer | null }) {
  const player = ref.current;
  ref.current = null;
  hardSilence(player);
  // react-youtube owns destruction; destroying its raw player here races its
  // component cleanup and leaves queued API calls pointing at a detached iframe.
}

export function applyPlayback(
  player: YtPlayer | null | undefined,
  opts: { play: boolean; soundOn: boolean },
) {
  if (!isAttached(player)) return;
  if (!opts.play) {
    hardSilence(player);
    return;
  }
  try {
    if (opts.soundOn) {
      player.unMute?.();
      player.setVolume?.(72);
    } else {
      player.mute?.();
    }
    player.playVideo?.();
  } catch {
    // Ignore a player that was removed while applying its current state.
  }
}
