const MEAL_TIMES = ['早饭', '午饭', '晚饭', '夜宵']
const TAGS = [
  '养生', '重口', '碳水',
  '清爽', '热乎'
]
const RATINGS = ['好吃', '一般', '不想再吃']

function optionItems(values, selected) {
  return values.map((value) => ({ value, selected: selected.includes(value) }))
}

function filterMeals(meals, mealTime, tags, budget = null) {
  return meals.filter((meal) => (
    (!mealTime || meal.mealTimes.includes(mealTime)) &&
    tags.every((tag) => meal.tags.includes(tag)) &&
    (budget === null || (typeof meal.price === 'number' && meal.price <= budget))
  ))
}

function pickMeal(meals, previousId, records = []) {
  const pool = meals.length > 1 ? meals.filter((meal) => meal.id !== previousId) : meals
  const recent = records.slice(0, 3)
  const fresh = pool.filter((meal) => !recent.some((record) => record.mealId
    ? record.mealId === meal.id
    : record.mealName === meal.name && record.location === meal.location))
  const choices = fresh.length ? fresh : pool
  return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null
}

module.exports = { MEAL_TIMES, TAGS, RATINGS, optionItems, filterMeals, pickMeal }
