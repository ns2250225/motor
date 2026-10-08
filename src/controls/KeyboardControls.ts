/** PC 键盘操作（PRD 9.1），支持同时按下转向、加速和攻击按键 */
export class KeyboardControls {
  held = new Set<string>();
  pressed = new Set<string>();
  onAction: ((action: 'pause' | 'camera') => void) | null = null;
  active = false;

  private down = (e: KeyboardEvent) => {
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (!this.held.has(k)) this.pressed.add(k);
    this.held.add(k);
    this.active = true;
    if (k === 'Escape' || k === 'KeyP') this.onAction?.('pause');
    if (k === 'KeyC' && !e.repeat) this.onAction?.('camera');
  };
  private up = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };
  private blur = () => {
    this.held.clear();
  };

  attach() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }
  detach() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
  }

  isDown(...codes: string[]) {
    return codes.some((c) => this.held.has(c));
  }
  wasPressed(...codes: string[]) {
    return codes.some((c) => this.pressed.has(c));
  }
  endFrame() {
    this.pressed.clear();
  }
}
