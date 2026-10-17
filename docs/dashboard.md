# Dashboard refresh

The dashboard leads with the child's day: food entries today, optional milk-feed
count, optional latest weight with its measurement date, profile access and
food/milk logging buttons. Milk-first onboarding puts Log milk first; allergen
and recipe priorities retain their shortcut. A child without a profile gets a
clear Add your child action.

Recent activity combines the three most recent food and milk entries. Optional
cards follow for milk totals, allergen records, food totals/favourites and recipe
inspiration. Due allergen check-ins appear above activity when the allergen
section is enabled. The redundant reaction-stat grid, milk chart, large recipe
image and promotional banners were removed from the dashboard. Logs, profiles,
recipes and Pro remain available through their existing screens.

Customise on the dashboard and More > Dashboard use the same controls. Users can
hide milk summaries, allergen summaries/check-ins, food totals, recent activity,
recipe inspiration and latest weight. Hiding milk also excludes it from recent
activity; logging remains available. Hero colours are lavender, blush pink, sky
blue, mint and peach, with dark text and contrasting primary buttons.

Settings are account-wide, not child-specific. They are saved under
users/{uid}.dashboardPreferences using single-field updates, preserving all
other onboarding/preferences data. Existing milk/allergen settings and local
legacy fallbacks remain respected. Unknown colour keys fall back to lavender.
Failed saves show a retry message. No data is deleted by hiding a section.

Automated coverage includes old/default preferences, hidden sections, local-day
and activity ordering, palette selection/contrast, persistence callbacks, known
allergies and navigation. Run npm test. iOS/Android exports verify bundling;
check the final native layout and persistence on an iPhone before release.

Nothing was published. This remains part of version 1.6.0.

The saved colour also styles the global child header, selected navigation tab,
navigation border, floating add button, child selection highlights and food
quick-add icon. Pastel surfaces use matching dark text; the add button uses a
solid accent for a clear white plus. This account preference updates across
screens without a separate setting.

The selected accent now also supplies the shared theme for every signed-in page
and modal: headings, buttons, filters, input/card borders and decorative icons.
Dark mode uses dark tinted surfaces and light accents; high-contrast mode keeps
its strong borders and uses deeper accent colours. Semantic reaction, allergy,
milk-type and achievement colours remain distinct. The existing account field
`dashboardPreferences.heroColour` remains the single source of truth.
