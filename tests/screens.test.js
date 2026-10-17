const { test } = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./support/appHarness.cjs');
const child = { id: 'child', name: 'Sprout', dob: '2026-01-01', weaningStart: '2026-07-01', userId: 'parent', isOwner: true, knownAllergens: ['Dairy'] };
const food = { id: 'food', childId: 'child', food: 'Banana', name: 'Banana', date: '2026-10-17', time: '12:00', category: 'Fruit', reaction: 'Loved', allergens: [], amount: 'Some', texture: 'Mashed' };
const bottle = { id: 'bottle', childId: 'child', date: '2026-10-17', time: '08:00', amount: 180, unit: 'ml', type: 'formula' };
for (const platform of ['ios', 'android']) {
  const h = harness(platform);
  for (const populated of [false, true]) for (const isPro of [false, true]) {
    const props = { user: { uid: 'parent', email: 'test@example.test', providerData: [] }, userDoc: { name: 'Jamie' }, child, activeChild: child, children: populated ? [child] : [], ownedChildren: populated ? [child] : [], foodLog: populated ? [food] : [], childFoodLog: populated ? [food] : [], bottleLog: populated ? [bottle] : [], weightLog: populated ? [{ id: 'weight', date: '2026-10-17', weight: 8, weightKg: 8 }] : [], recipes: populated ? [{ id: 'recipe', title: 'Banana mash', category: 'Fruit', ageGroup: '6m+', ingredients: ['1 banana'], steps: ['Mash banana'], featured: true, locked: false }, { id: 'pro-recipe', title: 'Family lunch', category: 'Vegetables', ingredients: ['1 carrot'], locked: true }] : [], smartRecipes: [], favouriteRecipeIds: populated ? ['recipe'] : [], childName: child.name, isPro };
    for (const name of ['DashboardScreen','LogScreen','BottleScreen','AllergenScreen','ChildrenScreen','ChildDetailScreen','RecipesScreen','ShoppingListScreen','MealPlannerScreen','SmartMealIdeasScreen','MoreScreen','MealsHubScreen']) {
      test(`${platform} ${name}: ${populated ? 'existing data' : 'empty logs'}, ${isPro ? 'Pro' : 'free'}`, () => {
        const Screen = h.load(`src/screens/${name}.js`)[name];
        const nodes = h.render(h.react.createElement(Screen, props));
        assert.ok(nodes.length > 0);
      });
    }
  }
}

for (const platform of ['ios', 'android']) test(`${platform} authentication screen renders`, () => {
  const h = harness(platform);
  assert.ok(h.render(h.react.createElement(h.load('src/screens/AuthScreen.js').default, {})).length > 0);
});
