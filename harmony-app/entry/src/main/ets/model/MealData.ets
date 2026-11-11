export const MEAL_TIMES: string[] = ['早饭', '午饭', '晚饭', '夜宵'];
export const MEAL_TAGS: string[] = ['养生', '重口', '碳水', '清爽', '热乎'];
export const RATINGS: string[] = ['好吃', '一般', '不想再吃'];

let sequence: number = 0;

export function createId(): string {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.floor(Math.random() * 1000000).toString(36)}`;
}

export class Meal {
  id: string = '';
  name: string = '';
  location: string = '';
  mealTimes: string[] = [];
  tags: string[] = [];
}

export class MealRecord {
  id: string = '';
  mealId: string = '';
  mealName: string = '';
  location: string = '';
  mealTime: string = '';
  tags: string[] = [];
  rating: string = '';
  note: string = '';
  photoPath: string = '';
  source: string = '';
  dateText: string = '';
  timeText: string = '';
}

export class MealDatabase {
  version: number = 1;
  meals: Meal[] = [];
  records: MealRecord[] = [];
}

export class MealSummary {
  count: number = 0;
  favoriteName: string = '--';
  favoriteCount: number = 0;
}

export function cloneMeal(value: Meal): Meal {
  const next: Meal = new Meal();
  next.id = value.id;
  next.name = value.name;
  next.location = value.location;
  next.mealTimes = value.mealTimes.slice();
  next.tags = value.tags.slice();
  return next;
}

export function makeMeal(name: string, location: string, times: string[], tags: string[], existingId: string = ''): Meal {
  const trimmedName: string = name.trim();
  if (trimmedName.length === 0) {
    throw new Error('先写一个名称');
  }
  if (trimmedName.length > 40 || location.trim().length > 50) {
    throw new Error('名称最多40字，店名最多50字');
  }
  const meal: Meal = new Meal();
  meal.id = existingId.length > 0 ? existingId : createId();
  meal.name = trimmedName;
  meal.location = location.trim();
  meal.mealTimes = times.length > 0 ? times.slice() : MEAL_TIMES.slice();
  meal.tags = tags.slice();
  return meal;
}

export function defaultDatabase(): MealDatabase {
  const result: MealDatabase = new MealDatabase();
  result.meals = [
    makeMeal('咖喱菠萝鸡饭', '三食堂三楼', ['午饭', '晚饭'], ['碳水']),
    makeMeal('椒麻鸡饭', '一食堂一楼', ['午饭', '晚饭'], ['重口', '碳水']),
    makeMeal('石锅饭', '一三', ['午饭', '晚饭'], ['热乎', '碳水']),
    makeMeal('自选', '一三', ['午饭', '晚饭'], []),
    makeMeal('滑蛋饭', '一三', ['午饭', '晚饭'], ['碳水', '热乎']),
    makeMeal('临榆炸鸡腿', '首联', ['午饭', '晚饭', '夜宵'], ['重口']),
    makeMeal('肉蛋堡', '首联', ['早饭', '午饭', '夜宵'], ['碳水']),
    makeMeal('炸鸡', '三食堂旁红房子', ['午饭', '晚饭', '夜宵'], ['重口']),
    makeMeal('煎饼', '三食堂旁红房子', ['早饭', '午饭', '晚饭'], ['碳水']),
    makeMeal('杭州小吃', '小洞天', ['午饭', '晚饭'], []),
    makeMeal('冒菜', '小洞天', ['午饭', '晚饭', '夜宵'], ['重口', '热乎']),
    makeMeal('塔斯汀', '小洞天', ['午饭', '晚饭', '夜宵'], ['碳水']),
    makeMeal('肯德基', '首联', ['午饭', '晚饭', '夜宵'], ['重口']),
    makeMeal('醉面', '首联', ['午饭', '晚饭', '夜宵'], ['碳水', '热乎']),
    makeMeal('袁记云饺', '首联', ['午饭', '晚饭', '夜宵'], ['热乎']),
    makeMeal('壹号烧烤', '北街', ['晚饭', '夜宵'], ['重口']),
    makeMeal('戳子肉', '北街', ['晚饭', '夜宵'], ['重口']),
    makeMeal('火锅鸡', '北街', ['午饭', '晚饭', '夜宵'], ['重口', '热乎']),
    makeMeal('小城故事', '北街', ['午饭', '晚饭'], []),
    makeMeal('沙威玛', '北街', ['午饭', '晚饭', '夜宵'], ['碳水'])
  ];
  return result;
}

export function filterMeals(meals: Meal[], time: string, tags: string[]): Meal[] {
  return meals.filter((meal: Meal) =>
    (time.length === 0 || meal.mealTimes.includes(time)) && tags.every((tag: string) => meal.tags.includes(tag))
  );
}

export function pickMeal(meals: Meal[], previousId: string): Meal | undefined {
  const pool: Meal[] = previousId.length > 0 ? meals.filter((meal: Meal) => meal.id !== previousId) : meals;
  if (pool.length === 0) {
    return undefined;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function toggleValue(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values.filter((item: string) => item !== value);
  }
  return values.concat([value]);
}

function padded(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export function makeRecord(meal: Meal, time: string, rating: string, note: string, photoPath: string): MealRecord {
  const now: Date = new Date();
  const record: MealRecord = new MealRecord();
  record.id = createId();
  record.mealId = meal.id;
  record.mealName = meal.name;
  record.location = meal.location;
  record.mealTime = time;
  record.tags = meal.tags.slice();
  record.rating = rating;
  record.note = note.trim();
  record.photoPath = photoPath;
  record.source = `${time || '全部'}随机`;
  record.dateText = `${now.getFullYear()}-${padded(now.getMonth() + 1)}-${padded(now.getDate())}`;
  record.timeText = `${padded(now.getHours())}:${padded(now.getMinutes())}`;
  return record;
}

export function summarize(records: MealRecord[]): MealSummary {
  const result: MealSummary = new MealSummary();
  result.count = records.length;
  const names: string[] = [];
  const counts: number[] = [];
  records.forEach((record: MealRecord) => {
    const index: number = names.indexOf(record.mealName);
    if (index < 0) {
      names.push(record.mealName);
      counts.push(1);
    } else {
      counts[index] += 1;
    }
  });
  names.forEach((name: string, index: number) => {
    if (counts[index] > result.favoriteCount) {
      result.favoriteName = name;
      result.favoriteCount = counts[index];
    }
  });
  return result;
}

export function nextDatabase(meals: Meal[], records: MealRecord[]): MealDatabase {
  const result: MealDatabase = new MealDatabase();
  result.meals = meals;
  result.records = records;
  return result;
}

function isStringArray(value: string[]): boolean {
  return Array.isArray(value) && value.every((item: string) => typeof item === 'string');
}

export function parseDatabase(text: string): MealDatabase {
  const value: MealDatabase = JSON.parse(text) as MealDatabase;
  if (!value || value.version !== 1 || !Array.isArray(value.meals) || !Array.isArray(value.records)) {
    throw new Error('本地数据格式异常，请保留应用数据后重试');
  }
  const mealIds: Set<string> = new Set<string>();
  value.meals.forEach((meal: Meal) => {
    if (!meal || typeof meal.id !== 'string' || meal.id.length === 0 || mealIds.has(meal.id) ||
      typeof meal.name !== 'string' || meal.name.trim().length === 0 || typeof meal.location !== 'string' ||
      !isStringArray(meal.mealTimes) || !isStringArray(meal.tags)) {
      throw new Error('吃饭清单读取失败，请保留应用数据后重试');
    }
    mealIds.add(meal.id);
  });
  const recordIds: Set<string> = new Set<string>();
  value.records.forEach((record: MealRecord) => {
    if (!record || typeof record.id !== 'string' || record.id.length === 0 || recordIds.has(record.id) ||
      typeof record.mealId !== 'string' || typeof record.mealName !== 'string' ||
      typeof record.location !== 'string' || typeof record.mealTime !== 'string' ||
      !isStringArray(record.tags) || typeof record.rating !== 'string' || typeof record.note !== 'string' ||
      typeof record.photoPath !== 'string' || typeof record.source !== 'string' ||
      typeof record.dateText !== 'string' || typeof record.timeText !== 'string') {
      throw new Error('吃饭记录读取失败，请保留应用数据后重试');
    }
    recordIds.add(record.id);
  });
  return value;
}
