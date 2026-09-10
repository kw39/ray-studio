import { validateProject as validProject } from './project-schema.mjs';

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg',
  STEP = 40,
  BIG = STEP * 5,
  KEY = 'ray-studio-project-v1';
let W = 1000,
  H = 800,
  selectedLabel = null;
const clone = (o) => JSON.parse(JSON.stringify(o)),
  esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
    );
const clamp = (n, a, b) => Math.max(a, Math.min(b, n)),
  round = (n) => Math.round(n * 100) / 100;
let seq = 0;
const uid = () => `n${Date.now().toString(36)}${(++seq).toString(36)}`;
const paths = {
  select: 'M5 3l13 9-7 1-3 7z',
  pan: 'M8 12V6a2 2 0 014 0v6m0-5a2 2 0 014 0v5m0-3a2 2 0 014 0v6c0 5-4 7-8 5l-6-6q-2-3 1-3z',
  mirror: 'M13 3v18M9 3l4 4M9 8l4 4M9 13l4 4M9 18l4 4',
  arrow: 'M5 19L19 5M5 13v6h6M13 5h6v6',
  ray: 'M3 19L21 3M10 8l5 1-1 5',
  line: 'M4 19L20 4',
  label: 'M5 5h14M12 5v15M8 20h8',
  measure: 'M3 6v12M21 6v12M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  point: 'M12 4v5M12 15v5M4 12h5M15 12h5M12 11v2',
  wall: 'M8 4v16M6 4h4M6 20h4M15 6h5M15 18h5',
  eye: 'M2 12q10-14 20 0-10 14-20 0M12 8a4 4 0 100 8 4 4 0 000-8',
};
const icon = (t) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[t] || paths.line}"/></svg>`;
const TOOLS = [
  ['select', 'Select', 'V', 'Select, move, resize, or rotate an element.'],
  ['pan', 'Pan', 'H', 'Drag the page to move around. Space + drag works with any tool.'],
  ['mirror', 'Mirror', '', 'A plane mirror with hatching on its non-reflective side.'],
  ['arrow', 'Double arrow', '', 'An arrow with independently editable endpoint labels.'],
  ['ray', 'Light ray', 'R', 'Connected rays with a middle arrowhead. Enter finishes the path.'],
  ['line', 'Plain line', '', 'A solid, dashed, or dotted line without arrows.'],
  [
    'label',
    'Text',
    'T',
    'Write text on the grid. Edit it in Properties and drag its corner to resize.',
  ],
  ['measure', 'Measurement', '', 'A horizontal or vertical dimension arrow.'],
  ['point', 'Point / marker', '', 'A point, cross, or circle with an optional label.'],
  ['wall', 'Wall / object', '', 'An object line with attached endpoint labels.'],
  ['eye', 'Eye / observer', '', 'A movable, rotatable eye symbol.'],
];
const LINE_TYPES = ['mirror', 'arrow', 'ray', 'line', 'measure', 'wall'];
TOOLS.splice(
  9,
  0,
  ['dot', 'Dot', '', 'A filled dot with an editable, draggable label.'],
  ['dash', 'Dash', '', 'A short horizontal dash with an editable, draggable label.'],
);
paths.dot = 'M12 9a3 3 0 100 6 3 3 0 000-6 M12 10v4 M11 11v2 M13 11v2';
paths.dash = 'M5 12h14';
const settings = () => ({
  rows: 4,
  columns: 5,
  scale: 0.5,
  unit: 'm',
  grid: true,
  markers: false,
  snapGrid: true,
  snapObjects: true,
});
const blank = () => ({
  format: 'ray-studio',
  version: 1,
  name: 'Untitled diagram',
  settings: settings(),
  nodes: {},
  objects: [],
});
let doc = blank(),
  selected = null,
  tool = 'select',
  past = [],
  future = [],
  clipboard = null,
  gesture = null,
  drawing = null,
  hover = null,
  space = false;
let view = { x: 0, y: 0, k: 1 },
  autosaveTimer,
  toastTimer;
const svg = $('#canvas'),
  world = $('#world');
