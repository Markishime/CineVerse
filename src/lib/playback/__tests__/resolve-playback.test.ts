import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackSourceDocumentSchema } from "@/types/playback";

const { listSources, buildStreamPlayback } = vi.hoisted(() => ({
  listSources: vi.fn(),
  buildStreamPlayback: vi.fn(),
}));

vi.mock("@/lib/playback/playback-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/playback/playback-store")>()),
  listSources,
}));
vi.mock("@/lib/playback/cloudflare-stream", () => ({ buildStreamPlayback }));

import {
  resolveAssetUrl,
  resolvePlayback,
} from "@/lib/playback/resolve-playback";

function source(overrides: Record<string, unknown> = {}) {
  return PlaybackSourceDocumentSchema.parse({
    id: "licensed-source",
    titleId: "test-title",
    sourceType: "cineverse_hosted",
    providerName: "Licensed media",
    playbackAssetId: "https://storage.googleapis.com/test/feature.mp4",
    contentKind: "full_movie",
    status: "approved",
    rightsHolder: "Test rights holder",
    rightsBasis: "direct_license",
    reviewedBy: "test-reviewer",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("approved playback resolution", () => {
  beforeEach(() => {
    listSources.mockReset();
    buildStreamPlayback.mockReset();
    buildStreamPlayback.mockReturnValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("skips an unavailable hosted source and uses the next approved provider", () => {
    listSources.mockReturnValue([
      source({ playbackAssetId: "https://untrusted.example/feature.mp4" }),
      source({
        id: "fallback",
        sourceType: "youtube_embed",
        youtubeVideoId: "testvideo01",
      }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" })).toMatchObject({
      playable: true,
      mode: "youtube_iframe",
      youtubeVideoId: "testvideo01",
    });
  });

  it("skips an unconfigured Cloudflare source", () => {
    listSources.mockReturnValue([
      source({
        sourceType: "cloudflare_stream",
        cloudflareVideoUid: "video123",
      }),
      source({
        id: "fallback",
        sourceType: "vimeo_embed",
        vimeoVideoId: "123456789",
      }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" })).toMatchObject({
      playable: true,
      mode: "vimeo_embed",
    });
  });

  it("returns the iframe URL when Cloudflare selects iframe playback", () => {
    listSources.mockReturnValue([
      source({
        sourceType: "cloudflare_stream",
        cloudflareVideoUid: "video123",
      }),
    ]);
    buildStreamPlayback.mockReturnValue({
      mode: "cloudflare_iframe",
      videoUid: "video123",
      iframeUrl: "https://customer-test.cloudflarestream.com/video123/iframe",
      manifestUrl:
        "https://customer-test.cloudflarestream.com/video123/manifest/video.m3u8",
    });
    expect(resolvePlayback({ titleId: "test-title" })).toMatchObject({
      mode: "cloudflare_iframe",
      signedUrl: "https://customer-test.cloudflarestream.com/video123/iframe",
    });
  });

  it("does not use a movie source for an episode requested by coordinates", () => {
    listSources.mockReturnValue([source()]);
    expect(
      resolvePlayback({
        titleId: "test-title",
        seasonNumber: 1,
        episodeNumber: 2,
      }).playable,
    ).toBe(false);
  });

  it("matches the exact episode without selecting another episode", () => {
    listSources.mockReturnValue([
      source({
        id: "wrong",
        contentKind: "full_episode",
        episodeId: "test_s1_e1",
        seasonNumber: 1,
        episodeNumber: 1,
      }),
      source({
        id: "right",
        contentKind: "full_episode",
        episodeId: "test_s1_e2",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
    ]);
    expect(
      resolvePlayback({
        titleId: "test-title",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
    ).toMatchObject({
      playable: true,
      episodeId: "test_s1_e2",
      episodeNumber: 2,
    });
  });

  it("does not select a fallback outside its license region", () => {
    listSources.mockReturnValue([
      source({ playbackAssetId: "https://untrusted.example/feature.mp4" }),
      source({ id: "fallback", allowedRegions: ["PH"] }),
    ]);
    expect(
      resolvePlayback({ titleId: "test-title", region: "SG" }).playable,
    ).toBe(false);
  });

  it("does not select an expired fallback", () => {
    listSources.mockReturnValue([
      source({ playbackAssetId: "https://untrusted.example/feature.mp4" }),
      source({ id: "expired", validUntil: "2000-01-01T00:00:00.000Z" }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" }).playable).toBe(false);
  });

  it("does not advertise a trailer as full playback", () => {
    listSources.mockReturnValue([source({ contentKind: "trailer" })]);
    expect(resolvePlayback({ titleId: "test-title" })).toMatchObject({
      playable: false,
      watchLabel: "Watch Trailer",
    });
    expect(
      resolvePlayback({ titleId: "test-title", preferFull: false }).playable,
    ).toBe(true);
  });

  it("preserves Archive iframe mode", () => {
    listSources.mockReturnValue([
      source({
        sourceType: "public_domain",
        playbackAssetId: "archive:test-film",
      }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" })).toMatchObject({
      mode: "archive_embed",
      signedUrl: "https://archive.org/embed/test-film",
    });
  });

  it("recognizes a trusted Archive embed URL supplied as an asset", () => {
    listSources.mockReturnValue([
      source({ playbackAssetId: "https://archive.org/embed/test-film" }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" }).mode).toBe(
      "archive_embed",
    );
  });

  it("recognizes HLS from the resolved manifest when the asset id is opaque", () => {
    listSources.mockReturnValue([
      source({
        playbackAssetId: "asset123",
        manifestPath:
          "https://storage.googleapis.com/test/video.m3u8?token=test",
      }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" }).mode).toBe(
      "cineverse_hls",
    );
  });

  it("keeps Archive direct files in the video player", () => {
    listSources.mockReturnValue([
      source({
        playbackAssetId: undefined,
        manifestPath: "https://archive.org/download/test-film/feature.mp4",
      }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" }).mode).toBe(
      "cineverse_mp4",
    );
  });

  it("rejects insecure or credential-bearing manifest URLs", () => {
    expect(
      resolveAssetUrl(
        source({
          playbackAssetId: undefined,
          manifestPath: "http://storage.googleapis.com/test/video.mp4",
        }),
      ),
    ).toBeUndefined();
    expect(
      resolveAssetUrl(
        source({
          playbackAssetId:
            "https://user:password@storage.googleapis.com/test/video.mp4",
        }),
      ),
    ).toBeUndefined();
  });

  it("handles an invalid CDN configuration without throwing", () => {
    vi.stubEnv("PLAYBACK_CDN_BASE_URL", "invalid-base");
    listSources.mockReturnValue([
      source({ playbackAssetId: "playback/video.m3u8" }),
    ]);
    expect(resolvePlayback({ titleId: "test-title" }).playable).toBe(false);
  });
});
