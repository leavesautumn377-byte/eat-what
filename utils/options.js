const MEAL_TIMES = ['早饭', '午饭', '晚饭', '夜宵']
const TAGS = [
  '养生', '重口', '碳水',
  '清爽', '热乎'
]
const RATINGS = ['好吃', '一般', '不想再吃']

function optionItems(values, selected) {
  return values.map((value) => ({ value, selected: selected.includes(value) }))
}

function filterMeals(meals, mealTime, tags) {
  return meals.filter((meal) => (
    (!mealTime || meal.mealTimes.includes(mealTime)) &&
    tags.every((tag) => meal.tags.includes(tag))
  ))
}

function pickMeal(meals, previousId) {
  const pool = meals.length > 1 ? meals.filter((meal) => meal.id !== previousId) : meals
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}

module.exports = { MEAL_TIMES, TAGS, RATINGS, optionItems, filterMeals, pickMeal }