function node(p) {
  const id = uid();
  doc.nodes[id] = { x: p.x, y: p.y };
  return id;
}
function labels(a = '', b = '') {
  return [
    { text: a, dx: 16, dy: -16, size: 54, bold: false, italic: true, align: 'start' },
    { text: b, dx: 16, dy: 60, size: 54, bold: false, italic: true, align: 'start' },
  ];
}
function make(type, p, q = null, shared = null) {
  if (type === 'dot' || type === 'dash') {
    const marker = make('point', p);
    marker.marker = type;
    if (type === 'dot') {
      marker.size = STEP / 2;
      marker.dx = STEP / 2 + 12;
    }
    if (type === 'dash') {
      marker.size = 12;
      marker.dx = 20;
    }
    return marker;
  }
  const o = {
    id: uid(),
    type,
    color: type === 'ray' ? '#d77741' : '#263b3e',
    width: type === 'mirror' ? 3 : 2.3,
    style: 'solid',
  };
  if (LINE_TYPES.includes(type)) {
    q = q || {
      x: p.x + (type === 'mirror' || type === 'wall' || type === 'arrow' ? 0 : 160),
      y: p.y + (type === 'mirror' || type === 'wall' || type === 'arrow' ? 200 : 0),
    };
    o.nodes = [shared?.[0] || node(p), shared?.[1] || node(q)];
    if (type === 'mirror') {
      o.side = 1;
      o.labels = labels('A', 'B');
    }
    if (type === 'arrow') o.labels = labels('A', 'B');
    if (type === 'wall') {
      o.labels = labels('P', 'Q');
      o.head = true;
    }
    if (type === 'ray') o.reverse = false;
    if (type === 'measure') {
      o.auto = true;
      o.text = '1 m';
      o.orientation = Math.abs(q.x - p.x) >= Math.abs(q.y - p.y) ? 'horizontal' : 'vertical';
      o.fontSize = 54;
    }
  } else {
    Object.assign(o, { x: p.x, y: p.y, angle: 0 });
    if (type === 'label')
      Object.assign(o, { text: 'Text', fontSize: 54, bold: false, italic: false, align: 'start' });
    if (type === 'point')
      Object.assign(o, { marker: 'dot', size: 6, label: 'E', fontSize: 54, dx: 13, dy: -10 });
    if (type === 'eye')
      Object.assign(o, {
        size: 72,
        flip: false,
        label: 'observer',
        fontSize: 54,
        labelDx: 0,
        labelDy: 0,
      });
  }
  doc.objects.push(o);
  return o;
}
function example() {
  doc = blank();
  doc.name = 'Seeing a virtual image';
  const mirrorX = 520,
    objectX = 240,
    imageX = 2 * mirrorX - objectX,
    eyePoint = { x: 200, y: 600 };
  const actual = '#d77741',
    virtual = '#598980';
  const caption = (text, x, y, size = 17, color = '#526b63', align = 'start') => {
    const o = make('label', { x, y });
    Object.assign(o, { text, fontSize: size, color, align });
    return o;
  };
  caption('Seeing an image in a plane mirror', 80, 55, 25, '#263b3e');
  caption('The eye traces reflected rays back to the virtual image.', 80, 86, 16);
  const object = make('wall', { x: objectX, y: 220 }, { x: objectX, y: 400 });
  object.labels = labels('A', 'B');
  const image = make('wall', { x: imageX, y: 220 }, { x: imageX, y: 400 });
  Object.assign(image, { style: 'dashed', color: virtual, labels: labels('A′', 'B′') });
  const objectCaption = caption('Object', objectX, 155, 19, '#263b3e', 'middle');
  const imageCaption = caption('Virtual image', imageX, 155, 19, virtual, 'middle');
  const eyeNode = node(eyePoint),
    branches = [];
  // Find the mirror intersections of the straight lines from the eye to each
  // virtual endpoint. These intersections enforce equal incidence/reflection angles.
  for (let i = 0; i < 2; i++) {
    const imagePoint = doc.nodes[image.nodes[i]],
      source = doc.nodes[object.nodes[i]];
    const t = (mirrorX - eyePoint.x) / (imagePoint.x - eyePoint.x);
    const hit = { x: mirrorX, y: eyePoint.y + t * (imagePoint.y - eyePoint.y) },
      junction = node(hit);
    const extension = make('line', hit, imagePoint, [junction, image.nodes[i]]);
    Object.assign(extension, { style: 'dashed', color: virtual, width: 1.8 });
    const incoming = make('ray', source, hit, [object.nodes[i], junction]);
    incoming.color = actual;
    const reflected = make('ray', hit, eyePoint, [junction, eyeNode]);
    reflected.color = actual;
    branches.push({
      junction,
      incoming: incoming.id,
      reflected: reflected.id,
      extension: extension.id,
    });
  }
  const mirror = make('mirror', { x: mirrorX, y: 130 }, { x: mirrorX, y: 665 });
  Object.assign(mirror, { side: -1, labels: labels('M₁', 'M₂') });
  Object.assign(mirror.labels[1], { dx: 50, dy: -25 });
  // Corrected side-view orientation. Rays meet the pupil on the mirror-facing side.
  const eye = make('eye', { x: eyePoint.x - (6 * 72) / 80, y: eyePoint.y });
  Object.assign(eye, { flip: false, label: 'Observer' });
  const mirrorCaption = caption('Plane mirror', mirrorX + 23, 655, 15);
  const left = make('measure', { x: objectX, y: 720 }, { x: mirrorX, y: 720 });
  left.auto = true;
  const right = make('measure', { x: mirrorX, y: 720 }, { x: imageX, y: 720 });
  Object.assign(right, { auto: true, color: virtual });
  caption('Solid rays: actual light', 80, 765, 15, actual);
  caption('Dashed lines: backward extensions (not real light)', 420, 765, 15, virtual);
  doc.optics = {
    enabled: true,
    mirror: mirror.id,
    object: object.id,
    image: image.id,
    eye: eye.id,
    eyeNode,
    branches,
    objectCaption: objectCaption.id,
    imageCaption: imageCaption.id,
    mirrorCaption: mirrorCaption.id,
    measurements: [left.id, right.id],
  };
}
function opticalItems() {
  const m = doc.optics;
  if (!m) return [];
  return [
    m.eye,
    m.mirror,
    m.object,
    m.image,
    ...(m.branches || []).flatMap((b) => [b.incoming, b.reflected, b.extension]),
    ...(m.measurements || []),
  ];
}
function opticalDerived(o) {
  return (
    doc.optics?.enabled &&
    opticalItems().includes(o.id) &&
    ![doc.optics.eye, doc.optics.mirror, doc.optics.object].includes(o.id)
  );
}
function updateOptics() {
  for (const o of doc.objects) delete o._opticsHidden;
  const m = doc.optics;
  if (!m?.enabled) return;
  const byId = (id) => doc.objects.find((o) => o.id === id),
    mirror = byId(m.mirror),
    object = byId(m.object),
    image = byId(m.image),
    eye = byId(m.eye);
  if (
    mirror?.type !== 'mirror' ||
    object?.type !== 'wall' ||
    image?.type !== 'wall' ||
    eye?.type !== 'eye' ||
    !Array.isArray(m.branches) ||
    m.branches.length !== 2
  ) {
    delete doc.optics;
    return;
  }
  const [a, b] = points(mirror),
    length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.01) {
    for (const id of opticalItems())
      if (![m.eye, m.object, m.mirror].includes(id) && byId(id)) byId(id)._opticsHidden = true;
    return;
  }
  const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length },
    normal = { x: -tangent.y, y: tangent.x };
  const distance = (p) => (p.x - a.x) * normal.x + (p.y - a.y) * normal.y,
    source = points(object),
    centre = midpoint(object),
    side = distance(centre) >= 0 ? 1 : -1;
  const margin = Math.max(2, Math.min(eye.size / 2 + 12, Math.abs(distance(centre)) * 0.5));
  // Project the observer onto the object's half-plane, with space for the symbol.
  const eyeDistance = side * distance(eye);
  if (eyeDistance < margin) {
    eye.x += side * normal.x * (margin - eyeDistance);
    eye.y += side * normal.y * (margin - eyeDistance);
  }
  const r = ((eye.angle || 0) * Math.PI) / 180,
    offset = ((eye.flip ? -1 : 1) * 6 * eye.size) / 80;
  const pupil = { x: eye.x + Math.cos(r) * offset, y: eye.y + Math.sin(r) * offset };
  if (!doc.nodes[m.eyeNode]) m.eyeNode = node(pupil);
  doc.nodes[m.eyeNode] = { ...pupil };
  const virtual = source.map((p) => {
    const d = distance(p);
    return { x: p.x - 2 * d * normal.x, y: p.y - 2 * d * normal.y };
  });
  virtual.forEach((p, i) => {
    doc.nodes[image.nodes[i]] = { ...p };
  });
  image.head = object.head;
  let visible = 0;
  m.branches.forEach((branch, i) => {
    const v = virtual[i],
      ds = distance(source[i]),
      de = distance(pupil),
      dv = distance(v),
      den = de - dv;
    const t = Math.abs(den) > 1e-9 ? de / den : 0,
      hit = { x: pupil.x + t * (v.x - pupil.x), y: pupil.y + t * (v.y - pupil.y) },
      along = (hit.x - a.x) * tangent.x + (hit.y - a.y) * tangent.y;
    const valid =
      Math.abs(den) > 1e-9 &&
      t > 0 &&
      t < 1 &&
      along >= -1e-7 &&
      along <= length + 1e-7 &&
      ds * de > 0 &&
      ds * (mirror.side || 1) < 0;
    if (!doc.nodes[branch.junction]) branch.junction = node(hit);
    doc.nodes[branch.junction] = { ...hit };
    for (const [id, ends] of [
      [branch.incoming, [object.nodes[i], branch.junction]],
      [branch.reflected, [branch.junction, m.eyeNode]],
      [branch.extension, [branch.junction, image.nodes[i]]],
    ]) {
      const ray = byId(id);
      if (ray) {
        ray.nodes = ends;
        ray._opticsHidden = !valid;
        if (ray.type === 'ray') ray.reverse = false;
      }
    }
    if (valid) visible++;
  });
  m.visibleEndpoints = visible;
  m.captionAnchors ??= {};
  const moveCaption = (id, p) => {
    const o = byId(id),
      previous = m.captionAnchors[id];
    if (o && previous) {
      o.x += p.x - previous.x;
      o.y += p.y - previous.y;
    }
    m.captionAnchors[id] = p;
  };
  moveCaption(m.objectCaption, { x: centre.x, y: Math.min(...source.map((p) => p.y)) - 65 });
  moveCaption(m.imageCaption, {
    x: (virtual[0].x + virtual[1].x) / 2,
    y: Math.min(...virtual.map((p) => p.y)) - 65,
  });
  moveCaption(m.mirrorCaption, { x: b.x + 23, y: b.y - 10 });
  const anchor = { x: b.x + tangent.x * 55, y: b.y + tangent.y * 55 },
    d = distance(centre);
  for (const [i, id] of (m.measurements || []).entries()) {
    const measure = byId(id);
    if (!measure?.nodes) continue;
    const far = {
      x: anchor.x + normal.x * d * (i === 0 ? 1 : -1),
      y: anchor.y + normal.y * d * (i === 0 ? 1 : -1),
    };
    doc.nodes[measure.nodes[0]] = i === 0 ? far : { ...anchor };
    doc.nodes[measure.nodes[1]] = i === 0 ? { ...anchor } : far;
    measure.orientation = Math.abs(normal.x) >= Math.abs(normal.y) ? 'horizontal' : 'vertical';
  }
}
let recoveryProject = null,
  autosaveBlocked = false;
