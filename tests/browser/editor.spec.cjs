const { test, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const state = (page) => page.evaluate(() => window.rayStudio.getProject());
async function select(page, id) {
  if (await page.locator('#properties-home').isVisible())
    await page.locator('#properties-home').click();
  await page.locator(`[data-select="${id}"]`).click();
}
function physics(d) {
  const m = d.optics,
    by = (id) => d.objects.find((o) => o.id === id),
    pts = (o) => o.nodes.map((id) => d.nodes[id]),
    [a, b] = pts(by(m.mirror)),
    len = Math.hypot(b.x - a.x, b.y - a.y),
    n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len },
    dist = (p) => (p.x - a.x) * n.x + (p.y - a.y) * n.y,
    obj = pts(by(m.object)),
    img = pts(by(m.image));
  assert.ok(dist(by(m.eye)) * dist(obj[0]) > 0);
  for (let i = 0; i < 2; i++) {
    assert.ok(Math.abs(img[i].x - (obj[i].x - 2 * dist(obj[i]) * n.x)) < 1e-7);
    assert.ok(Math.abs(img[i].y - (obj[i].y - 2 * dist(obj[i]) * n.y)) < 1e-7);
    const j = d.nodes[m.branches[i].junction],
      e = d.nodes[m.eyeNode],
      v = img[i];
    assert.ok(Math.abs((e.x - j.x) * (v.y - j.y) - (e.y - j.y) * (v.x - j.x)) < 1e-7);
    const norm = (x, y) => {
        const l = Math.hypot(x, y);
        return { x: x / l, y: y / l };
      },
      inc = norm(j.x - obj[i].x, j.y - obj[i].y),
      out = norm(e.x - j.x, e.y - j.y),
      dot = inc.x * n.x + inc.y * n.y;
    assert.ok(Math.abs(out.x - (inc.x - 2 * dot * n.x)) < 1e-7);
    assert.ok(Math.abs(out.y - (inc.y - 2 * dot * n.y)) < 1e-7);
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.rayStudio);
});
test('scale markers reset to the paper corner after shrinking or enlarging the grid', async ({
  page,
}) => {
  await page.locator('#clear-all-btn').click();
  await page.locator('#show-markers').check();
  const checkCorner = async () => {
    const d = await state(page);
    for (const o of d.objects.filter((item) => item.scaleMarker)) {
      const [a, b] = o.nodes.map((id) => d.nodes[id]);
      expect(a).toEqual({ x: 0, y: 0 });
      expect(b).toEqual(o.orientation === 'horizontal' ? { x: 200, y: 0 } : { x: 0, y: 200 });
      expect(b.x).toBeLessThan(d.settings.columns * 200);
      expect(b.y).toBeLessThan(d.settings.rows * 200);
    }
  };
  await checkCorner();
  const exportFrame = await page.evaluate(() => {
    const svg = new DOMParser().parseFromString(
      window.rayStudio.exportSVG(),
      'image/svg+xml',
    ).documentElement;
    return svg.getAttribute('viewBox').split(' ').map(Number);
  });
  expect(exportFrame[0]).toBeLessThan(0);
  expect(exportFrame[1]).toBeLessThan(-54);
  await page.screenshot({ path: test.info().outputPath('exact-corner.png') });
  for (const [rows, columns] of [
    [2, 2],
    [12, 10],
    [3, 4],
  ]) {
    await page.locator('#grid-rows').fill(String(rows));
    await page.locator('#grid-columns').fill(String(columns));
    await page.locator('#apply-grid-size').click();
    const before = await state(page);
    await page.locator('#reset-marker-position').click();
    await checkCorner();
    expect((await state(page)).settings.scale).toBe(before.settings.scale);
    await page.keyboard.press('Control+z');
    expect((await state(page)).nodes).toEqual(before.nodes);
    await page.locator('#reset-marker-position').click();
  }
  const arrow = (await state(page)).objects.find((o) => o.scaleMarker);
  await select(page, arrow.id);
  await page.locator('[data-action="delete"]').click();
  await page.locator('#reset-marker-position').click();
  expect((await state(page)).objects.filter((o) => o.scaleMarker)).toHaveLength(1);
  await checkCorner();
  await page.screenshot({ path: test.info().outputPath('reset-marker-corner.png') });
});
test('editable big-square scale markers synchronize, align, and survive save/open', async ({
  page,
}) => {
  const original = await state(page);
  await expect(page.locator('#grid-scale')).toHaveValue(String(original.settings.scale * 5));
  await page.locator('#clear-all-btn').click();
  await page.locator('#show-markers').check();
  let d = await state(page);
  const arrows = d.objects.filter((o) => o.scaleMarker);
  expect(arrows).toHaveLength(2);
  for (const arrow of arrows) {
    const [a, b] = arrow.nodes.map((id) => d.nodes[id]);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBe(200);
    for (const p of [a, b]) {
      expect(p.x % 40).toBe(0);
      expect(p.y % 40).toBe(0);
    }
  }
  await page.locator('#grid-scale').fill('0.751');
  await page.locator('#grid-scale').press('Tab');
  for (const arrow of arrows)
    await expect(page.locator(`[data-oid="${arrow.id}"] [data-label]`)).toHaveText('0.751 m');
  const horizontal = arrows.find((o) => o.orientation === 'horizontal');
  await page.locator(`[data-oid="${horizontal.id}"] [data-label]`).click();
  await page.locator('[data-prop="attached.text"]').fill('1.25 cm');
  await page.locator('[data-prop="attached.text"]').press('Tab');
  await expect(page.locator('#grid-scale')).toHaveValue('1.25');
  await expect(page.locator('#grid-unit')).toHaveValue('cm');
  expect((await state(page)).settings.scale).toBe(0.25);
  await page.locator('[data-prop="attached.text"]').fill('invalid');
  await page.locator('[data-prop="attached.text"]').press('Tab');
  await expect(page.locator('[data-prop="attached.text"]')).toHaveValue('1.25 cm');
  await page.locator('[data-action="select-parent"]').click();
  await page.locator('[data-action="delete"]').click();
  expect((await state(page)).objects.filter((o) => o.scaleMarker)).toHaveLength(1);
  const download = page.waitForEvent('download');
  await page.locator('#save-btn').click();
  const saved = await download;
  await page.locator('#clear-all-btn').click();
  await page.locator('#open-file').setInputFiles(await saved.path());
  await expect
    .poll(async () => (await state(page)).objects.filter((o) => o.scaleMarker).length)
    .toBe(1);
  await page.locator('#show-markers').uncheck();
  await page.locator('#show-markers').check();
  expect((await state(page)).objects.filter((o) => o.scaleMarker)).toHaveLength(1);
  await page.locator('#restore-markers').click();
  expect((await state(page)).objects.filter((o) => o.scaleMarker)).toHaveLength(2);
  const exported = await page.evaluate(() => window.rayStudio.exportSVG(true, true));
  expect(exported).toContain('1 big square = 1.25 cm');
  expect(exported).not.toContain('1 small square =');
  await page.screenshot({ path: test.info().outputPath('scale-markers.png') });
});
test('grid-sized symbols, persistent sections, and draggable text sizing', async ({ page }) => {
  await page.locator('#clear-all-btn').click();
  const place = async (type, x, y) => {
    const tool = page.locator(`[data-tool="${type}"]`);
    if (!(await tool.getAttribute('class')).includes('active')) await tool.click();
    const p = await page.locator('#canvas').evaluate(
      (svg, point) => {
        const world = svg.querySelector('#world');
        const v = new DOMPoint(point.x, point.y).matrixTransform(world.getScreenCTM());
        return { x: v.x, y: v.y };
      },
      { x, y },
    );
    await page.mouse.click(p.x, p.y);
  };
  await place('mirror', 400, 200);
  await place('mirror', 400, 520);
  const mirror = (await state(page)).objects.find((o) => o.type === 'mirror');
  await select(page, mirror.id);
  expect(mirror.labels[0].size).toBe(54);
  const hatch = page.locator(`[data-oid="${mirror.id}"] > line`).last();
  const length = await hatch.evaluate((el) =>
    Math.hypot(
      el.x2.baseVal.value - el.x1.baseVal.value,
      el.y2.baseVal.value - el.y1.baseVal.value,
    ),
  );
  expect(length).toBeCloseTo(40);
  const section = page
    .locator('details')
    .filter({ has: page.getByText('End label position & style', { exact: true }) });
  await section.locator('summary').click();
  await page.locator('[data-prop="label.1.dx"]').fill('35');
  await page.locator('[data-prop="label.1.dx"]').press('Tab');
  await expect(section).toHaveAttribute('open', '');
  await page.locator('[data-prop="width"]').fill('6');
  await page.locator('[data-prop="width"]').press('Tab');
  await expect(hatch).toHaveAttribute('stroke-width', '6');
  await page.locator(`[data-oid="${mirror.id}"] [data-label="0"]`).click();
  const corner = await page.locator('[data-handle="label-resize"]').boundingBox();
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + 65, corner.y + 20, { steps: 5 });
  await page.mouse.up();
  expect(
    (await state(page)).objects.find((o) => o.id === mirror.id).labels[0].size,
  ).toBeGreaterThan(54);
  await page.keyboard.press('Control+z');
  expect((await state(page)).objects.find((o) => o.id === mirror.id).labels[0].size).toBe(54);
  await place('label', 150, 250);
  await page.locator('[data-prop="text"]').fill('First line\nSecond line');
  await page.locator('[data-prop="text"]').press('Tab');
  const text = (await state(page)).objects.find((o) => o.type === 'label');
  expect(text.fontSize).toBe(54);
  await expect(page.locator(`[data-oid="${text.id}"] tspan`)).toHaveCount(2);
  await place('arrow', 700, 200);
  await place('arrow', 700, 520);
  const arrow = (await state(page)).objects.find((o) => o.type === 'arrow');
  await select(page, arrow.id);
  const arrowhead = page.locator(`[data-oid="${arrow.id}"] > path`).first();
  const box = await arrowhead.evaluate((el) => ({
    width: el.getBBox().width,
    height: el.getBBox().height,
  }));
  expect(box.width).toBeCloseTo(40);
  expect(box.height).toBeCloseTo(40);
  await page.locator('[data-prop="width"]').fill('4.6');
  await page.locator('[data-prop="width"]').press('Tab');
  expect(await arrowhead.evaluate((el) => el.getBBox().width)).toBeCloseTo(80);
});
test('observer dragging, geometry, grid centering, and disconnect remain correct', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let d = await state(page);
  physics(d);
  const eye = d.objects.find((o) => o.id === d.optics.eye);
  const screen = async (p) =>
    page.evaluate((p) => {
      const r = document.querySelector('#canvas').getBoundingClientRect(),
        v = rayStudio.getView();
      return { x: r.left + v.x + p.x * v.k, y: r.top + v.y + p.y * v.k };
    }, p);
  const from = await screen({ x: eye.x + (6 * eye.size) / 80, y: eye.y }),
    to = await screen({ x: 360, y: 520 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  d = await state(page);
  physics(d);
  assert.notEqual(d.objects.find((o) => o.id === eye.id).y, eye.y);
  await page.mouse.up();
  await page.locator('[data-prop="x"]').fill('20');
  await page.locator('[data-prop="x"]').press('Tab');
  physics(await state(page));
  await page.locator('#properties-home').click();
  const before = await state(page);
  await page.locator('#grid-rows').fill('10');
  await page.locator('#grid-columns').fill('8');
  await page.locator('#apply-grid-size').click();
  d = await state(page);
  physics(d);
  const id = Object.keys(before.nodes)[0],
    dx = d.nodes[id].x - before.nodes[id].x,
    dy = d.nodes[id].y - before.nodes[id].y;
  for (const [key, p] of Object.entries(before.nodes)) {
    assert.ok(Math.abs(d.nodes[key].x - p.x - dx) < 1e-7);
    assert.ok(Math.abs(d.nodes[key].y - p.y - dy) < 1e-7);
  }
  await select(page, d.optics.branches[0].reflected);
  await page.locator('[data-action="disconnect-start"]').click();
  assert.equal((await state(page)).optics.enabled, false);
  await page.locator('#undo-btn').click();
  physics(await state(page));
  expect(errors).toEqual([]);
});
test('fractional lengths, labels, save/open, and all exports work', async ({ page }) => {
  const d = await state(page);
  await select(page, d.optics.mirror);
  const length = page.locator('[data-prop="length"]');
  await length.fill('3.5');
  await length.press('Tab');
  expect(await length.inputValue()).toBe('3.5');
  await page.locator('[data-prop="label.0.text"]').fill('Mirror top');
  await page.locator('[data-prop="label.0.text"]').press('Tab');
  const original = await state(page);
  const download = page.waitForEvent('download');
  await page.locator('#save-btn').click();
  const saved = await download;
  expect(await saved.failure()).toBeNull();
  await page.locator('#clear-all-btn').click();
  expect((await state(page)).objects).toHaveLength(0);
  await page.locator('#open-file').setInputFiles(await saved.path());
  await expect.poll(async () => (await state(page)).objects.length).toBe(original.objects.length);
  physics(await state(page));
  await page.locator('#export-btn').click();
  for (const format of ['svg', 'png', 'pdf']) {
    const event = page.waitForEvent('download');
    await page.locator(`[data-export="${format}"]`).click();
    const file = await event;
    expect(await file.failure()).toBeNull();
    const bytes = require('node:fs').readFileSync(await file.path());
    expect(bytes.length).toBeGreaterThan(100);
    if (format === 'pdf') expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    if (format === 'svg') {
      expect(bytes.toString()).toContain('Mirror top');
      expect(bytes.toString()).not.toContain('data-oid');
    }
  }
});
test('invalid project input cannot replace the current diagram or inject markup', async ({
  page,
}) => {
  const before = await state(page),
    bad = structuredClone(before);
  bad.objects.find((o) => o.type === 'eye').labelDx = '" onload="alert(1)';
  await page.locator('#open-file').setInputFiles({
    name: 'bad.ray.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.locator('#toast')).toContainText('Invalid');
  expect(await state(page)).toEqual(before);
  const escaped = structuredClone(before);
  escaped.objects.find((o) => o.labels).labels[0].align = 'start" onload="alert(1)';
  await page.locator('#open-file').setInputFiles({
    name: 'escaped.ray.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(escaped)),
  });
  await expect(page.locator('#toast')).toContainText('Project opened');
  expect(await page.locator('#objects-layer [onload]').count()).toBe(0);
});

test('unreadable autosave keeps a downloadable recovery copy', async ({ page }) => {
  const original = '{"broken autosave"';
  await page.evaluate((value) => localStorage.setItem('ray-studio-project-v1', value), original);
  await page.reload();
  await expect(page.locator('#recovery-btn')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ray-studio-project-v1-recovery'))).toBe(
    original,
  );
  const event = page.waitForEvent('download');
  await page.locator('#recovery-btn').click();
  const saved = await event;
  expect(require('node:fs').readFileSync(await saved.path(), 'utf8')).toBe(original);
});
