import { describe, expect, it, vi } from "vitest";
import { applyPlayback, hardSilence, releasePlayer } from "../youtube-controls";

function makePlayer(connected = true) {
  return {
    getIframe: () => ({ isConnected: connected }) as HTMLIFrameElement,
    mute: vi.fn(),
    unMute: vi.fn(),
    setVolume: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    stopVideo: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("hero trailer lifecycle", () => {
  it("never sends playback or cleanup commands to a detached iframe", () => {
    const player = makePlayer(false);
    applyPlayback(player, { play: true, soundOn: true });
    hardSilence(player);
    const ref = { current: player };
    releasePlayer(ref);
    expect(ref.current).toBeNull();
    for (const command of [
      player.playVideo,
      player.mute,
      player.unMute,
      player.pauseVideo,
      player.stopVideo,
      player.destroy,
    ]) {
      expect(command).not.toHaveBeenCalled();
    }
  });

  it("silences an outgoing player and leaves destruction to react-youtube", () => {
    const player = makePlayer();
    const ref = { current: player };
    releasePlayer(ref);
    expect(ref.current).toBeNull();
    expect(player.mute).toHaveBeenCalledOnce();
    expect(player.pauseVideo).toHaveBeenCalledOnce();
    expect(player.stopVideo).toHaveBeenCalledOnce();
    expect(player.destroy).not.toHaveBeenCalled();
  });

  it("sets the sound preference before starting playback", () => {
    const player = makePlayer();
    applyPlayback(player, { play: true, soundOn: false });
    expect(player.mute.mock.invocationCallOrder[0]).toBeLessThan(
      player.playVideo.mock.invocationCallOrder[0],
    );
  });
});