try {
  recoveryProject = localStorage.getItem(KEY + '-recovery');
  const saved = localStorage.getItem(KEY);
  if (saved) {
    try {
      doc = validProject(JSON.parse(saved));
    } catch {
      recoveryProject = saved;
      try {
        localStorage.setItem(KEY + '-recovery', saved);
      } catch {
        autosaveBlocked = true;
      }
      example();
    }
  } else example();
} catch {
  autosaveBlocked = true;
  example();
}
function current() {
  return doc.objects.find((o) => o.id === selected);
}
function snapshot() {
  return clone(doc);
}
function commit(before) {
  updateOptics();
  if (JSON.stringify(before) === JSON.stringify(doc)) return;
  past.push(before);
  if (past.length > 80) past.shift();
  future = [];
  scheduleSave();
  render();
}
function change(fn) {
  const before = snapshot();
  fn();
  commit(before);
}
function scheduleSave() {
  clearTimeout(autosaveTimer);
  if (autosaveBlocked) {
    $('#save-status').textContent = 'Autosave unavailable — use Save project';
    return;
  }
  $('#save-status').textContent = 'Saving on this device…';
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(doc));
      $('#save-status').textContent = 'Saved on this device';
    } catch {
      $('#save-status').textContent = 'Use Save project to keep a copy';
    }
  }, 220);
}
function undo() {
  cancelDraw();
  if (!past.length) return;
  future.push(snapshot());
  doc = past.pop();
  selected = null;
  scheduleSave();
  render();
}
function redo() {
  cancelDraw();
  if (!future.length) return;
  past.push(snapshot());
  doc = future.pop();
  selected = null;
  scheduleSave();
  render();
}
function toast(s) {
  $('#toast').textContent = s;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
function points(o) {
  return o.nodes?.map((id) => doc.nodes[id]);
}
function midpoint(o) {
  if (o.nodes) {
    const [a, b] = points(o);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return { x: o.x, y: o.y };
}
function angle(o) {
  if (o.nodes) {
    const [a, b] = points(o);
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }
  return o.angle || 0;
}
function dash(o) {
  return o.style === 'dashed' ? '10 7' : o.style === 'dotted' ? '1 6' : '';
}
function line(a, b, attr = '') {
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attr}/>`;
}
function head(p, r, color, size = 10) {
  const x = p.x - size * Math.cos(r),
    y = p.y - size * Math.sin(r);
  return `<path d="M ${p.x} ${p.y} L ${x - (size / 2) * Math.sin(r)} ${y + (size / 2) * Math.cos(r)} L ${x + (size / 2) * Math.sin(r)} ${y - (size / 2) * Math.cos(r)} Z" fill="${esc(color)}" stroke="none"/>`;
}
function textAt(p, text, size = 20, attr = '') {
  return `<text x="${p.x}" y="${p.y}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" ${attr}>${String(
    text,
  )
    .split('\n')
    .map(
      (row, i) => `<tspan x="${p.x}" dy="${i ? size * 1.25 : 0}">${esc(row) || '&#160;'}</tspan>`,
    )
    .join('')}</text>`;
}
function measureValue(o) {
  if (o.scaleMarker) return `${bigScale()} ${doc.settings.unit}`;
  if (!o.auto) return o.text || '';
  const [a, b] = points(o),
    n = (Math.hypot(b.x - a.x, b.y - a.y) / STEP) * doc.settings.scale;
  return `${Number(n.toFixed(3))} ${doc.settings.unit}`;
}
function objectSVG(o, interactive = false) {
  if (o._opticsHidden || (o.scaleMarker && !doc.settings.markers)) return '';
  let body = '',
    color = esc(o.color),
    stroke = `stroke="${color}" stroke-width="${o.width || 2}" stroke-linecap="round" fill="none"`,
    attr = stroke + ` stroke-dasharray="${dash(o)}"`;
  if (o.nodes) {
    const [a, b] = points(o),
      r = Math.atan2(b.y - a.y, b.x - a.x),
      len = Math.hypot(b.x - a.x, b.y - a.y),
      m = midpoint(o);
    body += line(a, b, attr);
    if (o.type === 'mirror' && len > 0) {
      const ux = (b.x - a.x) / len,
        uy = (b.y - a.y) / len,
        s = o.side || 1;
      const hatch = STEP / Math.sqrt(2);
      for (let t = 0; t <= len; t += STEP) {
        const p = { x: a.x + ux * t, y: a.y + uy * t };
        body += line(
          p,
          { x: p.x - uy * hatch * s - ux * hatch, y: p.y + ux * hatch * s - uy * hatch },
          `stroke="${color}" stroke-width="${o.width}"`,
        );
      }
    }
    if (o.type === 'arrow' || o.type === 'measure')
      body +=
        head(a, r + Math.PI, o.color, (STEP * o.width) / 2.3) +
        head(b, r, o.color, (STEP * o.width) / 2.3);
    if (o.type === 'wall' && o.head) body += head(a, r + Math.PI, o.color, (STEP * o.width) / 2.3);
    if (o.type === 'ray')
      body += head(m, r + (o.reverse ? Math.PI : 0), o.color, (STEP * o.width) / 2.3);
    if (o.type === 'measure') {
      const n = { x: -Math.sin(r), y: Math.cos(r) };
      for (const p of [a, b])
        body += line(
          { x: p.x + n.x * 10, y: p.y + n.y * 10 },
          { x: p.x - n.x * 10, y: p.y - n.y * 10 },
          `stroke="${color}" stroke-width="${o.width}"`,
        );
    }
    if (interactive) body = line(a, b, `class="hit-line" stroke-width="18"`) + body;
  } else if (o.type === 'label') {
    body += textAt(
      { x: o.x, y: o.y },
      o.text,
      o.fontSize,
      `fill="${color}" font-weight="${o.bold ? 'bold' : 'normal'}" font-style="${o.italic ? 'italic' : 'normal'}" text-anchor="${['start', 'middle', 'end'].includes(o.align) ? o.align : 'start'}" transform="rotate(${o.angle || 0} ${o.x} ${o.y})"`,
    );
    if (interactive) {
      const b = bounds(o);
      body += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="transparent" transform="rotate(${o.angle || 0} ${o.x} ${o.y})"/>`;
    }
  } else if (o.type === 'point') {
    const s = o.size || 6;
    body +=
      o.marker === 'dash'
        ? line({ x: o.x - s, y: o.y }, { x: o.x + s, y: o.y }, stroke)
        : o.marker === 'cross'
          ? `<path d="M ${o.x - s} ${o.y - s} L ${o.x + s} ${o.y + s} M ${o.x - s} ${o.y + s} L ${o.x + s} ${o.y - s}" ${stroke}/>`
          : `<circle cx="${o.x}" cy="${o.y}" r="${s}" fill="${o.marker === 'circle' ? 'white' : color}" stroke="${color}" stroke-width="${o.width}"/>`;
    if (interactive)
      body += `<circle cx="${o.x}" cy="${o.y}" r="${Math.max(16, s)}" fill="transparent"/>`;
  } else if (o.type === 'eye') {
    body += `<g transform="translate(${o.x} ${o.y}) rotate(${o.angle || 0}) scale(${((o.flip ? -1 : 1) * o.size) / 80} ${o.size / 80})"><path d="M 0 -40 Q 0 -12 -14 0 Q 0 12 0 40 M 0 -27 Q 19 0 0 27 Q 7 0 0 -27 Z" fill="white" stroke="${color}" stroke-width="${o.width}" stroke-linejoin="round"/><ellipse cx="6" cy="0" rx="3.7" ry="13" fill="${color}"/></g>`;
  }
  for (const key of attachedKeys(o)) body += attachedSVG(o, key, interactive);
  return `<g ${interactive ? `class="diagram-object" data-oid="${o.id}"` : ''}>${body}</g>`;
}
function attachedKeys(o) {
  return o.labels
    ? ['0', '1']
    : o.type === 'eye' || o.type === 'point'
      ? ['name']
      : o.type === 'measure'
        ? ['measurement']
        : [];
}
function labelInfo(o, key) {
  if (o.labels) {
    const l = o.labels[Number(key)],
      a = points(o)[Number(key)];
    return { ...l, x: a.x + l.dx, y: a.y + l.dy };
  }
  if (o.type === 'point')
    return {
      text: o.label || '',
      size: o.fontSize || 20,
      dx: o.dx || 0,
      dy: o.dy || 0,
      x: o.x + (o.dx || 0),
      y: o.y + (o.dy || 0),
      align: 'start',
      italic: true,
    };
  const dx = o.labelDx || 0,
    dy = o.labelDy || 0;
  if (o.type === 'eye')
    return {
      text: o.label ?? 'observer',
      size: o.fontSize || 20,
      dx,
      dy,
      x: o.x + dx,
      y: o.y - o.size / 2 - 14 + dy,
      align: 'middle',
    };
  const m = midpoint(o),
    v = o.orientation === 'vertical';
  return {
    text: o.hideLabel ? '' : measureValue(o),
    size: o.fontSize || 19,
    dx,
    dy,
    x: m.x + (v ? 14 : 0) + dx,
    y: m.y + (v ? 6 : -13) + dy,
    align: v ? 'start' : 'middle',
  };
}
function attachedSVG(o, key, interactive) {
  const l = labelInfo(o, key);
  if (!l.text) return '';
  return `<g ${interactive ? `data-label="${key}" class="attached-label"` : ''}>${textAt(l, l.text, l.size, `fill="${esc(o.color)}" font-weight="${l.bold ? 'bold' : 'normal'}" font-style="${l.italic ? 'italic' : 'normal'}" text-anchor="${l.align || 'start'}" paint-order="stroke" stroke="white" stroke-width="3" stroke-linejoin="round"`)}</g>`;
}
function activeLabel() {
  const o = current();
  return o && selectedLabel?.id === o.id && attachedKeys(o).includes(selectedLabel.key)
    ? selectedLabel.key
    : null;
}
function labelEdit(o, key, prop, value) {
  if (o.scaleMarker && prop === 'text') {
    const parsed = parseScale(value);
    if (parsed) {
      doc.settings.scale = parsed.value / 5;
      doc.settings.unit = parsed.unit;
    }
    return;
  }
  if (o.labels) {
    o.labels[Number(key)][prop] = value;
    return;
  }
  if (prop === 'text') {
    if (o.type === 'measure') {
      o.auto = false;
      o.text = value;
      o.hideLabel = false;
    } else o.label = value;
  } else if (prop === 'size') o.fontSize = value;
  else if (o.type === 'point') o[prop] = value;
  else o[prop === 'dx' ? 'labelDx' : 'labelDy'] = value;
}
function deleteLabel() {
  const o = current(),
    key = activeLabel();
  if (key === null) return;
  change(() => {
    if (o.type === 'measure') o.hideLabel = true;
    else labelEdit(o, key, 'text', '');
    selectedLabel = null;
  });
}
function renderLabelProperties(o, key) {
  const l = labelInfo(o, key);
  $('#selected-tag').textContent = 'LABEL';
  $('#properties').innerHTML =
    `<div class="selected-properties"><h3>Attached label</h3><p>Drag to move the label; drag its corner to resize. It follows its object when the object moves.</p>${field('Label text', 'attached.text', l.text, 'text', 'maxlength="100"')}${field('Font size (px)', 'attached.size', l.size, 'number', 'min="8" max="200"')}<div class="form-row">${field('Offset X (px)', 'attached.dx', l.dx)}${field('Offset Y (px)', 'attached.dy', l.dy)}</div><div class="small-actions"><button data-action="select-parent">Select object</button><button data-action="delete-label">Delete label</button></div></div>`;
}
function bounds(o) {
  if (o.nodes) {
    const [a, b] = points(o);
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  }
  const size = o.type === 'eye' ? o.size : o.type === 'point' ? o.size * 3 : o.fontSize,
    w =
      o.type === 'label'
        ? Math.max(
            24,
            ...String(o.text || '')
              .split('\n')
              .map((row) => row.length * size * 0.57),
          )
        : o.type === 'eye'
          ? size * 0.5
          : size,
    h = o.type === 'label' ? size * 1.25 * String(o.text || '').split('\n').length : size;
  return {
    x:
      o.x -
      (o.type === 'label' ? (o.align === 'middle' ? w / 2 : o.align === 'end' ? w : 0) : w / 2),
    y: o.y - (o.type === 'label' ? size : h / 2),
    w,
    h,
  };
}
function bigScale() {
  return Number((doc.settings.scale * 5).toPrecision(12));
}
function parseScale(text) {
  const match = String(text)
    .trim()
    .match(/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|m)?$/i);
  const value = match ? Number(match[1]) : NaN;
  return value >= 0.000005 && value <= 500000
    ? { value, unit: match[2]?.toLowerCase() || doc.settings.unit }
    : null;
}
function ensureScaleMarkers(restore = false) {
  if (!doc.settings.markers || (doc.settings.scaleMarkersInitialized && !restore)) return;
  doc.settings.scaleMarkersInitialized = true;
  const x = STEP;
  const y = STEP * 2;
  for (const orientation of ['horizontal', 'vertical']) {
    if (doc.objects.some((o) => o.scaleMarker && o.orientation === orientation)) continue;
    const o = make(
      'measure',
      { x, y },
      {
        x: x + (orientation === 'horizontal' ? BIG : 0),
        y: y + (orientation === 'vertical' ? BIG : 0),
      },
    );
    Object.assign(o, { scaleMarker: true, color: '#70837b', orientation });
  }
}
function renderScene() {
  ensureScaleMarkers();
  updateOptics();
  $('#clear-all-btn').disabled = doc.objects.length === 0 && !drawing;
  const nw = doc.settings.columns * BIG,
    nh = doc.settings.rows * BIG,
    changed = W !== nw || H !== nh;
  W = nw;
  H = nh;
  for (const el of [$('.paper'), $('#grid-layer')]) {
    el.setAttribute('width', W);
    el.setAttribute('height', H);
  }
  $('#grid-border').setAttribute('width', W);
  $('#grid-border').setAttribute('height', H);
  if (changed) requestAnimationFrame(fit);
  $('#objects-layer').innerHTML = doc.objects.map((o) => objectSVG(o, true)).join('');
  $('#grid-layer').style.display = doc.settings.grid ? '' : 'none';
  renderSelection();
  renderPreview();
  $('#scale-summary').textContent = `1 big square = ${bigScale()} ${doc.settings.unit}`;
  $('#object-count').textContent =
    `${doc.objects.length} object${doc.objects.length === 1 ? '' : 's'}`;
}
function renderSelection() {
  const o = current(),
    layer = $('#selection-layer');
  if (!o) {
    layer.innerHTML = '';
    return;
  }
  const lk = activeLabel();
  if (lk !== null) {
    const l = labelInfo(o, lk),
      w = Math.max(12, l.text.length * l.size * 0.57),
      x = l.x - (l.align === 'middle' ? w / 2 : l.align === 'end' ? w : 0);
    const rad = 6 / view.k;
    layer.innerHTML = `<rect class="selected-outline" x="${x - 5}" y="${l.y - l.size - 5}" width="${w + 10}" height="${l.size * 1.3 + 10}"/><rect class="handle" data-handle="label-resize" x="${x + w + 5 - rad}" y="${l.y + l.size * 0.3 + 5 - rad}" width="${rad * 2}" height="${rad * 2}"/>`;
    return;
  }
  const b = bounds(o),
    c = midpoint(o),
    rad = 6 / view.k;
  let out = `<rect class="selected-outline" x="${b.x - 10}" y="${b.y - 10}" width="${b.w + 20}" height="${b.h + 20}"/>`;
  if (opticalDerived(o) || o.scaleMarker) {
    layer.innerHTML = o._opticsHidden ? '' : out;
    return;
  }
  if (o.nodes) {
    points(o).forEach((p, i) => {
      const connected = doc.objects.filter((v) => v.nodes?.includes(o.nodes[i])).length > 1;
      out += `<circle class="handle ${connected ? 'junction' : ''}" data-handle="endpoint" data-index="${i}" cx="${p.x}" cy="${p.y}" r="${rad}"/>`;
    });
  } else {
    out += `<rect class="handle" data-handle="resize" x="${b.x + b.w - rad}" y="${b.y + b.h - rad}" width="${rad * 2}" height="${rad * 2}"/>`;
  }
  if (o.type !== 'point') {
    const y = b.y - 32 / view.k,
      x = c.x + (o.type === 'eye' ? o.size / 2 + 20 : 0);
    out +=
      line(
        { x, y: b.y - 10 },
        { x, y },
        `stroke="#538f83" stroke-width="1" pointer-events="none"`,
      ) + `<circle class="rotate-handle" data-handle="rotate" cx="${x}" cy="${y}" r="${rad}"/>`;
  }
  layer.innerHTML =
    o.type === 'label' ? `<g transform="rotate(${o.angle || 0} ${o.x} ${o.y})">${out}</g>` : out;
}
function renderPreview() {
  if (!drawing || !hover) {
    $('#preview-layer').innerHTML = '';
    return;
  }
  const p = doc.nodes[drawing.node] || drawing.start,
    q = constrainPoint(tool, p, hover);
  $('#preview-layer').innerHTML =
    line(p, q, 'stroke="#d77741" stroke-width="2" stroke-dasharray="6 5" pointer-events="none"') +
    `<circle cx="${q.x}" cy="${q.y}" r="5" fill="#d77741" pointer-events="none"/>`;
}
function objectTypeName(o) {
  if (o.scaleMarker)
    return `${o.orientation === 'vertical' ? 'Vertical' : 'Horizontal'} scale arrow`;
  return o.type === 'point' && ['dot', 'dash'].includes(o.marker)
    ? o.marker === 'dot'
      ? 'Dot'
      : 'Dash'
    : TOOLS.find((t) => t[0] === o.type)?.[1] || o.type;
}
function objectName(o) {
  const name = objectTypeName(o);
  return o.type === 'label'
    ? o.text
    : o.labels?.some((l) => l.text)
      ? `${name} · ${o.labels.map((l) => l.text).join('–')}`
      : o.type === 'point' && o.label
        ? `${name} · ${o.label}`
        : name;
}
function renderLayers() {
  $('#layers').innerHTML =
    [...doc.objects]
      .reverse()
      .map(
        (o) =>
          `<button class="layer ${o.id === selected ? 'selected' : ''}" data-select="${o.id}" title="Select ${esc(objectName(o))}">${icon(o.type)}<span class="layer-name">${esc(objectName(o))}</span><small>${o.id === selected ? '●' : ''}</small></button>`,
      )
      .join('') || '<p>Your next idea starts here.</p>';
  $('#layer-count').textContent = doc.objects.length;
}
function field(label, key, value, type = 'number', extra = '') {
  return `<label class="field">${label}<input data-prop="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function selectField(label, key, value, opts) {
  return `<label class="field">${label}<select data-prop="${key}">${opts.map(([v, t]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
}
function check(label, key, value) {
  return `<label class="check-row"><input type="checkbox" data-prop="${key}" ${value ? 'checked' : ''}>${label}</label>`;
}
let inspectorTarget = null;
function renderProperties() {
  const item = current(),
    target = item ? `${item.id}:${activeLabel() ?? 'object'}` : null;
  const expanded =
    target === inspectorTarget
      ? new Set(
          $$('#properties details')
            .filter((el) => el.open)
            .map((el) => el.querySelector('summary').textContent),
        )
      : new Set();
  $('.inspector').classList.toggle('editing', !!item);
  $('.grid-settings').hidden = !!item;
  $('.layers-section').hidden = !!item;
  $('#properties-home').hidden = !item;
  $('#properties').hidden = !item;
  $('.layer-actions').hidden = !item || activeLabel() !== null;
  if (target !== inspectorTarget) {
    $('.inspector').scrollTop = 0;
    inspectorTarget = target;
  }
  const o = current();
  $('#selected-tag').textContent = o ? o.type.toUpperCase() : 'CANVAS';
  if (!o) {
    $('#properties').innerHTML =
      `<div class="empty-properties"><div class="empty-icon">${icon('select')}</div><h3>A space to explore.</h3><p>Select an element to fine-tune its geometry, labels, and appearance.</p><div class="small-actions"><button id="canvas-help">Drawing guide ↗</button></div></div>`;
    return;
  }
  if (activeLabel() !== null) {
    renderLabelProperties(o, activeLabel());
    return;
  }
  let out = `<div class="selected-properties"><h3>${esc(objectTypeName(o))}</h3>`;
  if (opticalItems().includes(o.id))
    out +=
      check('Live reflection', 'liveReflection', doc.optics.enabled) +
      `<p class="properties-note">Move the observer, object, or mirror to recalculate the image and rays. The observer stays on the object’s side. Turn this off to edit calculated geometry manually.${doc.optics.enabled && doc.optics.visibleEndpoints < 2 ? ' Rays that miss the reflective face of the mirror are hidden.' : ''}</p>`;
  if (o.nodes) {
    const [a, b] = points(o);
    out += `<div class="form-row">${field('Length (squares)', 'length', round(Math.hypot(b.x - a.x, b.y - a.y) / STEP), 'number', 'min="0.1" max="40" step="any"')}${field('Angle (°)', 'angle', round(angle(o)), 'number', 'step="any"')}</div>`;
    out += `<details class="property-section"><summary>Endpoint coordinates · squares</summary><div class="form-row">${field('Start X', 'x1', round(a.x / STEP))}${field('Start Y', 'y1', round(a.y / STEP))}</div><div class="form-row">${field('End X', 'x2', round(b.x / STEP))}${field('End Y', 'y2', round(b.y / STEP))}</div></details>`;
  } else {
    out += `<div class="form-row">${field('X (squares)', 'x', round(o.x / STEP), 'number', 'step="0.25"')}${field('Y (squares)', 'y', round(o.y / STEP), 'number', 'step="0.25"')}</div>`;
    if (o.type !== 'point')
      out += field('Rotation (°)', 'angle', round(o.angle || 0), 'number', 'step="5"');
  }
  out += `<div class="property-section"><h4>Appearance</h4><div class="form-row">${field('Colour', 'color', o.color, 'color')}${field('Thickness (px)', 'width', o.width, 'number', 'min="0.5" max="16" step="any"')}</div>`;
  if (o.nodes && o.type !== 'mirror')
    out += selectField('Line style', 'style', o.style, [
      ['solid', 'Solid'],
      ['dashed', 'Dashed'],
      ['dotted', 'Dotted'],
    ]);
  if (o.type === 'mirror')
    out +=
      '<div class="small-actions"><button data-action="flip">⇄ Flip reflective side</button></div><p class="properties-note">Hatching marks the non-reflective side.</p>';
  if (o.type === 'ray') out += check('Reverse arrow direction', 'reverse', o.reverse);
  if (o.nodes && (o.type === 'ray' || connectionCount(o, 0) || connectionCount(o, 1))) {
    const start = connectionCount(o, 0),
      end = connectionCount(o, 1);
    out += `<div class="property-section"><h4>Endpoint connections</h4><p class="properties-note">Start: ${start ? `connected to ${start} other segment${start === 1 ? '' : 's'}` : 'independent'}<br>End: ${end ? `connected to ${end} other segment${end === 1 ? '' : 's'}` : 'independent'}</p><div class="small-actions"><button data-action="disconnect-start" ${start ? '' : 'disabled'}>Disconnect start</button><button data-action="disconnect-end" ${end ? '' : 'disabled'}>Disconnect end</button></div>${start && end ? '<div class="small-actions"><button data-action="disconnect-all">Disconnect both endpoints</button></div>' : ''}<p class="properties-note">Disconnect keeps this segment in place. Drag it or its endpoint away to separate it. Other segments stay connected to one another.</p></div>`;
  }
  if (o.type === 'wall') out += check('Arrowhead at start', 'head', o.head);
  if (o.type === 'eye')
    out +=
      field('Name above eye', 'label', o.label ?? 'observer', 'text', 'maxlength="100"') +
      field('Name font size', 'fontSize', o.fontSize || 20, 'number', 'min="8" max="200"') +
      field('Size (px)', 'size', o.size, 'number', 'min="20" max="300" step="4"') +
      '<div class="small-actions"><button data-action="flip">⇄ Flip observer</button></div>';
  if (o.type === 'label')
    out +=
      `<label class="field">Text<textarea data-prop="text" rows="4" maxlength="500">${esc(o.text)}</textarea></label>` +
      field('Font size (px)', 'fontSize', o.fontSize, 'number', 'min="8" max="200"') +
      `<div class="form-row">${check('Bold', 'bold', o.bold)}${check('Italic', 'italic', o.italic)}</div>` +
      selectField('Alignment', 'align', o.align, [
        ['start', 'Left'],
        ['middle', 'Centre'],
        ['end', 'Right'],
      ]);
  if (o.type === 'point')
    out +=
      selectField('Marker', 'marker', o.marker, [
        ['dot', 'Filled dot'],
        ['dash', 'Dash'],
        ['cross', 'Cross'],
        ['circle', 'Open circle'],
      ]) +
      field(
        o.marker === 'dash' ? 'Half-length (px)' : 'Marker size (px)',
        'size',
        o.size,
        'number',
        'min="2" max="30"',
      ) +
      field('Optional label', 'label', o.label, 'text') +
      field('Label font size', 'fontSize', o.fontSize, 'number', 'min="8" max="200"') +
      `<div class="form-row">${field('Label offset X', 'dx', o.dx)}${field('Label offset Y', 'dy', o.dy)}</div>`;
  if (o.scaleMarker)
    out += `<p>Scale arrow: one big square. Drag the arrow to move it, or select its label to edit the shared Grid Scale.</p>${field('1 big square equals', 'scaleValue', bigScale(), 'number', 'min="0.000005" max="500000" step="any"')}${selectField(
      'Unit',
      'scaleUnit',
      doc.settings.unit,
      [
        ['m', 'm'],
        ['cm', 'cm'],
        ['mm', 'mm'],
      ],
    )}${field('Font size (px)', 'fontSize', o.fontSize, 'number', 'min="8" max="200"')}`;
  if (o.type === 'measure' && !o.scaleMarker)
    out +=
      selectField('Orientation', 'orientation', o.orientation, [
        ['horizontal', 'Horizontal'],
        ['vertical', 'Vertical'],
      ]) +
      check('Show measurement label', 'showMeasurement', !o.hideLabel) +
      check('Calculate from Grid Scale', 'auto', o.auto) +
      field('Measurement text', 'text', measureValue(o), 'text', o.auto ? 'disabled' : '') +
      field('Font size (px)', 'fontSize', o.fontSize, 'number', 'min="8" max="200"');
  out += '</div>';
  if (o.labels) {
    out += '<div class="property-section"><h4>Attached endpoint labels</h4>';
    o.labels.forEach((l, i) => {
      out +=
        field(
          i === 0 ? 'Start label' : 'End label',
          `label.${i}.text`,
          l.text,
          'text',
          'maxlength="100"',
        ) +
        `<details><summary>${i === 0 ? 'Start' : 'End'} label position & style</summary><div class="form-row">${field('Offset X (px)', `label.${i}.dx`, l.dx)}${field('Offset Y (px)', `label.${i}.dy`, l.dy)}</div>${field('Font size (px)', `label.${i}.size`, l.size, 'number', 'min="8" max="200"')}<div class="form-row">${check('Bold', `label.${i}.bold`, l.bold)}${check('Italic', `label.${i}.italic`, l.italic)}</div>${selectField(
          'Alignment',
          `label.${i}.align`,
          l.align || 'start',
          [
            ['start', 'Left'],
            ['middle', 'Centre'],
            ['end', 'Right'],
          ],
        )}</details>`;
    });
    out += '</div>';
  }
  if (attachedKeys(o).length)
    out +=
      '<p class="properties-note">Click any attached label to drag it, edit it, or delete it.</p>';
  out +=
    '<div class="small-actions"><button data-action="duplicate">⧉ Duplicate</button><button data-action="delete">Delete</button></div></div>';
  $('#properties').innerHTML = out;
  $$('#properties details').forEach((el) => {
    el.open = expanded.has(el.querySelector('summary').textContent);
  });
  if (opticalDerived(o) || o.scaleMarker)
    for (const key of [
      'length',
      'angle',
      'x1',
      'y1',
      'x2',
      'y2',
      'orientation',
      'reverse',
      'head',
    ]) {
      const input = $(`#properties [data-prop="${key}"]`);
      if (input) input.disabled = true;
    }
}
function render() {
  renderScene();
  renderProperties();
  renderLayers();
  $('#undo-btn').disabled = !past.length;
  $('#redo-btn').disabled = !future.length;
  for (const id of ['duplicate-btn', 'delete-btn', 'back-btn', 'forward-btn'])
    $('#' + id).disabled = !current();
  $('#project-name').value = doc.name;
  $('#canvas-title').textContent = doc.name.toUpperCase();
  $('#grid-rows').value = doc.settings.rows;
  $('#grid-columns').value = doc.settings.columns;
  $('#grid-size-summary').textContent =
    `${doc.settings.rows} rows × ${doc.settings.columns} columns · 5 × 5 subdivisions`;
  $('#grid-scale').value = bigScale();
  $('#grid-unit').value = doc.settings.unit;
  $('#show-grid').checked = doc.settings.grid;
  $('#show-markers').checked = doc.settings.markers;
  $('#snap-grid').checked = doc.settings.snapGrid;
  $('#snap-objects').checked = doc.settings.snapObjects;
  updateHint();
}
function updateHint() {
  const hints = {
    select: 'Select an object to edit. Space + drag to pan.',
    pan: 'Drag the page to pan. Scroll to zoom.',
    ray: drawing
      ? 'Click for the next segment. Enter finishes · Escape cancels preview.'
      : 'Click a start point, then add connected segments. Enter to finish.',
    label: 'Click the grid to add text. Edit it in Properties.',
    eye: 'Click to place an observer. Use its handles to resize and rotate.',
    point: 'Click to place a marker. Add a label in Properties.',
  };
  $('#tool-hint').textContent =
    hints[tool] ||
    (drawing
      ? 'Click to place the endpoint. Escape cancels.'
      : 'Click a start and end point, or drag to draw.');
  svg.style.cursor = space || tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
}
function setTool(t) {
  selectedLabel = null;
  cancelDraw();
  tool = t;
  $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  if (t !== 'select') {
    selected = null;
    render();
  }
  updateHint();
}
function cancelDraw() {
  drawing = null;
  hover = null;
  $('#preview-layer').innerHTML = '';
  updateHint();
}
function fit() {
  const r = svg.getBoundingClientRect();
  view.k = Math.min((r.width - 54) / W, (r.height - 110) / H);
  view.k = clamp(view.k, 0.025, 3);
  view.x = (r.width - W * view.k) / 2;
  view.y = (r.height - H * view.k) / 2 + 8;
  updateView();
}
function updateView() {
  world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  $('#zoom-reset').textContent = `${Math.round(view.k * 100)}%`;
  renderSelection();
}
function zoom(f, c = null) {
  const r = svg.getBoundingClientRect();
  c = c || { x: r.width / 2, y: r.height / 2 };
  const n = clamp(view.k * f, 0.025, 5),
    q = n / view.k;
  view.x = c.x - (c.x - view.x) * q;
  view.y = c.y - (c.y - view.y) * q;
  view.k = n;
  updateView();
}
function worldPoint(e) {
  const r = svg.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
}
function snapped(p, exclude = []) {
  let q = { x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) },
    match = null;
  if (doc.settings.snapObjects) {
    let best = 13 / view.k;
    for (const [id, v] of Object.entries(doc.nodes)) {
      if (exclude.includes(id)) continue;
      const d = Math.hypot(v.x - q.x, v.y - q.y);
      if (d < best) {
        best = d;
        match = id;
      }
    }
    if (match) return { ...doc.nodes[match], match };
  }
  if (doc.settings.snapGrid) {
    q.x = Math.round(q.x / STEP) * STEP;
    q.y = Math.round(q.y / STEP) * STEP;
  }
  return { ...q, match };
}
function constrainPoint(type, p, q, orientation = null) {
  q = { ...q };
  if (type === 'measure') {
    const hor = orientation
      ? orientation === 'horizontal'
      : Math.abs(q.x - p.x) >= Math.abs(q.y - p.y);
    if (hor) q.y = p.y;
    else q.x = p.x;
  }
  return q;
}
function rayNode(p) {
  if (p.match && doc.objects.some((o) => o.type === 'ray' && o.nodes.includes(p.match)))
    return p.match;
  return null;
}
function addDefault(type, p) {
  const before = snapshot();
  let q;
  if (LINE_TYPES.includes(type)) {
    const vertical = ['mirror', 'wall', 'arrow'].includes(type);
    if (vertical) {
      p.y = clamp(p.y - 100, 0, H - 200);
      q = { x: p.x, y: p.y + 200 };
    } else {
      p.x = clamp(p.x - 80, 0, W - 160);
      q = { x: p.x + 160, y: p.y };
    }
  }
  const o = make(type, p, q);
  selected = o.id;
  tool = 'select';
  $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  commit(before);
  return o;
}
function startDraw(p, e) {
  drawing = {
    start: { x: p.x, y: p.y },
    node: tool === 'ray' ? rayNode(p) : null,
    screen: { x: e.clientX, y: e.clientY },
    waiting: true,
  };
  hover = p;
  renderPreview();
  updateHint();
}
function finishSegment(q) {
  if (!drawing) return;
  const p = doc.nodes[drawing.node] || drawing.start;
  q = constrainPoint(tool, p, q);
  if (Math.hypot(q.x - p.x, q.y - p.y) < 2) return;
  const before = snapshot(),
    isRay = tool === 'ray',
    startId = isRay ? drawing.node : null,
    endId = isRay ? rayNode(q) : null;
  const o = make(tool, p, q, isRay ? [startId, endId] : null);
  selected = o.id;
  if (isRay) {
    drawing = { start: { x: q.x, y: q.y }, node: o.nodes[1], waiting: false };
    hover = q;
  } else {
    drawing = null;
    tool = 'select';
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  }
  commit(before);
}
function changeProperty(key, val) {
  const o = current();
  if (!o) return;
  if (o.scaleMarker && key === 'attached.text' && !parseScale(val)) {
    toast('Enter a positive scale, such as 0.751 m.');
    renderProperties();
    return;
  }
  change(() => {
    if (o.scaleMarker && key === 'scaleValue') {
      doc.settings.scale = val / 5;
      return;
    }
    if (o.scaleMarker && key === 'scaleUnit') {
      doc.settings.unit = val;
      return;
    }
    if (key === 'liveReflection') {
      doc.optics.enabled = val;
      return;
    }
    if (key.startsWith('attached.')) {
      labelEdit(o, activeLabel(), key.split('.')[1], val);
      return;
    }
    if (key === 'showMeasurement') {
      o.hideLabel = !val;
      return;
    }
    if (key.startsWith('label.')) {
      const [, i, k] = key.split('.');
      o.labels[i][k] = val;
      return;
    }
    if (['x1', 'y1', 'x2', 'y2'].includes(key)) {
      const i = Number(key[1]) - 1,
        k = key[0],
        p = doc.nodes[o.nodes[i]];
      p[k] = val * STEP;
      if (o.type === 'measure') {
        const other = doc.nodes[o.nodes[1 - i]];
        if (o.orientation === 'horizontal' && k === 'y') other.y = p.y;
        if (o.orientation === 'vertical' && k === 'x') other.x = p.x;
      }
      return;
    }
    if (key === 'length' || (key === 'angle' && o.nodes)) {
      const [a, b] = points(o),
        c = midpoint(o),
        r = ((key === 'angle' ? val : angle(o)) * Math.PI) / 180,
        l = key === 'length' ? clamp(val, 0.1, 40) * STEP : Math.hypot(b.x - a.x, b.y - a.y);
      a.x = c.x - (Math.cos(r) * l) / 2;
      a.y = c.y - (Math.sin(r) * l) / 2;
      b.x = c.x + (Math.cos(r) * l) / 2;
      b.y = c.y + (Math.sin(r) * l) / 2;
      if (o.type === 'measure') {
        o.orientation = Math.abs(Math.cos(r)) >= Math.abs(Math.sin(r)) ? 'horizontal' : 'vertical';
        if (o.orientation === 'horizontal') {
          a.y = b.y = c.y;
          a.x = c.x - l / 2;
          b.x = c.x + l / 2;
        } else {
          a.x = b.x = c.x;
          a.y = c.y - l / 2;
          b.y = c.y + l / 2;
        }
      }
      return;
    }
    if (key === 'orientation') {
      const [a, b] = points(o),
        len = Math.hypot(b.x - a.x, b.y - a.y);
      b.x = a.x + (val === 'horizontal' ? len : 0);
      b.y = a.y + (val === 'vertical' ? len : 0);
    }
    if (key === 'auto' && !val) o.text = measureValue(o);
    o[key] = ['x', 'y'].includes(key) ? val * STEP : val;
  });
}
function cleanup() {
  const used = new Set(doc.objects.flatMap((o) => o.nodes || []));
  for (const id of Object.keys(doc.nodes)) if (!used.has(id)) delete doc.nodes[id];
}
function connectionCount(o, index) {
  return doc.objects.filter((other) => other.id !== o.id && other.nodes?.includes(o.nodes[index]))
    .length;
}
function disconnectEndpoints(indices) {
  const o = current();
  if (!o?.nodes) return;
  const shared = indices.filter((i) => connectionCount(o, i) > 0);
  if (!shared.length) return;
  const live = doc.optics?.enabled && opticalItems().includes(o.id);
  change(() => {
    if (live) doc.optics.enabled = false;
    for (const i of shared) o.nodes[i] = node(doc.nodes[o.nodes[i]]);
    cleanup();
  });
  toast(
    live
      ? 'Disconnected. Live reflection is off so you can edit rays manually.'
      : shared.length === 2
        ? 'Both endpoints disconnected. Move this segment independently.'
        : 'Endpoint disconnected. Drag it away to separate the segments.',
  );
}
function remove() {
  if (activeLabel() !== null) {
    deleteLabel();
    return;
  }
  if (!current()) return;
  change(() => {
    doc.objects = doc.objects.filter((o) => o.id !== selected);
    selected = null;
    cleanup();
  });
}
function copy() {
  const o = current();
  if (!o) return;
  clipboard = {
    object: clone(o),
    nodes: Object.fromEntries((o.nodes || []).map((id) => [id, clone(doc.nodes[id])])),
  };
  toast('Copied. Ctrl/⌘ V to paste.');
}
function paste() {
  if (!clipboard) return;
  change(() => {
    const o = clone(clipboard.object);
    o.id = uid();
    if (o.nodes)
      o.nodes = o.nodes.map((id) =>
        node({ x: clipboard.nodes[id].x + 40, y: clipboard.nodes[id].y + 40 }),
      );
    else {
      o.x += 40;
      o.y += 40;
    }
    doc.objects.push(o);
    selected = o.id;
  });
}
function duplicate() {
  if (!current()) return;
  const old = clipboard;
  clipboard = {
    object: clone(current()),
    nodes: Object.fromEntries((current().nodes || []).map((id) => [id, clone(doc.nodes[id])])),
  };
  paste();
  clipboard = old;
}
function layerMove(n) {
  const i = doc.objects.findIndex((o) => o.id === selected);
  if (i < 0 || i + n < 0 || i + n >= doc.objects.length) return;
  change(() => {
    const [o] = doc.objects.splice(i, 1);
    doc.objects.splice(i + n, 0, o);
  });
}
function translate(o, dx, dy, source) {
  if (opticalDerived(o)) return;
  if (o.scaleMarker) {
    const a = source.nodes[o.nodes[0]];
    dx = Math.round((a.x + dx) / STEP) * STEP - a.x;
    dy = Math.round((a.y + dy) / STEP) * STEP - a.y;
  }
  if (o.nodes) {
    for (const id of new Set(o.nodes)) {
      doc.nodes[id].x = source.nodes[id].x + dx;
      doc.nodes[id].y = source.nodes[id].y + dy;
    }
  } else {
    const base = source.objects.find((v) => v.id === o.id);
    o.x = base.x + dx;
    o.y = base.y + dy;
  }
}
function onDown(e) {
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  svg.focus();
  const raw = worldPoint(e),
    p = snapped(raw);
  if (space || tool === 'pan' || e.button === 1) {
    gesture = { kind: 'pan', x: e.clientX, y: e.clientY, view: { ...view } };
    svg.setPointerCapture(e.pointerId);
    return;
  }
  const labelHit = e.target.closest('[data-label]');
  if (tool === 'select' && labelHit) {
    selected = labelHit.closest('[data-oid]').dataset.oid;
    selectedLabel = { id: selected, key: labelHit.dataset.label };
    gesture = {
      kind: 'label',
      before: snapshot(),
      start: raw,
      label: labelInfo(current(), selectedLabel.key),
    };
    render();
    svg.setPointerCapture(e.pointerId);
    return;
  }
  const handle = e.target.closest('[data-handle]');
  if (tool === 'select' && handle && current()) {
    const o = current(),
      c = midpoint(o);
    gesture = {
      kind: handle.dataset.handle,
      index: Number(handle.dataset.index),
      before: snapshot(),
      start: raw,
      center: c,
      startAngle: Math.atan2(raw.y - c.y, raw.x - c.x),
      baseAngle: angle(o),
      label: activeLabel() !== null ? labelInfo(o, activeLabel()) : null,
    };
    svg.setPointerCapture(e.pointerId);
    return;
  }
  if (tool === 'select') {
    selectedLabel = null;
    const hit = e.target.closest('[data-oid]');
    selected = hit?.dataset.oid || null;
    render();
    if (selected) {
      gesture = { kind: 'move', before: snapshot(), start: raw };
      svg.setPointerCapture(e.pointerId);
    }
    return;
  }
  if (raw.x < 0 || raw.x > W || raw.y < 0 || raw.y > H) return;
  if (!LINE_TYPES.includes(tool)) {
    addDefault(tool, p);
    return;
  }
  if (!drawing) {
    startDraw(p, e);
    svg.setPointerCapture(e.pointerId);
  } else {
    drawing.waiting = false;
    finishSegment(p);
  }
}
function onMove(e) {
  const raw = worldPoint(e);
  $('#coordinates').textContent = `x ${round(raw.x / STEP)} · y ${round(raw.y / STEP)}`;
  hover = snapped(raw);
  if (!gesture) {
    renderPreview();
    return;
  }
  if (gesture.kind === 'pan') {
    view.x = gesture.view.x + e.clientX - gesture.x;
    view.y = gesture.view.y + e.clientY - gesture.y;
    updateView();
    return;
  }
  const o = current();
  if (!o) return;
  if (gesture.kind === 'label') {
    labelEdit(o, activeLabel(), 'dx', round(gesture.label.dx + raw.x - gesture.start.x));
    labelEdit(o, activeLabel(), 'dy', round(gesture.label.dy + raw.y - gesture.start.y));
  }
  if (gesture.kind === 'label-resize' || (gesture.kind === 'resize' && o.type === 'label')) {
    const base = gesture.before.objects.find((v) => v.id === o.id);
    const anchor = gesture.label || base;
    const dx = gesture.start.x - anchor.x,
      dy = gesture.start.y - anchor.y;
    const ratio =
      ((raw.x - anchor.x) * dx + (raw.y - anchor.y) * dy) / Math.max(1, dx * dx + dy * dy);
    const size = clamp(Math.round((gesture.label?.size || base.fontSize) * ratio), 8, 200);
    if (gesture.label) labelEdit(o, activeLabel(), 'size', size);
    else o.fontSize = size;
  }
  if (gesture.kind === 'move') {
    let dx = raw.x - gesture.start.x,
      dy = raw.y - gesture.start.y;
    if (doc.settings.snapGrid || o.scaleMarker) {
      dx = Math.round(dx / STEP) * STEP;
      dy = Math.round(dy / STEP) * STEP;
    }
    translate(o, dx, dy, gesture.before);
  }
  if (gesture.kind === 'endpoint') {
    const id = o.nodes[gesture.index],
      p = snapped(raw, o.nodes),
      other = doc.nodes[o.nodes[1 - gesture.index]],
      q = constrainPoint(o.type, other, p, o.orientation);
    doc.nodes[id] = { x: q.x, y: q.y };
    gesture.join = o.type === 'ray' ? rayNode(q) : null;
  }
  if (gesture.kind === 'rotate') {
    let delta = Math.atan2(raw.y - gesture.center.y, raw.x - gesture.center.x) - gesture.startAngle;
    let deg = gesture.baseAngle + (delta * 180) / Math.PI;
    if (e.shiftKey || doc.settings.snapGrid) deg = Math.round(deg / 15) * 15;
    if (o.nodes) {
      const base = gesture.before.objects.find((v) => v.id === o.id),
        a = gesture.before.nodes[base.nodes[0]],
        b = gesture.before.nodes[base.nodes[1]],
        len = Math.hypot(b.x - a.x, b.y - a.y),
        r = ((o.type === 'measure' ? Math.round(deg / 90) * 90 : deg) * Math.PI) / 180,
        c = gesture.center;
      doc.nodes[o.nodes[0]] = {
        x: c.x - (Math.cos(r) * len) / 2,
        y: c.y - (Math.sin(r) * len) / 2,
      };
      doc.nodes[o.nodes[1]] = {
        x: c.x + (Math.cos(r) * len) / 2,
        y: c.y + (Math.sin(r) * len) / 2,
      };
      if (o.type === 'measure')
        o.orientation = Math.abs(Math.cos(r)) > 0.5 ? 'horizontal' : 'vertical';
    } else o.angle = round(deg);
  }
  if (gesture.kind === 'resize') {
    const base = gesture.before.objects.find((v) => v.id === o.id),
      delta = raw.x - gesture.start.x;
    if (o.type === 'eye') o.size = clamp(base.size + delta * 2, 20, 300);
    else if (o.type === 'point') o.size = clamp(base.size + delta * 0.3, 2, 30);
  }
  renderScene();
}
function onUp(e) {
  if (gesture) {
    const g = gesture;
    gesture = null;
    if (g.kind !== 'pan') {
      const o = current();
      if (g.kind === 'endpoint' && g.join && o) {
        const oldId = o.nodes[g.index];
        for (const item of doc.objects)
          if (item.type === 'ray') item.nodes = item.nodes.map((n) => (n === oldId ? g.join : n));
        cleanup();
      }
      commit(g.before);
      renderProperties();
    }
    return;
  }
  if (drawing?.waiting && drawing.screen) {
    const d = Math.hypot(e.clientX - drawing.screen.x, e.clientY - drawing.screen.y);
    if (d > 6) {
      drawing.waiting = false;
      finishSegment(snapped(worldPoint(e)));
    } else drawing.waiting = false;
  }
}
svg.addEventListener('pointerdown', onDown);
svg.addEventListener('pointermove', onMove);
svg.addEventListener('pointerup', onUp);
svg.addEventListener('pointercancel', () => {
  if (gesture?.before) {
    doc = gesture.before;
    render();
  }
  gesture = null;
  cancelDraw();
});
svg.addEventListener('dblclick', (e) => {
  if (tool === 'ray') {
    e.preventDefault();
    cancelDraw();
    tool = 'select';
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    render();
  } else if (e.target.closest('[data-oid]')) {
    $('#properties [data-prop="text"]')?.focus();
  }
});
svg.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoom(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top });
  },
  { passive: false },
);
svg.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
svg.addEventListener('drop', (e) => {
  e.preventDefault();
  const t = e.dataTransfer.getData('application/x-ray-tool');
  if (TOOLS.some((v) => v[0] === t) && !['select', 'pan'].includes(t)) {
    cancelDraw();
    addDefault(t, snapped(worldPoint(e)));
  }
});
$('#tools').innerHTML = TOOLS.map(
  (t, i) =>
    `${i === 2 ? '<div class="tool-divider"></div>' : ''}<button class="tool ${t[0] === tool ? 'active' : ''}" data-tool="${t[0]}" draggable="${!['select', 'pan'].includes(t[0])}" title="${t[1]} — ${t[3]}" aria-label="${t[1]}">${icon(t[0])}<span>${t[1]}</span>${t[2] ? `<span class="tool-shortcut">${t[2]}</span>` : ''}</button>`,
).join('');
$$('.tool').forEach((b) => {
  b.addEventListener('click', () => setTool(b.dataset.tool));
  b.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('application/x-ray-tool', b.dataset.tool);
    e.dataTransfer.effectAllowed = 'copy';
  });
  b.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !['select', 'pan'].includes(b.dataset.tool)) {
      const end = (v) => {
        const r = svg.getBoundingClientRect();
        if (
          v.clientX >= r.left &&
          v.clientX <= r.right &&
          v.clientY >= r.top &&
          v.clientY <= r.bottom
        )
          addDefault(b.dataset.tool, snapped(worldPoint(v)));
        window.removeEventListener('pointerup', end);
      };
      window.addEventListener('pointerup', end, { once: true });
    }
  });
});
$('#properties').addEventListener('change', (e) => {
  const k = e.target.dataset.prop;
  if (!k) return;
  let v =
    e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.type === 'number'
        ? Number(e.target.value)
        : e.target.value;
  if (e.target.type === 'number' && (!Number.isFinite(v) || !e.target.checkValidity())) {
    toast('Enter a value within the allowed range.');
    renderProperties();
    return;
  }
  changeProperty(k, v);
});
$('#properties').addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'delete-label') deleteLabel();
  if (a === 'select-parent') {
    selectedLabel = null;
    render();
  }
  if (a === 'duplicate') duplicate();
  if (a === 'delete') remove();
  if (a === 'flip')
    change(() => {
      const o = current();
      if (o.type === 'mirror') o.side *= -1;
      else o.flip = !o.flip;
    });
  if (e.target.closest('#canvas-help')) $('#help-dialog').showModal();
});
$('#properties').addEventListener('click', (e) => {
  const button = e.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const indices = { 'disconnect-start': [0], 'disconnect-end': [1], 'disconnect-all': [0, 1] }[
    button.dataset.action
  ];
  if (indices) disconnectEndpoints(indices);
});
$('#layers').addEventListener('click', (e) => {
  const b = e.target.closest('[data-select]');
  if (b) {
    setTool('select');
    selected = b.dataset.select;
    render();
  }
});
$('#properties').after($('.layer-actions'));
$('#properties-home').onclick = () => {
  selected = null;
  selectedLabel = null;
  cancelDraw();
  render();
};
$('#undo-btn').onclick = undo;
$('#redo-btn').onclick = redo;
$('#duplicate-btn').onclick = duplicate;
$('#delete-btn').onclick = remove;
$('#back-btn').onclick = () => layerMove(-1);
$('#forward-btn').onclick = () => layerMove(1);
$('#clear-all-btn').onclick = () => {
  gesture = null;
  setTool('select');
  selected = null;
  selectedLabel = null;
  change(() => {
    doc.objects = [];
    doc.nodes = {};
  });
  render();
  toast('All items cleared. Undo restores your diagram.');
};
$('#fit-btn').onclick = fit;
$('#zoom-in').onclick = () => zoom(1.2);
$('#zoom-out').onclick = () => zoom(1 / 1.2);
$('#zoom-reset').onclick = () => zoom(1 / view.k);
$('#project-name').onchange = (e) =>
  change(() => {
    doc.name = e.target.value.trim().slice(0, 100) || 'Untitled diagram';
  });
