import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const original = new URL('../../', import.meta.url);
const read = url => readFile(url);

test('native package preserves the selected background, font and meal-ticket icon bytes', async () => {
  assert.deepEqual(await read(new URL('entry/src/main/resources/base/media/watercolor_home.jpg', root)),
    await read(new URL('assets/watercolor-home.jpg', original)));
  assert.deepEqual(await read(new URL('entry/src/main/resources/rawfile/wenkai-ui.ttf', root)),
    await read(new URL('assets/wenkai-ui.ttf', original)));
  for (const target of ['AppScope/resources/base/media/app_icon.png', 'entry/src/main/resources/base/media/app_icon.png']) {
    assert.deepEqual(await read(new URL(target, root)),
      await read(new URL(`android-app/${encodeURIComponent('图标-餐签咬痕.png')}`, original)));
  }
  await access(new URL('entry/src/main/resources/rawfile/OFL-wenkai.txt', root));
});

test('application entry and resource declarations point to files present in the native project', async () => {
  const module = JSON.parse(await read(new URL('entry/src/main/module.json5', root)));
  const app = JSON.parse(await read(new URL('AppScope/app.json5', root)));
  assert.equal(app.app.bundleName, 'com.angqi.eatwhat');
  assert.equal(module.module.type, 'entry');
  assert.deepEqual(module.module.deviceTypes, ['phone']);
  for (const ability of module.module.abilities) {
    await access(new URL(`entry/src/main/${ability.srcEntry}`, root));
  }
  const pages = JSON.parse(await read(new URL('entry/src/main/resources/base/profile/main_pages.json', root)));
  for (const page of pages.src) await access(new URL(`entry/src/main/ets/${page}.ets`, root));
});
