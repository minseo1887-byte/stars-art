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
    this.width = this.view.clientWidth;
    this.height = this.view.clientHeight;
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

  zoomAt(factor, x = this.width / 2, y = this.height / 2) {
    this.frame(this.chartPoint(x, y), x, y, this.zoom * factor);
  }

  reset() {
    this.x = this.chart.width / 2;
    this.y = this.chart.height / 2;
    this.zoom = 1;
    this.render();
  }
}