for (const [id, key] of [
  ['snap-grid', 'snapGrid'],
  ['snap-objects', 'snapObjects'],
  ['show-grid', 'grid'],
  ['show-markers', 'markers'],
])
  $('#' + id).onchange = (e) =>
    change(() => {
      doc.settings[key] = e.target.checked;
      if (key === 'markers') {
        selected = null;
        selectedLabel = null;
        ensureScaleMarkers();
      }
    });
$('#restore-markers').onclick = () =>
  change(() => {
    doc.settings.markers = true;
    ensureScaleMarkers(true);
  });
$('#reset-marker-position').onclick = () =>
  change(() => {
    for (const o of doc.objects.filter((item) => item.scaleMarker)) {
      // Paper coordinates are independent of the viewport and previous grid size.
      doc.nodes[o.nodes[0]] = { x: STEP, y: STEP * 2 };
      doc.nodes[o.nodes[1]] = {
        x: STEP + (o.orientation === 'horizontal' ? BIG : 0),
        y: STEP * 2 + (o.orientation === 'vertical' ? BIG : 0),
      };
      o.labelDx = 0;
      o.labelDy = 0;
    }
  });
$('#apply-grid-size').onclick = () => {
  const rows = Number($('#grid-rows').value),
    columns = Number($('#grid-columns').value);
  if (![rows, columns].every((n) => Number.isInteger(n) && n >= 2 && n <= 30)) {
    toast('Enter whole numbers from 2 to 30 for rows and columns.');
    return;
  }
  if (rows === doc.settings.rows && columns === doc.settings.columns) return;
  cancelDraw();
  const box = $('#objects-layer').getBBox();
  change(() => {
    doc.settings.rows = rows;
    doc.settings.columns = columns;
    if (doc.objects.length) {
      const dx = (columns * BIG) / 2 - (box.x + box.width / 2),
        dy = (rows * BIG) / 2 - (box.y + box.height / 2);
      for (const p of Object.values(doc.nodes)) {
        p.x += dx;
        p.y += dy;
      }
      for (const o of doc.objects)
        if (!o.nodes) {
          o.x += dx;
          o.y += dy;
        }
      for (const p of Object.values(doc.optics?.captionAnchors || {})) {
        p.x += dx;
        p.y += dy;
      }
    }
  });
  fit();
  const outside = doc.objects.some((o) => {
    const b = bounds(o);
    return b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H;
  });
  toast(
    outside
      ? 'Diagram centered without resizing. Some objects exceed the smaller grid; enlarge it to reveal them.'
      : `Diagram centered. Grid: ${rows} rows × ${columns} columns.`,
  );
};
$('#grid-scale').onchange = (e) => {
  const n = Number(e.target.value);
  if (n >= 0.000005 && n <= 500000)
    change(() => {
      doc.settings.scale = n / 5;
    });
  else {
    e.target.value = bigScale();
    toast('Grid Scale must be greater than zero.');
  }
};
$('#grid-unit').onchange = (e) =>
  change(() => {
    doc.settings.unit = e.target.value;
  });
