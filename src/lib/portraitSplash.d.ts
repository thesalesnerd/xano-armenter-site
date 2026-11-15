export type SplashData = { width: number; height: number; blobs: unknown[] };
export type SplashHandle = { play(): void; finish(): void; destroy(): void; duration: number };
export function mount(host: HTMLElement, data: SplashData, baseSrc: string, opts?: { intro?: "bird" }): SplashHandle;
