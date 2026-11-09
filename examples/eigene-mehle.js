// Optional: add your own flours without editing the card.
// Save as /config/www/pizza-flours.js and add it as a dashboard resource
// (Settings → Dashboards → ⋮ → Resources → URL /local/pizza-flours.js, type "JavaScript module").
//
// Fields: p = protein, w = W value, min/max = ideal total fermentation (h),
//         hmin/hmax = typical hydration (%), tip = short note.
window.PIZZA_FLOURS = Object.assign(window.PIZZA_FLOURS || {}, {
  'Mein Lieblingsmehl': { p: '12,5 %', w: '280', min: 12, max: 36, hmin: 60, hmax: 68, tip: 'Eigener Eintrag.' }
});