$('#new-btn').onclick = () => $('#new-dialog').showModal();
$('#confirm-new').onclick = () => {
  cancelDraw();
  change(() => {
    doc = blank();
    selected = null;
  });
  fit();
};
$('#example-btn').onclick = () => {
  cancelDraw();
  change(() => {
    example();
    selected = null;
  });
  fit();
  toast('Reflection example loaded. Undo to return to your previous diagram.');
};
$('#help-btn').onclick = () => $('#help-dialog').showModal();
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
const filename = () => doc.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'diagram';
$('#save-btn').onclick = () => {
  download(
    new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    filename() + '.ray.json',
  );
  toast('Editable project downloaded.');
};
if (recoveryProject) {
  const recovery = document.createElement('button');
  recovery.id = 'recovery-btn';
  recovery.textContent = 'Save recovery copy';
  recovery.title = 'Download the original autosaved data that could not be opened';
  recovery.onclick = () =>
    download(
      new Blob([recoveryProject], { type: 'application/json' }),
      'recovered-original.ray.json',
    );
  $('.file-actions').prepend(recovery);
}
$('#open-btn').onclick = () => $('#open-file').click();
$('#open-file').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 5e6) throw Error('Project files must be smaller than 5 MB.');
    const next = validProject(JSON.parse(await f.text()));
    cancelDraw();
    change(() => {
      doc = next;
      selected = null;
    });
    fit();
    toast('Project opened.');
  } catch (err) {
    toast(err.message || 'Unable to open this project.');
  }
  e.target.value = '';
};
document.addEventListener('keydown', (e) => {
  if (
    e.target.closest('input,textarea,select,[contenteditable="true"]') ||
    $$('dialog[open]').length
  )
    return;
  const mod = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (mod && ['z', 'y', 'c', 'v', 'd', 'x', 's'].includes(k)) {
    e.preventDefault();
    if (k === 'z') e.shiftKey ? redo() : undo();
    if (k === 'y') redo();
    if (k === 'c') copy();
    if (k === 'v') paste();
    if (k === 'd') duplicate();
    if (k === 'x') {
      copy();
      remove();
    }
    if (k === 's') $('#save-btn').click();
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    space = true;
    updateHint();
    return;
  }
  if (k === 'escape') {
    cancelDraw();
    setTool('select');
    selected = null;
    render();
  }
  if (k === 'enter' && drawing) {
    e.preventDefault();
    cancelDraw();
    tool = 'select';
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    render();
  }
  if (k === 'delete' || k === 'backspace') {
    e.preventDefault();
    remove();
  }
  if (['v', 'h', 'r', 't'].includes(k)) setTool({ v: 'select', h: 'pan', r: 'ray', t: 'label' }[k]);
  if (k === '0') fit();
  if (k === '+' || k === '=') zoom(1.2);
  if (k === '-') zoom(1 / 1.2);
  if (e.key.startsWith('Arrow') && current()) {
    e.preventDefault();
    const d = (doc.settings.snapGrid ? STEP : 1) * (e.shiftKey ? 5 : 1),
      dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0,
      dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    const before = snapshot();
    if (activeLabel() !== null) {
      const o = current(),
        key = activeLabel(),
        l = labelInfo(o, key);
      labelEdit(o, key, 'dx', l.dx + dx);
      labelEdit(o, key, 'dy', l.dy + dy);
    } else translate(current(), dx, dy, before);
    commit(before);
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    space = false;
    updateHint();
  }
});
window.addEventListener('blur', () => {
  space = false;
  updateHint();
});
function exportSVG(includeGrid = true, includeScale = true) {
  const defs = svg.querySelector('defs').outerHTML;
  return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(doc.name)}</title>${defs}<rect width="${W}" height="${H}" fill="white"/>${includeGrid ? `<rect width="${W}" height="${H}" fill="url(#major-grid)"/>` : ''}${doc.objects.map((o) => objectSVG(o, false)).join('')}${includeScale ? `<rect x="20" y="${H - 40}" width="280" height="27" rx="4" fill="white"/>${textAt({ x: 30, y: H - 21 }, `1 big square = ${bigScale()} ${doc.settings.unit}`, 14, 'fill="#536d60"')}` : ''}</svg>`;
}
async function raster(source) {
  const image = new Image(),
    url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    await new Promise((ok, no) => {
      image.onload = ok;
      image.onerror = () => no(Error('Unable to render the image.'));
      image.src = url;
    });
    const c = document.createElement('canvas');
    const factor = Math.min(2, 4000 / Math.max(W, H));
    c.width = Math.round(W * factor);
    c.height = Math.round(H * factor);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(image, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function pdfFromCanvas(canvas) {
  const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.97).split(',')[1]), (c) =>
      c.charCodeAt(0),
    ),
    enc = new TextEncoder(),
    chunks = [],
    offsets = [0];
  let length = 0;
  const push = (v) => {
    const b = typeof v === 'string' ? enc.encode(v) : v;
    chunks.push(b);
    length += b.length;
  };
  const obj = (n, s) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${s}\nendobj\n`);
  };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  const pw = (750 * canvas.width) / Math.max(canvas.width, canvas.height),
    ph = (750 * canvas.height) / Math.max(canvas.width, canvas.height);
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets[4] = length;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push('\nendstream\nendobj\n');
  const stream = `q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(5, `<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
  const start = length;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}
