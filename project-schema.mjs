// Project files are untrusted input. Rebuild the supported shape instead of
// carrying arbitrary JSON properties into SVG attributes or the live ray graph.
const lineTypes = ['mirror', 'arrow', 'ray', 'line', 'measure', 'wall'];
const types = [...lineTypes, 'label', 'point', 'eye'];
const record = (v) => v && typeof v === 'object' && !Array.isArray(v);
const identifier = (v) =>
  typeof v === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(v) &&
  !['__proto__', 'constructor', 'prototype'].includes(v);
const number = (v, min, max, label) => {
  if (!Number.isFinite(v) || v < min || v > max) throw Error(`Invalid ${label}.`);
  return v;
};
const text = (v, max, label) => {
  if (typeof v !== 'string' || v.length > max) throw Error(`Invalid ${label}.`);
  return v;
};
const choice = (v, values, fallback) => (values.includes(v) ? v : fallback);
const point = (p) => {
  if (!record(p)) throw Error('Invalid endpoint.');
  return {
    x: number(p.x, -100000, 100000, 'X coordinate'),
    y: number(p.y, -100000, 100000, 'Y coordinate'),
  };
};
const endpointLabel = (l) => {
  if (!record(l)) throw Error('Invalid endpoint label.');
  return {
    text: text(l.text, 500, 'label text'),
    dx: number(l.dx, -10000, 10000, 'label offset'),
    dy: number(l.dy, -10000, 10000, 'label offset'),
    size: number(l.size, 1, 200, 'font size'),
    bold: !!l.bold,
    italic: !!l.italic,
    align: choice(l.align, ['start', 'middle', 'end'], 'start'),
  };
};
export function validateProject(value) {
  if (
    !record(value) ||
    value.format !== 'ray-studio' ||
    value.version !== 1 ||
    !Array.isArray(value.objects) ||
    value.objects.length > 1500 ||
    !record(value.nodes) ||
    Object.keys(value.nodes).length > 6000
  )
    throw Error('This is not a supported Ray Studio project.');
  const nodes = {};
  for (const [id, p] of Object.entries(value.nodes)) {
    if (!identifier(id)) throw Error('Invalid endpoint ID.');
    nodes[id] = point(p);
  }
  const ids = new Set();
  const objects = value.objects.map((raw) => {
    if (!record(raw) || !identifier(raw.id) || ids.has(raw.id) || !types.includes(raw.type))
      throw Error('Invalid diagram element.');
    ids.add(raw.id);
    const o = {
      id: raw.id,
      type: raw.type,
      color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#263b3e',
      width: number(raw.width ?? 2.3, 0.1, 1000, 'line thickness'),
      style: choice(raw.style, ['solid', 'dashed', 'dotted'], 'solid'),
    };
    if (lineTypes.includes(o.type)) {
      if (
        !Array.isArray(raw.nodes) ||
        raw.nodes.length !== 2 ||
        raw.nodes.some((id) => !identifier(id) || !Object.hasOwn(nodes, id))
      )
        throw Error('A diagram endpoint is missing.');
      o.nodes = [...raw.nodes];
    } else {
      Object.assign(o, point(raw));
      o.angle = number(raw.angle ?? 0, -100000, 100000, 'rotation');
    }
    for (const k of ['size', 'fontSize', 'dx', 'dy', 'labelDx', 'labelDy'])
      if (raw[k] !== undefined)
        o[k] = number(
          raw[k],
          ['size', 'fontSize'].includes(k) ? 1 : -10000,
          k === 'fontSize' ? 200 : k === 'size' ? 1000 : 10000,
          k,
        );
    for (const k of ['text', 'label']) if (raw[k] !== undefined) o[k] = text(raw[k], 1000, k);
    for (const k of ['bold', 'italic', 'head', 'reverse', 'auto', 'hideLabel', 'flip'])
      if (raw[k] !== undefined) o[k] = !!raw[k];
    if (raw.align !== undefined) o.align = choice(raw.align, ['start', 'middle', 'end'], 'start');
    if (o.type === 'mirror') o.side = raw.side === -1 ? -1 : 1;
    if (o.type === 'measure') {
      if (raw.scaleMarker) o.scaleMarker = true;
      o.orientation = choice(raw.orientation, ['horizontal', 'vertical'], 'horizontal');
      o.fontSize ??= 19;
      o.text ??= '';
    }
    if (o.type === 'label') {
      o.text ??= '';
      o.fontSize ??= 24;
    }
    if (o.type === 'point') {
      o.marker = choice(raw.marker, ['dot', 'dash', 'circle', 'cross'], 'dot');
      o.size ??= 6;
      o.fontSize ??= 20;
      o.label ??= '';
    }
    if (o.type === 'eye') {
      o.size ??= 72;
      o.fontSize ??= 20;
      o.label ??= 'observer';
    }
    if (raw.labels !== undefined) {
      if (!o.nodes || !Array.isArray(raw.labels) || raw.labels.length !== 2)
        throw Error('Invalid endpoint labels.');
      o.labels = raw.labels.map(endpointLabel);
    } else if (o.type === 'mirror')
      o.labels = [
        { text: 'A', dx: 12, dy: -12, size: 22, italic: true },
        { text: 'B', dx: 12, dy: 22, size: 22, italic: true },
      ].map(endpointLabel);
    return o;
  });
  const s = record(value.settings) ? value.settings : {};
  const settings = {
    rows: s.rows ?? 4,
    columns: s.columns ?? 5,
    scale: number(s.scale ?? 0.5, 0.000001, 100000, 'Grid Scale'),
    unit: choice(s.unit, ['m', 'cm', 'mm'], 'm'),
  };
  if (![settings.rows, settings.columns].every((n) => Number.isInteger(n) && n >= 2 && n <= 30))
    throw Error('Grid rows and columns must be whole numbers from 2 to 30.');
  for (const [k, fallback] of Object.entries({
    grid: true,
    markers: false,
    scaleMarkersInitialized: false,
    snapGrid: true,
    snapObjects: true,
  }))
    settings[k] = s[k] === undefined ? fallback : !!s[k];
  const result = {
    format: 'ray-studio',
    version: 1,
    name: text(value.name ?? 'Untitled diagram', 100, 'diagram name'),
    settings,
    nodes,
    objects,
  };
  if (value.optics) {
    const m = value.optics;
    if (
      !record(m) ||
      !['mirror', 'object', 'image', 'eye', 'eyeNode'].every((k) => identifier(m[k])) ||
      !Array.isArray(m.branches) ||
      m.branches.length !== 2 ||
      !m.branches.every(
        (b) =>
          record(b) &&
          ['junction', 'incoming', 'reflected', 'extension'].every((k) => identifier(b[k])),
      ) ||
      !Array.isArray(m.measurements) ||
      m.measurements.length > 2 ||
      !m.measurements.every(identifier)
    )
      throw Error('Invalid live reflection configuration.');
    const optics = {
      enabled: !!m.enabled,
      mirror: m.mirror,
      object: m.object,
      image: m.image,
      eye: m.eye,
      eyeNode: m.eyeNode,
      measurements: [...m.measurements],
      branches: m.branches.map((b) => ({
        junction: b.junction,
        incoming: b.incoming,
        reflected: b.reflected,
        extension: b.extension,
      })),
      captionAnchors: {},
    };
    for (const k of ['objectCaption', 'imageCaption', 'mirrorCaption'])
      if (m[k] !== undefined) {
        if (!identifier(m[k])) throw Error('Invalid caption ID.');
        optics[k] = m[k];
      }
    if (m.captionAnchors !== undefined) {
      if (!record(m.captionAnchors)) throw Error('Invalid caption positions.');
      for (const [id, p] of Object.entries(m.captionAnchors)) {
        if (!identifier(id)) throw Error('Invalid caption ID.');
        optics.captionAnchors[id] = point(p);
      }
    }
    // Removing an optical component turns the remaining construction into a
    // manual diagram. Do not let imported metadata relink arbitrary item types.
    const byId = (id) => objects.find((o) => o.id === id);
    if (
      byId(m.mirror)?.type === 'mirror' &&
      byId(m.object)?.type === 'wall' &&
      byId(m.image)?.type === 'wall' &&
      byId(m.eye)?.type === 'eye' &&
      new Set([m.mirror, m.object, m.image, m.eye]).size === 4 &&
      m.branches.every(
        (b) =>
          byId(b.incoming)?.type === 'ray' &&
          byId(b.reflected)?.type === 'ray' &&
          byId(b.extension)?.type === 'line',
      ) &&
      m.measurements.every((id) => byId(id)?.type === 'measure')
    )
      result.optics = optics;
  }
  return result;
}
