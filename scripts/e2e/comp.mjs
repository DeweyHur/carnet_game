import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { readFileSync } from 'fs';
const ids = ['julie', 'gustave', 'marcel', 'quentin', 'elodie', 'lune'];
const imgs = ids.map((i) => `<div style="width:380px;height:440px;overflow:hidden;display:inline-block;position:relative"><img src="data:image/png;base64,${readFileSync(`g_${i}.png`).toString('base64')}" style="position:absolute;left:-260px;top:-60px"></div>`).join('');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1140, height: 880 } });
await p.setContent(`<body style="margin:0;background:#222">${imgs}</body>`); await p.screenshot({ path: 'gallery.png' }); await b.close();
