let cachedMobile: boolean | null = null;

/** 识别移动端设备：UA + 触控能力 + 粗指针 */
export function matchMobileDevice(): boolean {
  if (cachedMobile !== null) return cachedMobile;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser|Windows Phone/i.test(ua);
  // iPadOS 13+ 伪装为 Mac
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  cachedMobile = uaMobile || iPadOS || (coarse && navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900);
  return cachedMobile;
}

export const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 部分浏览器不支持 */
  }
}
