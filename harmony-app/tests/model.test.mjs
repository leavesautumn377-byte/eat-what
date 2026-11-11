import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Execute the actual domain implementation. This validates business rules,
// and deliberately makes no claim about ArkTS compilation or device APIs.
const source = await readFile(new URL('../entry/src/main/ets/model/MealData.ets', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source, { mode: 'strip' });
const model = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('first-run samples are editable and meals without selected times allow every time', () => {
  const database = model.defaultDatabase();
  assert.equal(database.meals.length, 20);
  assert.equal(new Set(database.meals.map(item => item.id)).size, 20);
  const meal = model.makeMeal('  食堂米饭  ', '  一食堂  ', [], []);
  assert.equal(meal.name, '食堂米饭');
  assert.equal(meal.location, '一食堂');
  assert.deepEqual(meal.mealTimes, model.MEAL_TIMES);
});

test('time and multiple tags use AND matching', () => {
  const meals = model.defaultDatabase().meals;
  const result = model.filterMeals(meals, '晚饭', ['碳水', '重口']);
  assert.deepEqual(result.map(item => item.name), ['椒麻鸡饭']);
  assert.deepEqual(model.filterMeals(meals, '早饭', ['重口']), []);
  assert.equal(model.filterMeals(meals, '', []).length, 20);
});

test('reroll excludes the current result and reports no alternative for a single meal', () => {
  const meals = model.defaultDatabase().meals;
  for (let index = 0; index < 100; index++) {
    assert.notEqual(model.pickMeal(meals, meals[0].id).id, meals[0].id);
  }
  assert.equal(model.pickMeal([meals[0]], meals[0].id), undefined);
  assert.equal(model.pickMeal([], ''), undefined);
  assert.equal(model.pickMeal([meals[0]], '').id, meals[0].id);
});

test('meal editing and deletion leave immutable historical snapshots', () => {
  const meal = model.makeMeal('面条', '食堂', ['午饭'], ['热乎']);
  const record = model.makeRecord(meal, '午饭', '', '', '');
  meal.name = '改后的名字';
  meal.tags.push('重口');
  assert.equal(record.mealName, '面条');
  assert.deepEqual(record.tags, ['热乎']);
  const database = model.nextDatabase([], [record]);
  assert.equal(model.parseDatabase(JSON.stringify(database)).records[0].mealName, '面条');
});

test('empty meals survive serialization without sample resurrection', () => {
  const database = model.nextDatabase([], []);
  assert.deepEqual(model.parseDatabase(JSON.stringify(database)).meals, []);
});

test('optional record fields remain empty and an unspecified time is not invented', () => {
  const record = model.makeRecord(model.defaultDatabase().meals[0], '', '', '', '');
  assert.equal(record.mealTime, '');
  assert.equal(record.rating, '');
  assert.equal(record.note, '');
  assert.equal(record.photoPath, '');
  assert.match(record.dateText, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.timeText, /^\d{2}:\d{2}$/);
});

test('summary supports names that coincide with JavaScript object properties', () => {
  const a = model.makeMeal('__proto__', '', [], []);
  const b = model.makeMeal('constructor', '', [], []);
  const result = model.summarize([
    model.makeRecord(a, '', '', '', ''), model.makeRecord(b, '', '', '', ''), model.makeRecord(a, '', '', '', '')
  ]);
  assert.equal(result.count, 3);
  assert.equal(result.favoriteName, '__proto__');
  assert.equal(result.favoriteCount, 2);
});

test('invalid databases and duplicate IDs fail instead of silently discarding data', () => {
  assert.throws(() => model.parseDatabase('{broken'));
  assert.throws(() => model.parseDatabase('null'));
  assert.throws(() => model.parseDatabase('{"version":1,"meals":{},"records":[]}'));
  const meal = model.defaultDatabase().meals[0];
  assert.throws(() => model.parseDatabase(JSON.stringify(model.nextDatabase([meal, meal], []))));
  const database = model.defaultDatabase();
  delete database.meals[0].tags;
  assert.throws(() => model.parseDatabase(JSON.stringify(database)));
});

test('input validation preserves the larger existing input limits', () => {
  assert.throws(() => model.makeMeal('  ', '', [], []));
  assert.equal(model.makeMeal('面'.repeat(40), '店'.repeat(50), [], []).name.length, 40);
  assert.throws(() => model.makeMeal('面'.repeat(41), '', [], []));
  assert.throws(() => model.makeMeal('面', '店'.repeat(51), [], []));
});

test('selection toggling does not mutate the original array', () => {
  const selected = ['早饭'];
  assert.deepEqual(model.toggleValue(selected, '午饭'), ['早饭', '午饭']);
  assert.deepEqual(model.toggleValue(selected, '早饭'), []);
  assert.deepEqual(selected, ['早饭']);
});
