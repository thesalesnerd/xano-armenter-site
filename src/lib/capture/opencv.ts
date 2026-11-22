// Lazy loader for OpenCV.js (~10 MB, copied to /vendor/opencv.js at build time
// by scripts/copy-opencv.mjs). Only the capture pages load it; the browser
// caches it afterwards.

// OpenCV.js has no useful TypeScript surface for what we use, so it's `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;

let loading: Promise<CV> | null = null;

export function loadOpenCV(): Promise<CV> {
  if (loading) return loading;
  loading = new Promise<CV>((resolve, reject) => {
    const w = window as unknown as { cv?: CV };
    const ready = (cv: CV) => {
      if (cv && typeof cv.then === 'function') {
        // Some builds expose a thenable Module. Unwrap it once, without
        // resolving with the thenable itself (that would loop).
        cv.then((m: CV) => { delete m.then; resolve(m); });
      } else if (cv?.Mat) resolve(cv);
      else cv.onRuntimeInitialized = () => resolve(cv);
    };
    if (w.cv) return ready(w.cv);
    const s = document.createElement('script');
    s.src = `${import.meta.env.BASE_URL}vendor/opencv.js`;
    s.async = true;
    s.onload = () => ready(w.cv);
    s.onerror = () => { loading = null; reject(new Error('Could not load the image engine (OpenCV). Check the connection and try again.')); };
    document.head.appendChild(s);
  });
  return loading;
}
