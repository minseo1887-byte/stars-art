import './modes.js';
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
const catalog = byId('catalog');
const details = byId('star-details');
const compact = matchMedia('(max-width: 680px), (max-height: 530px) and (orientation: landscape)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const buttons = new Map();
catalog.open = !compact.matches;
compact.addEventListener('change', () => { catalog.open = !compact.matches; });
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
  for (const [from, to] of item.edges) {
    const [x1, y1] = item.stars[from];
    const [x2, y2] = item.stars[to];
    const edge = svg('g', { class: 'trace-edge' }, group);
    edge.style.setProperty('--delay', `${260 + Math.max(from, to) * 210}ms`);
    svg('line', { x1, y1, x2, y2, pathLength: 1, class: 'line-halo' }, edge);
    svg('line', { x1, y1, x2, y2, pathLength: 1, class: 'line-core' }, edge);
  }
  item.stars.forEach(([cx, cy], index) => {
    const star = svg('g', { class: 'trace-star' }, group);
    star.style.setProperty('--delay', `${index * 210}ms`);
    svg('circle', { cx, cy, r: 26, class: 'glow' }, star);
    svg('circle', { cx, cy, r: 5.5, class: 'core' }, star);
  });
  traces.set(item.id, group);
}

function select(item) {
  if (selected?.id === item?.id) {
    if (item) details.open = true;
    return;
  }
  traces.get(selected?.id)?.classList.remove('selected');
  buttons.get(selected?.id)?.setAttribute('aria-pressed', 'false');
  selected = item;
  info.hidden = !item;
  if (!item) return;
  details.open = true;
  buttons.get(item.id).setAttribute('aria-pressed', 'true');
  const hanja = document.createElement('span');
  hanja.lang = 'zh-Hant';
  hanja.textContent = item.hanja;
  byId('star-name').replaceChildren(item.name, hanja);
  byId('star-shape').textContent = item.shape;
  byId('star-description').textContent = item.description;
  byId('star-story').textContent = item.story;
}

function hitAt(x, y, items, camera, activate) {
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
  if (nearest) activate(nearest);
}

for (const button of document.querySelectorAll('[data-dialog]')) {
  button.addEventListener('click', () => byId(button.dataset.dialog).showModal());
}

async function initialize() {
  const response = await fetch('./data/constellations.json');
  if (!response.ok) throw new Error('Constellation data unavailable');
  const { chart, constellations } = await response.json();
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
  function activate(item) {
    const overview = Boolean(selected && selected.id !== item.id);
    select(item);
    if (compact.matches) catalog.open = false;
    camera.focus(item.stars, {
      overview,
      reducedMotion: reducedMotion.matches,
      onSettled: () => traces.get(item.id).classList.add('selected')
    });
  }

  const resize = connectGestures(view, camera, (x, y) => {
    if (!document.body.classList.contains('quiet')) hitAt(x, y, constellations, camera, activate);
  });
  new ResizeObserver(resize).observe(view);
  camera.resize();
  constellations.forEach(renderTrace);

  for (const item of constellations) {
    const button = document.createElement('button');
    const hanja = document.createElement('span');
    hanja.lang = 'zh-Hant';
    hanja.textContent = item.hanja;
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.append(item.name, hanja);
    button.addEventListener('click', () => {
      activate(item);
      if (compact.matches) catalog.querySelector('summary').focus();
    });
    buttons.set(item.id, button);
    results.append(button);
  }

  function normalize(text) {
    return text.normalize('NFKC').replaceAll(/\s+/g, '');
  }

  function updateResults() {
    const term = normalize(query.value);
    let count = 0;
    for (const item of constellations) {
      const matches = [item.name, item.hanja, item.chartLabel, ...(item.aliases ?? [])]
        .some(name => normalize(name).includes(term));
      buttons.get(item.id).hidden = !matches;
      if (matches) count++;
    }
    byId('empty').hidden = count > 0;
  }
  query.addEventListener('input', updateResults);

  function reset() {
    camera.reset();
    select(undefined);
  }
  plus.addEventListener('click', () => camera.zoomAt(1.25));
  minus.addEventListener('click', () => camera.zoomAt(.8));
  byId('reset').addEventListener('click', reset);
  byId('close-info').addEventListener('click', () => {
    camera.stop(false);
    select(undefined);
    view.focus();
  });
  view.addEventListener('keydown', event => {
    const offsets = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] };
    const offset = offsets[event.key];
    if (offset) {
      camera.stop();
      camera.x += offset[0] / camera.scale;
      camera.y += offset[1] / camera.scale;
      camera.render();
    } else if (['+', '='].includes(event.key)) camera.zoomAt(1.25);
    else if (event.key === '-') camera.zoomAt(.8);
    else if (event.key === '0') reset();
    else if (event.key === 'Enter' && !document.body.classList.contains('quiet')) {
      catalog.open = true;
      query.focus();
    }
    else return;
    event.preventDefault();
  });
}

initialize().catch(error => {
  console.error(error);
  byId('status').textContent = '별자리 자료를 불러오지 못했습니다. HTTP 서버에서 열어 주세요.';
});
