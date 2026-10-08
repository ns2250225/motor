import { matchMobileDevice } from '../utils/device';

/**
 * 横屏管理（PRD 第十章）：
 * - 自动识别移动端
 * - 点击「开始游戏」后尝试全屏 + 锁定横屏（必须由用户手势触发）
 * - 无法锁定且处于竖屏时显示旋转提示并暂停；转回横屏后恢复布局、等待玩家继续
 */
export class OrientationManager {
  isMobile = matchMobileDevice();
  portrait = false;
  onChange: ((state: { portrait: boolean; showOverlay: boolean }) => void) | null = null;
  onResize: (() => void) | null = null;
  private mq = window.matchMedia('(orientation: portrait)');

  constructor() {
    const update = () => this.updateOrientationUI();
    this.mq.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', () => setTimeout(update, 120));
    screen.orientation?.addEventListener?.('change', update);
    document.addEventListener('fullscreenchange', update);
    this.portrait = this.mq.matches;
  }

  async enterLandscapeGame() {
    if (!this.isMobile) {
      this.updateOrientationUI();
      return;
    }
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
    } catch {
      // 全屏可能不被当前浏览器支持
    }
    try {
      const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (so?.lock) await so.lock('landscape');
    } catch {
      // 无法锁定时，启用旋转设备提示
    }
    this.updateOrientationUI();
  }

  updateOrientationUI() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight > window.innerWidth * 1.05;
    this.portrait = isPortrait;
    const showOverlay = this.isMobile && isPortrait;
    this.onChange?.({ portrait: isPortrait, showOverlay });
    if (!showOverlay) this.onResize?.();
  }
}
