# Simpler food logging

The food form now starts with today's local date, a food name, compact food-group
choices and reaction buttons. The date is editable. Texture and allergens remain
visible as compact controls; allergen choices open automatically for an allergic
reaction or a reused food. Notes, favourites, Pro meal times and Pro photos live
under More details, which opens automatically when editing an entry containing
those values.

Recent-food shortcuts use only the active child's log, select the latest entry
for each name, and copy its name, food groups, texture and allergen selections.
They do not copy a past reaction, amount, notes, photo or date. The form reminds
parents to check the ingredients again. Blank allergens mean not recorded, not
an assertion that a food is allergen-free.

The Firestore schema is unchanged. Name and at least one food group remain
required; other details remain optional. Both legacy category and multi-category
entries are supported. Multiple categories now survive editing correctly.

Saving waits for the parent operation, prevents duplicate taps and retains the
form on failure. The add/edit handlers return explicit success/failure results.
The default date uses local calendar time instead of a UTC date that can differ
around midnight.

Run `npm test`. The new tests exercise expanded sections, editing/preservation,
validation, repeat-food shortcuts, reaction/allergen interactions, liquid amounts,
save failures, duplicate taps and local date handling. Native layout, keyboard
behaviour and photo selection still need checking on the preview iPhone build.

No app release or OTA was published for this change. It remains part of 1.6.0.
