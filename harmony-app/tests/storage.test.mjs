import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const toModule = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const domainSource = fs.readFileSync(new URL('../entry/src/main/ets/model/MealData.ets', import.meta.url), 'utf8');
const domainUrl = toModule(stripTypeScriptTypes(domainSource, { mode: 'strip' }));
const model = await import(domainUrl);
let failAt = '';
let openFiles = new Set();
function checkpoint(stage) { if (failAt === stage) throw new Error(`injected ${stage} failure`); }
const platform = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4, READ_ONLY: 8 },
  accessSync: name => fs.existsSync(name),
  mkdirSync: name => fs.mkdirSync(name),
  readTextSync: name => fs.readFileSync(name, 'utf8'),
  openSync(name, flags) {
    checkpoint('open');
    const filename = name.startsWith('file:') ? fileURLToPath(name) : name;
    const fd = fs.openSync(filename, flags & 8 ? 'r' : 'w+');
    openFiles.add(fd);
    return { fd };
  },
  async open(name, flags) { return this.openSync(name, flags); },
  writeSync(fd, text) {
    checkpoint('write');
    return fs.writeSync(fd, failAt === 'partial' ? text.slice(0, 12) : text);
  },
  fsyncSync(fd) { checkpoint('sync'); fs.fsyncSync(fd); },
  closeSync(file) { fs.closeSync(file.fd); openFiles.delete(file.fd); },
  renameSync(a, b) { checkpoint('rename'); fs.renameSync(a, b); },
  unlinkSync(name) { fs.unlinkSync(name); },
  async copyFile(fd, destination) {
    fs.writeFileSync(destination, fs.readFileSync(fd));
    checkpoint('copy');
  }
};
globalThis.__mealFileIo = platform;
const kitUrl = toModule(`export const common = {}; export const fileIo = globalThis.__mealFileIo;
  export const fileUri = { getUriFromPath(path) { return 'file://' + path; } };`);
let repositorySource = stripTypeScriptTypes(fs.readFileSync(
  new URL('../entry/src/main/ets/service/MealRepository.ets', import.meta.url), 'utf8'), { mode: 'strip' });
repositorySource = repositorySource.replaceAll("'@kit.AbilityKit'", JSON.stringify(kitUrl))
  .replaceAll("'@kit.CoreFileKit'", JSON.stringify(kitUrl))
  .replaceAll("'../model/MealData'", JSON.stringify(domainUrl));
const { MealRepository } = await import(toModule(repositorySource));

function environment(t) {
  failAt = '';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eatwhat-harmony-test-'));
  t.after(() => {
    failAt = '';
    assert.equal(openFiles.size, 0, 'all file handles must be closed');
    const resolved = fs.realpathSync(directory);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('eatwhat-harmony-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { directory, repository: new MealRepository({ filesDir: directory }),
    databasePath: path.join(directory, 'eatwhat-v1.json') };
}

test('actual repository preserves an intentionally empty list across instances', t => {
  const env = environment(t);
  assert.equal(env.repository.load().meals.length, 6);
  env.repository.save(model.nextDatabase([], []));
  assert.deepEqual(new MealRepository({ filesDir: env.directory }).load().meals, []);
});

for (const stage of ['open', 'write', 'partial', 'sync', 'rename']) {
  test(`a ${stage} failure cannot replace the committed database`, t => {
    const env = environment(t);
    env.repository.load();
    const before = fs.readFileSync(env.databasePath, 'utf8');
    failAt = stage;
    assert.throws(() => env.repository.save(model.nextDatabase([], [])));
    failAt = '';
    assert.equal(fs.readFileSync(env.databasePath, 'utf8'), before);
    assert.equal(env.repository.load().meals.length, 6);
    env.repository.save(model.nextDatabase([], []));
    assert.deepEqual(env.repository.load().meals, []);
  });
}

test('corrupt committed data remains intact after load fails', t => {
  const env = environment(t);
  fs.writeFileSync(env.databasePath, '{corrupted');
  assert.throws(() => env.repository.load());
  assert.equal(fs.readFileSync(env.databasePath, 'utf8'), '{corrupted');
});

test('imported photos are independent files and referenced photos cannot be deleted', async t => {
  const env = environment(t);
  const original = path.join(env.directory, 'original.jpg');
  fs.writeFileSync(original, 'test-photo-content');
  const saved = await env.repository.importPhoto(pathToFileURL(original).href);
  assert.notEqual(saved, original);
  assert.equal(fs.readFileSync(saved, 'utf8'), 'test-photo-content');
  const record = model.makeRecord(model.defaultDatabase().meals[0], '', '', '', saved);
  env.repository.removePhoto(saved, [record]);
  assert.equal(fs.existsSync(saved), true);
  env.repository.removePhoto(original, []);
  assert.equal(fs.existsSync(original), true, 'source/gallery photo must never be deleted');
  env.repository.removePhotos([record], []);
  assert.equal(fs.existsSync(saved), false);
});

test('failed photo import cleans up partial file and closes the source handle', async t => {
  const env = environment(t);
  const original = path.join(env.directory, 'original.jpg');
  fs.writeFileSync(original, 'test-photo-content');
  failAt = 'copy';
  await assert.rejects(() => env.repository.importPhoto(pathToFileURL(original).href));
  failAt = '';
  assert.deepEqual(fs.readdirSync(path.join(env.directory, 'meal-photos')), []);
  assert.equal(fs.existsSync(original), true);
});