$('#export-btn').onclick = () => {
  const factor = Math.min(2, 4000 / Math.max(W, H));
  $('#png-dimensions').textContent = `${Math.round(W * factor)} × ${Math.round(H * factor)} px`;
  $('#export-grid').checked = doc.settings.grid;
  $('#export-status').textContent = '';
  $('#export-dialog').showModal();
};
$$('[data-export]').forEach(
  (b) =>
    (b.onclick = async () => {
      const format = b.dataset.export;
      $('#export-status').textContent = 'Preparing your diagram…';
      try {
        const source = exportSVG($('#export-grid').checked, $('#export-scale').checked);
        let blob;
        if (format === 'svg') blob = new Blob([source], { type: 'image/svg+xml' });
        else {
          const canvas = await raster(source);
          blob =
            format === 'pdf'
              ? pdfFromCanvas(canvas)
              : await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        }
        if (!blob) throw Error('Export failed.');
        download(blob, filename() + '.' + format);
        $('#export-status').textContent = `${format.toUpperCase()} downloaded. Ready to share.`;
      } catch (err) {
        $('#export-status').textContent = err.message;
      }
    }),
);
$('#print-btn').onclick = () => {
  const el = new DOMParser().parseFromString(
    exportSVG($('#export-grid').checked, $('#export-scale').checked),
    'image/svg+xml',
  ).documentElement;
  el.classList.add('print-sheet');
  const landscape = W >= H,
    factor = Math.min((landscape ? 277 : 190) / W, (landscape ? 190 : 277) / H),
    style = document.createElement('style');
  style.media = 'print';
  style.textContent = `@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:10mm}body>svg.print-sheet{width:${W * factor}mm!important;height:${H * factor}mm!important}`;
  document.head.append(style);
  document.body.append(el);
  $('#export-dialog').close();
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      el.remove();
      style.remove();
    }, 1000);
  }, 100);
};
new ResizeObserver(() => {
  if (!gesture) fit();
}).observe($('#canvas-container'));
render();
requestAnimationFrame(fit);
scheduleSave();
// Read-only inspection hooks used by the local browser regression suite.
window.rayStudio = { getProject: () => clone(doc), getView: () => ({ ...view }), exportSVG };
