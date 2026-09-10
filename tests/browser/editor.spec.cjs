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
  await page.goto('/');
  await page.waitForFunction(() => window.rayStudio);
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
  await page
    .locator('#open-file')
    .setInputFiles({
      name: 'bad.ray.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bad)),
    });
  await expect(page.locator('#toast')).toContainText('Invalid');
  expect(await state(page)).toEqual(before);
  const escaped = structuredClone(before);
  escaped.objects.find((o) => o.labels).labels[0].align = 'start" onload="alert(1)';
  await page
    .locator('#open-file')
    .setInputFiles({
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
