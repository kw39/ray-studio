const { test } = require('node:test');
const assert = require('node:assert/strict');
const empty = () => ({ format: 'ray-studio', version: 1, name: 'Test', nodes: {}, objects: [] });
const arrow = () => ({
  ...empty(),
  nodes: { a: { x: 0, y: 0 }, b: { x: 0, y: 100 } },
  objects: [{ id: 'mirror1', type: 'mirror', nodes: ['a', 'b'], color: '#263b3e' }],
});
test('migrates old mirror labels and default grid settings', async () => {
  const { validateProject } = await import('../project-schema.mjs');
  const d = validateProject(arrow());
  assert.equal(d.settings.rows, 4);
  assert.equal(d.objects[0].labels[0].text, 'A');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(d))), d);
});
test('rejects missing, non-finite, and prototype-named endpoints', async () => {
  const { validateProject } = await import('../project-schema.mjs');
  const d = arrow();
  d.objects[0].nodes[1] = 'missing';
  assert.throws(() => validateProject(d), /endpoint/);
  const invalid = arrow();
  invalid.nodes.a.x = Infinity;
  assert.throws(() => validateProject(invalid), /coordinate/);
  const prototype = JSON.parse(
    '{"format":"ray-studio","version":1,"objects":[],"nodes":{"__proto__":{"x":0,"y":0}}}',
  );
  assert.throws(() => validateProject(prototype), /ID/);
});
test('normalizes attribute enums and strips unknown object fields', async () => {
  const { validateProject } = await import('../project-schema.mjs');
  const d = arrow();
  d.objects[0].labels = [0, 1].map(() => ({
    text: '<script>alert(1)</script>',
    dx: 0,
    dy: 0,
    size: 22,
    align: 'start" onload="alert(1)',
  }));
  d.objects[0].onclick = 'alert(1)';
  const o = validateProject(d).objects[0];
  assert.equal(o.labels[0].align, 'start');
  assert.ok(!('onclick' in o));
  assert.equal(o.labels[0].text, '<script>alert(1)</script>');
  d.objects[0].width = -3;
  assert.throws(() => validateProject(d), /thickness/);
});
test('rejects malformed optical anchors before changing the document', async () => {
  const { validateProject } = await import('../project-schema.mjs');
  const d = empty();
  d.optics = { enabled: true };
  assert.throws(() => validateProject(d), /reflection/);
  d.optics = {
    mirror: 'm',
    object: 'o',
    image: 'i',
    eye: 'e',
    eyeNode: 'n',
    branches: [0, 1].map(() => ({
      junction: 'j',
      incoming: 'in',
      reflected: 'out',
      extension: 'ext',
    })),
    measurements: [],
    captionAnchors: { m: { x: 'bad', y: 0 } },
  };
  assert.throws(() => validateProject(d), /coordinate/);
});
