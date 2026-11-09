# 🍕 Pizza Dough Planner Card

[![Marketplace: Custom](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://github.com/florian-ha86/pizza-dough-planner-card)
[![Release](https://img.shields.io/github/v/release/florian-ha86/pizza-dough-planner-card)](https://github.com/florian-ha86/pizza-dough-planner-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[🇩🇪 Deutsche Anleitung](README.de.md)**

A Home Assistant dashboard card that plans your pizza dough **backwards from the time you want to eat**. Choose when the pizza should be ready – the card calculates ingredients and schedule, and an optional blueprint reminds you of every step.

> The card's user interface is in **German**.

---

## ✨ Features

| | |
|---|---|
| 🍕 **Pizza timer** | A drawn pizza whose crust "bakes" as time passes. Steps sit as icons around it – tap one for time and details. |
| ⚖️ **Recipe calculator** | Flour, water, salt and yeast in grams from number of pizzas, ball weight, hydration and salt. |
| 🫙 **Leavening** | Fresh yeast, dry yeast or **lievito madre**. Flour and water inside the starter are subtracted automatically, so weight and hydration stay correct. |
| 🌡️ **Yeast estimate** | Based on fermentation time plus room and fridge temperature, with a correction factor. |
| 🧊 **Ice cubes** | Plan part of the water as ice – as a fixed share or automatically from your target dough temperature. Total water and hydration stay the same. |
| ⏱️ **Schedule** | Knead → stretch & fold (optional) → shape balls → cold retard (optional) → acclimatise → preheat oven → pizza. |
| 🌾 **Flour database** | Protein, W value and ideal fermentation time for common flours, with a traffic light showing whether your plan fits. Extendable. |
| 📋 **Recipes** | Presets (Neapolitan, Roman, same-day, canotto, 48 h) and three slots for your own doughs. |
| 📅 **Date & time picker** | Day strip with weekday and date, quick times and ±15 minutes – right inside the card. |
| 🔥 **Oven section** | Preheat time and weather forecast for baking time (optional). |
| 🔔 **Reminders** | Blueprint sends a notification for every step and switches the plan off afterwards. |

Light & dark mode · tablet and phone friendly · no external requests · no other custom cards needed.

---

## 📦 Requirements

- Home Assistant **2024.11** or newer
- **One text helper** (`input_text`) with **maximum length 255**
- Optional: room temperature sensor, weather integration with forecast, a notification service

---

## 🚀 Installation

### Via Marketplace (formerly HACS)

1. Open **Settings → Marketplace**.
2. Open the menu → **Custom repositories** and add  
   `https://github.com/florian-ha86/pizza-dough-planner-card` with category **Dashboard**.
3. Install **Pizza Dough Planner Card** and reload your browser.

### Manual

1. Download `pizza-dough-planner-card.js` from the [latest release](https://github.com/florian-ha86/pizza-dough-planner-card/releases) (or from `dist/`) and copy it to `/config/www/`.
2. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**  
   URL: `/local/pizza-dough-planner-card.js` · Type: **JavaScript module**.

---

## 🛠️ Setup

### 1. Create the storage helper

**Settings → Devices & services → Helpers → Create helper → Text**

- Name: e.g. `Pizza Dough Planner`
- **Maximum length: 255** ⚠️ the default of 100 is too short

### 2. Add the card

Edit your dashboard → **Add card** → **Pizza-Teigplaner**, then pick the helper in the visual editor. Looks best in a **panel view** or at full width.

```yaml
type: custom:pizza-dough-planner-card
entity: input_text.pizza_dough_planner
temperature_entity: sensor.kitchen_temperature   # optional
weather_entity: weather.home                     # optional
title: Nächster Pizzaabend                       # optional
oven_name: Pizzaofen                             # optional
```

| Option | Required | Default | Description |
|---|:---:|---|---|
| `entity` | ✅ | – | Text helper that stores all settings (max length 255) |
| `temperature_entity` | | – | Room temperature for the yeast estimate; without it an adjustable fallback is used |
| `weather_entity` | | – | Weather forecast for baking time |
| `title` | | `Nächster Pizzaabend` | Heading |
| `oven_name` | | `Pizzaofen` | Name of your oven |

### 3. Set up reminders (optional)

[![Open your Home Assistant instance and show the blueprint import dialog.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fflorian-ha86%2Fpizza-dough-planner-card%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fpizza_dough_planner_reminders.yaml)

1. Import the blueprint and create an automation from it.
2. Select **the same storage helper** as in the card.
3. Under **Notification**, add an action – e.g. *Send a notification* to your phone – using `{{ title }}` and `{{ message }}`.
4. Optional: choose the same temperature sensor as in the card so the yeast amounts match.

Turn on **„Erinnerungen an“** in the card. You'll get a heads-up with the ingredient list, then messages for kneading, stretch & fold, shaping, fridge, oven and eating time. The plan switches itself off when it's pizza time.

---

## 🌾 Adding your own flours

Create `/config/www/pizza-flours.js` (see [`examples/eigene-mehle.js`](examples/eigene-mehle.js)) and add it as an extra **JavaScript module** resource:

```js
window.PIZZA_FLOURS = Object.assign(window.PIZZA_FLOURS || {}, {
  'My flour': { p: '12.5 %', w: '280', min: 12, max: 36, hmin: 60, hmax: 68, tip: 'My own entry.' }
});
```

`p` protein · `w` W value · `min`/`max` ideal total fermentation in hours · `hmin`/`hmax` typical hydration in % · `tip` short note.

---

## 🧮 How it works

All settings are stored as compact JSON in the text helper – every device shows the same plan, and the blueprint reads the same data. Card and blueprint use identical formulas:

- **Dough:** total = pizzas × ball weight; flour = total ÷ (1 + hydration + salt + yeast).
- **Lievito madre:** share of total flour; the starter's flour and water (from its hydration) are subtracted from the main amounts.
- **Yeast:** effective hours = room hours × 2^((T − 21)/6) + fridge hours × 2^((T<sub>fridge</sub> − 21)/6); fresh yeast ≈ 4 % ÷ hours<sup>1.25</sup> × correction; dry yeast = fresh ÷ 3.
- **Ice:** fixed share of the water, or automatic: required water temperature = 3 × target dough temp − room temp − flour temp − kneading heat-up; if colder than tap water, ice share = (tap − required) ÷ (tap + 80).
- **Schedule:** knead = eating time − (acclimatise + cold retard + bulk); every step is counted back from eating time.

---

## ⚠️ Notes

- The **yeast amount is an estimate**. If your dough is regularly too fast or too slow, adjust the yeast correction.
- **Flour data** are manufacturer or typical values – the package is authoritative.
- **Saved doughs** live in the browser; the **current plan** lives in the helper and is shared across devices.

---

## 📄 License

[MIT](LICENSE) © florian-ha86
