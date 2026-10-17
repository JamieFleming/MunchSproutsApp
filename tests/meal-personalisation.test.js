const { test } = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./support/appHarness.cjs');
const child = { id: 'child', name: 'Sprout', dob: '2025-01-01', knownAllergens: ['Dairy'], allergensToAvoid: ['Soy'], otherAllergies: ' Kiwi ' };
const log = [
  { name: 'Yoghurt', reaction: 'Loved', allergens: ['Dairy'] },
  { name: 'Egg', reaction: 'Allergic', allergens: ['Eggs'] },
  { name: 'Bread', reaction: 'Loved', allergens: ['Gluten'] },
];
test('known allergies override earlier positive logs and never become new-allergen suggestions', () => {
  const h = harness();
  const { deriveFoodContext } = h.load('src/screens/SmartMealIdeasScreen.js');
  const context = deriveFoodContext(log, child);
  assert.deepEqual(context.allergensAvoid.sort(), ['dairy', 'eggs', 'kiwi', 'soy']);
  assert.deepEqual(context.allergensSafe, ['gluten']);
  for (const allergen of context.allergensAvoid) assert.ok(!context.allergensNotTried.includes(allergen));
  assert.deepEqual(deriveFoodContext([], child).allergensAvoid.sort(), ['dairy', 'kiwi', 'soy']);
});
test('weekly planner sends date-of-birth age and profile/log allergies to the generation service', async () => {
  const calls = [];
  const h = harness('ios', {
    'firebase/app': { getApp: () => ({}) },
    'firebase/functions': { getFunctions: () => ({}), httpsCallable: (_f, name) => async (payload) => { calls.push({ name, payload }); return { data: {} }; } },
  });
  const { MealPlannerScreen } = h.load('src/screens/MealPlannerScreen.js');
  const root = MealPlannerScreen({ user: { uid: 'parent' }, isPro: true, activeChild: child, childFoodLog: log, recipes: [], smartRecipes: [] });
  const flatten = (node) => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [];
  const modal = flatten(root).find((node) => node.type?.name === 'GenerateOptionsModal');
  assert.ok(modal);
  await modal.props.onGenerate({ daysToGenerate: ['monday'], additionalPreferences: '', dislikedFoods: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'generateWeeklyMealPlan');
  assert.deepEqual(calls[0].payload.allergensAvoid.sort(), ['dairy', 'eggs', 'kiwi', 'soy']);
  assert.equal(calls[0].payload.ageMonths, h.load('src/helpers.js').calcAgeMonths(child.dob));
  assert.notEqual(calls[0].payload.ageMonths, 6);
});
