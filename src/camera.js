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

  stop() {
    if (this.flight === undefined) return;
    cancelAnimationFrame(this.flight);
    this.flight = undefined;
  }

  focus(stars, reducedMotion) {
    this.stop();
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
      return;
    }
    const start = performance.now();
    const step = time => {
      const fraction = Math.min(1, (time - start) / 680);
      const ease = fraction * fraction * (3 - 2 * fraction);
      this.x = from.x + (to.x - from.x) * ease;
      this.y = from.y + (to.y - from.y) * ease;
      this.zoom = from.zoom + (to.zoom - from.zoom) * ease;
      this.render();
      this.flight = fraction < 1 ? requestAnimationFrame(step) : undefined;
    };
    this.flight = requestAnimationFrame(step);
  }

  zoomAt(factor, x = this.width / 2, y = this.height / 2) {
    this.stop();
    this.frame(this.chartPoint(x, y), x, y, this.zoom * factor);
  }

  reset() {
    this.stop();
    this.x = this.chart.width / 2;
    this.y = this.chart.height / 2;
    this.zoom = 1;
    this.render();
  }
}
