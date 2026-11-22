// Copies OpenCV.js into public/vendor so the capture page can lazy-load it
// as a plain script (and the browser can cache it) instead of bundling 10 MB.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve('@techstark/opencv-js/package.json')), 'dist', 'opencv.js');
const dest = join(process.cwd(), 'public', 'vendor', 'opencv.js');
mkdirSync(dirname(dest), { recursive: true });
if (!existsSync(dest) || statSync(dest).size !== statSync(src).size) copyFileSync(src, dest);
console.log('opencv.js ->', dest);
