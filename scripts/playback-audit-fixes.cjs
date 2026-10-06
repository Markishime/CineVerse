const fs = require('fs');
function edit(p, fn) { fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
edit('src/types/playback.ts', s => 'import { SubtitleTrackSchema } from "@/lib/playback/subtitles";\n' + s.replace('export const PlaybackSourceDocumentSchema = z.object({', 'export const PlaybackSourceDocumentSchema = z.object({\n  subtitles: z.array(SubtitleTrackSchema).optional(),').replace('export const ResolvedPlaybackSchema = z.object({', 'export const ResolvedPlaybackSchema = z.object({\n  subtitles: z.array(SubtitleTrackSchema).optional(),'));
edit('src/lib/playback/resolve-playback.ts', s => s.replace('source.manifestPath?.endsWith(".m3u8")', 'source.manifestPath?.split(/[?#]/)[0].endsWith(".m3u8")').replaceAll('      signedUrl,\n', '      signedUrl,\n      subtitles: chosen.subtitles,\n'));
edit('src/lib/content/catalog-service.ts', s => 'import type { SubtitleTrack } from "@/lib/playback/subtitles";\n' + s.replace('      embedUrl: string;\n', '      embedUrl: string;\n      subtitles?: SubtitleTrack[];\n').replace('      downloadUrl: resolved.downloadUrl,', '      subtitles: resolved.subtitles,\n      downloadUrl: resolved.downloadUrl,'));
edit('src/lib/api/content.ts', s => 'import type { SubtitleTrack } from "@/lib/playback/subtitles";\n' + s.replace('      embedUrl: string;\n', '      embedUrl: string;\n      subtitles?: SubtitleTrack[];\n'));
edit('src/components/content/media-player.tsx', s => {
 s = s.replace('export interface LegalFullSource {', 'export interface LegalFullSource {\n  subtitles?: import("@/lib/playback/subtitles").SubtitleTrack[];');
 s = s.replace('legalFull.type === "hls" ||', 'legalFull.type === "mp4" || legalFull.type === "hls" ||');
 s = s.replace('src={legalFull.embedUrl}\n                autoPlay', 'src={legalFull.embedUrl}\n                subtitles={legalFull.subtitles}\n                autoPlay');
 return s;
});
edit('src/components/content/video-player.tsx', s => {
 s = s.replace('    function handleMessage(e: MessageEvent) {\n      const data', '    function handleMessage(e: MessageEvent) {\n      if (!embedUrl || e.source !== iframeRef.current?.contentWindow || e.origin !== new URL(embedUrl).origin) return;\n      const data');
 s = s.replace('        msg.includes("player_title") ||\n        msg.includes("playertitle") ||\n', '');
 s = s.replace('        msg.includes("loadedmetadata") ||\n        msg.includes("canplay") ||\n', '');
 s = s.replace('msg === "play" ||\n        msg === "duration"', 'msg === "play"');
 s = s.replace('[activeProvider?.id, advanceToNextProvider, clearTimers]', '[activeProvider, embedUrl, advanceToNextProvider, clearTimers]');
 s = s.replace('          <iframe\n', '          <iframe\n            ref={iframeRef}\n');
 s = s.replace('  const [activeIndex, setActiveIndex]', '  const iframeRef = useRef<HTMLIFrameElement>(null);\n  const [activeIndex, setActiveIndex]');
 s = s.replace('      {/* Controls always above', '      <p className="mt-2 text-xs text-[var(--text-muted)]">Subtitles are available in the player’s CC menu when supplied by the source. External players may show ads. If playback does not start, choose another server.</p>\n\n      {/* Controls always above');
 return s;
});
