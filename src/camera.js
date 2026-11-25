export class Camera {
  constructor(chart, view, world, onRender) {
    this.chart = chart;
    this.view = view;
    this.world = world;
    this.onRender = onRender;
    this.x = chart.width / 2;
    this.y = chart.height / 2;
    this.zoom = 1;
  }

  resize() {
    const { width, height } = this.view.getBoundingClientRect();
    this.width = width;
    this.height = height;
    if (!this.width || !this.height) return;
    this.fit = Math.min(this.width / this.chart.width, this.height / this.chart.height) * .93;
    this.view.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.render();
  }

  get scale() {
    return this.zoom * this.fit;
  }

  chartPoint(x, y) {
    return [
      this.x + (x - this.width / 2) / this.scale,
      this.y + (y - this.height / 2) / this.scale
    ];
  }

  screenPoint(x, y) {
    return [
      this.width / 2 + (x - this.x) * this.scale,
      this.height / 2 + (y - this.y) * this.scale
    ];
  }

  render() {
    if (!this.fit) return;
    this.x = Math.max(0, Math.min(this.chart.width, this.x));
    this.y = Math.max(0, Math.min(this.chart.height, this.y));
    const [left, top] = this.screenPoint(0, 0);
    this.world.setAttribute('transform', `translate(${left} ${top}) scale(${this.scale})`);
    this.onRender(this.zoom);
  }

  frame(anchor, screenX, screenY, zoom) {
    this.zoom = Math.max(1, Math.min(6, zoom));
    this.x = anchor[0] - (screenX - this.width / 2) / this.scale;
    this.y = anchor[1] - (screenY - this.height / 2) / this.scale;
    this.render();
  }

  stop(reveal = true) {
    if (this.flight === undefined) return;
    cancelAnimationFrame(this.flight);
    this.flight = undefined;
    const settled = this.onFocusSettled;
    this.onFocusSettled = undefined;
    if (reveal) settled?.();
  }

  focus(stars, { overview, reducedMotion, onSettled }) {
    this.stop(false);
    const xs = stars.map(([x]) => x);
    const ys = stars.map(([, y]) => y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    const from = { x: this.x, y: this.y, zoom: this.zoom };
    const to = {
      x: left + width / 2,
      y: top + height / 2,
      zoom: Math.max(1, Math.min(3.6,
        this.width * .56 / (Math.max(1, width) * this.fit),
        this.height * .49 / (Math.max(1, height) * this.fit)))
    };
    if (reducedMotion) {
      Object.assign(this, to);
      this.render();
      onSettled();
      return;
    }

    const wide = { x: this.chart.width / 2, y: this.chart.height / 2, zoom: 1 };
    const distance = Math.hypot(to.x - wide.x, to.y - wide.y) / Math.hypot(wide.x, wide.y);
    const legs = overview ? [
      { target: wide, duration: 550 },
      { target: { ...to, zoom: wide.zoom }, duration: 360 + distance * 460 },
      { target: to, duration: 680 }
    ] : [{ target: to, duration: 680 }];

    this.onFocusSettled = onSettled;
    let origin = from;
    let index = 0;
    let start = performance.now();
    const step = time => {
      // Advance through elapsed legs when the browser skips frames.
      while (index < legs.length - 1 && time >= start + legs[index].duration) {
        start += legs[index].duration;
        origin = legs[index].target;
        index++;
      }
      const { target, duration } = legs[index];
      const fraction = Math.max(0, Math.min(1, (time - start) / duration));
      const ease = fraction * fraction * (3 - 2 * fraction);
      this.x = origin.x + (target.x - origin.x) * ease;
      this.y = origin.y + (target.y - origin.y) * ease;
      this.zoom = origin.zoom + (target.zoom - origin.zoom) * ease;
      this.render();
      if (fraction === 1) this.stop();
      else this.flight = requestAnimationFrame(step);
    };
    this.flight = requestAnimationFrame(step);
  }

  zoomAt(factor, x = this.width / 2, y = this.height / 2) {
    this.stop();
    this.frame(this.chartPoint(x, y), x, y, this.zoom * factor);
  }

  reset() {
    this.stop(false);
    this.x = this.chart.width / 2;
    this.y = this.chart.height / 2;
    this.zoom = 1;
    this.render();
  }
}
