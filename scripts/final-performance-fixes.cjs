const fs = require('fs');
function edit(p, fn) { fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
edit('src/components/home/hero-carousel.tsx', s => {
 s = s.replace('motion, useReducedMotion', 'motion, useReducedMotion, useMotionValue');
 s = s.replace('const [progress, setProgress] = useState(0);', 'const progress = useMotionValue(0);');
 s = s.replaceAll('setProgress(', 'progress.set(');
 s = s.replace('  }, [emblaApi]);\n\n  useEffect', '  }, [emblaApi, progress]);\n\n  useEffect');
 s = s.replace('if (reduceMotion || slides.length < 2) return;', 'if (!playbackAllowed || reduceMotion || slides.length < 2) return;');
 s = s.replace('[index, autoplayDelay, reduceMotion, slides.length]', '[index, autoplayDelay, reduceMotion, slides.length, playbackAllowed, progress]');
 s = s.replace('<div\n            className="h-full origin-left bg-[var(--primary-light)]"\n            style={{ transform: `scaleX(${progress})` }}', '<motion.div\n            className="h-full origin-left bg-[var(--primary-light)]"\n            style={{ scaleX: progress }}');
 s = s.replace('<span\n                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary-light)]"', '<motion.span\n                  className="absolute inset-0 origin-left rounded-full bg-[var(--primary-light)]"');
 s = s.replace('width: reduceMotion ? "100%" : `${progress * 100}%`,', 'scaleX: reduceMotion ? 1 : progress,');
 s = s.replace('  shouldPlayRef.current = shouldPlay;\n  soundOnRef.current = soundOn;', '  useEffect(() => {\n    shouldPlayRef.current = shouldPlay;\n    soundOnRef.current = soundOn;\n  }, [shouldPlay, soundOn]);');
 // First paint must contain useful text even if animation frames are suspended.
 s = s.replace('                          animated\n', '                          animated={false}\n');
 return s;
});
edit('src/components/providers/app-providers.tsx', s => s.replace('import { SmoothScrollProvider } from "./smooth-scroll-provider";\n', '').replace('<SmoothScrollProvider>{children}</SmoothScrollProvider>', '{children}'));
edit('src/components/home/home-page.tsx', s => s.replace('initial={reduce ? false : "hidden"}', 'initial={false}'));
edit('src/components/layout/header.tsx', s => {
 s = s.replace('      onMouseLeave={handleLeave}', '      onMouseLeave={handleLeave}\n      onFocus={handleEnter}\n      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onLeave(); }}\n      onKeyDown={(event) => { if (event.key === "Escape") onLeave(); }}');
 s = s.replace(/        onClick=\{\(e\) => \{\n          \/\/ Allow direct navigation[\s\S]*?        \}\}\n/, '');
 return s;
});
// A require is deliberately lazy here; place its existing exception on the actual call.
edit('src/lib/server/firebase-admin.ts', s => s.replace('    // eslint-disable-next-line @typescript-eslint/no-require-imports\n    const { getApps, initializeApp, cert, applicationDefault } =\n      require', '    const { getApps, initializeApp, cert, applicationDefault } =\n      // eslint-disable-next-line @typescript-eslint/no-require-imports\n      require'));
edit('src/components/content/video-player.tsx', s => s.replace('}, [activeProvider?.id, onProviderLoad]);', '}, [activeProvider, onProviderLoad]);'));
edit('src/lib/providers/live-catalog.ts', s => s.replace('let tmdbId = extractTmdbFromExternalLinks', 'const tmdbId = extractTmdbFromExternalLinks'));
