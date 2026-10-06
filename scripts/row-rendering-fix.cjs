const fs = require('fs');
const p = 'src/components/content/content-row.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace('useRef, useState, useEffect, useMemo, type ReactNode', 'useMemo');
s = s.replace(/function LazyRender\([\s\S]*?\nexport function ContentRow/, 'export function ContentRow');
s = s.replace('<LazyRender className={className}>', '<div className={className} style={{ contentVisibility: "auto", containIntrinsicSize: wide ? "auto 260px" : "auto 360px" }}>').replace('</LazyRender>', '</div>');
s = s.replace('initial={reduce ? false : rowEnter.initial}', 'initial={false}');
fs.writeFileSync(p, s);
