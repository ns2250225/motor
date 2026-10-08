/**
 * 移动端触控输入状态（PRD 9.2/9.3）。
 * 由 Vue 组件 TouchControls.vue 通过多点触控写入；游戏循环读取。
 */
export class TouchControls {
  enabled = false;
  steer = 0; // -1..1（按钮或虚拟摇杆）
  throttle = false;
  brake = false;
  drift = false;
  nitro = false;
  private edges = new Set<'attack' | 'beak' | 'item' | 'super' | 'horn' | 'reset'>();
  lastUsed = 0;

  press(e: 'attack' | 'beak' | 'item' | 'super' | 'horn' | 'reset') {
    this.edges.add(e);
    this.lastUsed = performance.now();
  }
  touched() {
    this.lastUsed = performance.now();
  }
  consume(e: 'attack' | 'beak' | 'item' | 'super' | 'horn' | 'reset') {
    return this.edges.has(e);
  }
  endFrame() {
    this.edges.clear();
  }
  reset() {
    this.steer = 0;
    this.throttle = this.brake = this.drift = this.nitro = false;
    this.edges.clear();
  }
}

export const touchControls = new TouchControls();
