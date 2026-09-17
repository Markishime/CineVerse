import { z } from "zod";

/** WebVTT files served by the asset owner, with CORS enabled for external hosts. */
export const SubtitleTrackSchema = z.object({
  src: z.string().refine((src) => src.startsWith("https://") || (src.startsWith("/") && !src.startsWith("//")), "Use an HTTPS or same-origin subtitle URL"),
  srcLang: z.string().min(2).max(35),
  label: z.string().min(1).max(100),
  default: z.boolean().optional(),
});
export type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>;
