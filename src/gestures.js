export function connectGestures(view, camera, hit) {
  const pointers = new Map();
  let gesture;
  let tap;
  let scheduled;

  function point(event) {
    const bounds = view.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top];
  }

  function metrics() {
    const [first, second] = pointers.values();
    if (!second) return { x: first[0], y: first[1], distance: 1 };
    return {
      x: (first[0] + second[0]) / 2,
      y: (first[1] + second[1]) / 2,
      distance: Math.max(1, Math.hypot(first[0] - second[0], first[1] - second[1]))
    };
  }

  function rebase() {
    if (!pointers.size) return;
    const { x, y, distance } = metrics();
    gesture = { anchor: camera.chartPoint(x, y), zoom: camera.zoom, distance };
  }

  function move() {
    scheduled = undefined;
    if (!pointers.size || tap) return;
    const { x, y, distance } = metrics();
    camera.frame(gesture.anchor, x, y, gesture.zoom * distance / gesture.distance);
  }

  function flush() {
    if (scheduled === undefined) return;
    cancelAnimationFrame(scheduled);
    move();
  }

  view.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointers.size === 2) return;
    camera.stop();
    flush();
    const position = point(event);
    tap = pointers.size ? null : position;
    pointers.set(event.pointerId, position);
    view.setPointerCapture(event.pointerId);
    view.classList.add('grabbing');
    rebase();
  });

  view.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const [x, y] = point(event);
    pointers.set(event.pointerId, [x, y]);
    if (tap && Math.hypot(x - tap[0], y - tap[1]) > 7) tap = null;
    scheduled ??= requestAnimationFrame(move);
  });

  function finish(event) {
    if (!pointers.has(event.pointerId)) return;
    flush();
    const [x, y] = point(event);
    if (tap && event.type === 'pointerup' && Math.hypot(x - tap[0], y - tap[1]) <= 7) hit(x, y);
    tap = null;
    pointers.delete(event.pointerId);
    view.classList.toggle('grabbing', pointers.size > 0);
    rebase();
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    view.addEventListener(type, finish);
  }

  view.addEventListener('wheel', event => {
    event.preventDefault();
    if (pointers.size) return;
    const multiplier = [1, 16, camera.height][event.deltaMode] ?? 1;
    camera.zoomAt(Math.exp(-event.deltaY * multiplier * .0015), ...point(event));
  }, { passive: false });

  return () => {
    camera.resize();
    rebase();
  };
}
