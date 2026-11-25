import { Camera } from './camera.js';
import { connectGestures } from './gestures.js';

const byId = id => document.getElementById(id);
const view = byId('view');
const world = byId('world');
const map = byId('map');
const zoom = byId('zoom');
const minus = byId('minus');
const plus = byId('plus');
const info = byId('information');
const finder = byId('finder');
const query = byId('query');
const results = byId('results');
const traces = new Map();
let selected;

function svg(tag, attributes, parent) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent.append(element);
  return element;
}

function renderTrace(item) {
  const group = svg('g', { class: 'trace' }, byId('highlights'));
  item.edges.forEach(([from, to], index) => {
    const [x1, y1] = item.stars[from];
    const [x2, y2] = item.stars[to];
    const line = svg('line', { x1, y1, x2, y2, pathLength: 1 }, group);
    line.style.setProperty('--delay', `${150 + index * 105}ms`);
  });
  for (const [cx, cy] of item.stars) {
    svg('circle', { cx, cy, r: 19, class: 'glow' }, group);
    svg('circle', { cx, cy, r: 7, class: 'core' }, group);
  }
  traces.set(item.id, group);
}

function select(item) {
  if (selected?.id === item?.id) return;
  traces.get(selected?.id)?.classList.remove('selected');
  selected = item;
  info.hidden = !item;
  if (!item) return;
  traces.get(item.id).classList.add('selected');
  const hanja = document.createElement('span');
  hanja.lang = 'zh-Hant';
  hanja.textContent = item.hanja;
  byId('star-name').replaceChildren(item.name, hanja);
  byId('star-description').textContent = item.description;
}

function hitAt(x, y, items, camera) {
  let nearest;
  let best = 22;
  for (const item of items) {
    for (const star of item.stars) {
      const [sx, sy] = camera.screenPoint(...star);
      const distance = Math.hypot(x - sx, y - sy);
      if (distance < best) {
        nearest = item;
        best = distance;
      }
    }
  }
  if (nearest) select(nearest);
}

function openPanel(id) {
  if (id === 'finder') {
    query.value = '';
    query.dispatchEvent(new Event('input'));
  }
  byId(id).showModal();
}

for (const button of document.querySelectorAll('[data-dialog]')) {
  button.addEventListener('click', () => openPanel(button.dataset.dialog));
}

const quiet = byId('quiet');
const leaveQuiet = byId('leave-quiet');
function setQuiet(active) {
  document.body.classList.toggle('quiet', active);
  quiet.setAttribute('aria-pressed', String(active));
  leaveQuiet.hidden = !active;
  if (active) leaveQuiet.focus();
  else quiet.focus();
}
quiet.addEventListener('click', () => setQuiet(true));
leaveQuiet.addEventListener('click', () => setQuiet(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !leaveQuiet.hidden) setQuiet(false);
});

async function initialize() {
  const response = await fetch('./data/constellations.json');
  if (!response.ok) throw new Error('Constellation data unavailable');
  const { chart, constellations, pending } = await response.json();
  map.setAttribute('width', chart.width);
  map.setAttribute('height', chart.height);
  map.setAttribute('href', chart.asset);
  map.addEventListener('error', () => {
    byId('status').textContent = '천문도 이미지를 불러오지 못했습니다.';
  });
  const camera = new Camera(chart, view, world, factor => {
    zoom.value = `${Math.round(factor * 100)}%`;
    minus.disabled = factor <= 1;
    plus.disabled = factor >= 6;
  });
  const resize = connectGestures(view, camera, (x, y) => hitAt(x, y, constellations, camera));
  new ResizeObserver(resize).observe(view);
  camera.resize();
  constellations.forEach(renderTrace);

  function updateResults() {
    const term = query.value.trim().replaceAll(/\s+/g, '');
    const items = constellations.filter(item =>
      [item.name, item.hanja, item.chartLabel].some(name => name.includes(term))
    );
    results.replaceChildren();
    if (!items.length) results.textContent = '선택할 수 있는 별자리가 없습니다.';
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${item.name}  ·  ${item.hanja}`;
      button.addEventListener('click', () => {
        finder.close();
        const total = item.stars.reduce(([x, y], star) => [x + star[0], y + star[1]], [0, 0]);
        const center = total.map(value => value / item.stars.length);
        camera.frame(center, camera.width / 2, camera.height * .43, Math.max(2.15, camera.zoom));
        select(item);
      });
      results.append(button);
    }
  }

  byId('pending').textContent = `위치와 연결선 검증 예정 · ${pending.join(', ')}`;
  query.addEventListener('input', updateResults);
  updateResults();

  function reset() {
    camera.reset();
    select(undefined);
  }
  plus.addEventListener('click', () => camera.zoomAt(1.25));
  minus.addEventListener('click', () => camera.zoomAt(.8));
  byId('reset').addEventListener('click', reset);
  byId('close-info').addEventListener('click', () => {
    select(undefined);
    view.focus();
  });
  view.addEventListener('keydown', event => {
    const offsets = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] };
    const offset = offsets[event.key];
    if (offset) {
      camera.x += offset[0] / camera.scale;
      camera.y += offset[1] / camera.scale;
      camera.render();
    } else if (['+', '='].includes(event.key)) camera.zoomAt(1.25);
    else if (event.key === '-') camera.zoomAt(.8);
    else if (event.key === '0') reset();
    else if (event.key === 'Enter') openPanel('finder');
    else return;
    event.preventDefault();
  });
}

initialize().catch(error => {
  console.error(error);
  byId('status').textContent = '별자리 자료를 불러오지 못했습니다. HTTP 서버에서 열어 주세요.';
});
