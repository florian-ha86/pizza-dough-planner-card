# 🍕 Pizza-Teigplaner – Karte für Home Assistant

[![Marketplace: Benutzerdefiniert](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://github.com/florian-ha86/pizza-dough-planner-card)
[![Release](https://img.shields.io/github/v/release/florian-ha86/pizza-dough-planner-card)](https://github.com/florian-ha86/pizza-dough-planner-card/releases)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-green.svg)](LICENSE)

**[🇬🇧 English version](README.md)**

Eine Dashboard-Karte für Home Assistant, die deinen Pizzateig **rückwärts ab der Essenszeit** plant. Du legst fest, wann die Pizza fertig sein soll – die Karte berechnet Zutaten und Zeitplan, und ein optionaler Blueprint erinnert dich an jeden Schritt.

---

## ✨ Funktionen

| | |
|---|---|
| 🍕 **Pizza-Garuhr** | Eine gezeichnete Pizza, deren Rand mit der Zeit „bräunt“. Die Schritte sind Symbole rundherum – Antippen zeigt Uhrzeit und Details. |
| ⚖️ **Rezeptrechner** | Mehl, Wasser, Salz und Hefe in Gramm aus Anzahl, Teiglinggewicht, Hydration und Salzanteil. |
| 🫙 **Triebmittel** | Frischhefe, Trockenhefe oder **Lievito Madre**. Mehl und Wasser im Lievito Madre werden automatisch abgezogen, Gewicht und Hydration bleiben korrekt. |
| 🌡️ **Hefe-Schätzung** | Aus Gärzeit, Raum- und Kühlschranktemperatur, mit Korrekturfaktor zum Feintuning. |
| 🧊 **Eiswürfel** | Einen Teil des Wassers als Eis einplanen – als fester Anteil oder automatisch nach Zieltemperatur des Teigs. Gesamtwasser und Hydration bleiben gleich. |
| ⏱️ **Zeitplan** | Kneten → Stretch & Fold (optional) → Ballen formen → Kühlgare (optional) → Akklimatisieren → Ofen anheizen → Pizza. |
| 🌾 **Mehl-Datenbank** | Eiweiß, W-Wert und ideale Garzeit gängiger Mehle, mit Ampel, ob dein Plan zum Mehl passt. Erweiterbar. |
| 📋 **Rezepte** | Vorlagen (Neapolitanisch, Römisch, Schnell, Canotto, 48 h) und drei Speicherplätze für eigene Teige. |
| 📅 **Datum & Uhrzeit** | Tagesleiste mit Wochentag und Datum, Schnellzeiten und ±15 Minuten – direkt in der Karte. |
| 🔥 **Ofen-Bereich** | Vorheizzeit und Wettervorhersage zur Backzeit (optional). |
| 🔔 **Erinnerungen** | Der Blueprint schickt zu jedem Schritt eine Benachrichtigung und schaltet den Plan danach ab. |

Hell- und Dunkelmodus · für Tablet und Handy · keine externen Abrufe · keine weiteren Zusatzkarten nötig.

---

## 📦 Voraussetzungen

- Home Assistant **2024.11** oder neuer
- **Ein Text-Helfer** (`input_text`) mit **maximaler Länge 255**
- Optional: Raumtemperatur-Sensor, Wetter-Integration mit Vorhersage, ein Benachrichtigungsdienst

---

## 🚀 Installation

### Über den Marketplace (ehemals HACS)

1. **Einstellungen → Marketplace** öffnen.
2. Im Menü **Benutzerdefinierte Repositories** wählen und  
   `https://github.com/florian-ha86/pizza-dough-planner-card` mit der Kategorie **Dashboard** hinzufügen.
3. **Pizza Dough Planner Card** installieren und den Browser neu laden.

### Manuell

1. `pizza-dough-planner-card.js` aus dem [aktuellen Release](https://github.com/florian-ha86/pizza-dough-planner-card/releases) (oder aus `dist/`) herunterladen und nach `/config/www/` kopieren.
2. **Einstellungen → Dashboards → ⋮ → Ressourcen → Ressource hinzufügen**  
   URL: `/local/pizza-dough-planner-card.js` · Typ: **JavaScript-Modul**.

---

## 🛠️ Einrichtung

### 1. Speicher-Helfer anlegen

**Einstellungen → Geräte & Dienste → Helfer → Helfer erstellen → Text**

- Name: z. B. `Pizza Teigplaner`
- **Maximale Länge: 255** ⚠️ der Standardwert 100 reicht nicht

### 2. Karte hinzufügen

Dashboard bearbeiten → **Karte hinzufügen** → **Pizza-Teigplaner**, dann im Editor den Helfer auswählen. Am schönsten in einer **Panel-Ansicht** oder in voller Breite.

```yaml
type: custom:pizza-dough-planner-card
entity: input_text.pizza_teigplaner
temperature_entity: sensor.kueche_temperatur   # optional
weather_entity: weather.home                   # optional
title: Nächster Pizzaabend                     # optional
oven_name: Pizzaofen                           # optional
```

| Option | Pflicht | Standard | Beschreibung |
|---|:---:|---|---|
| `entity` | ✅ | – | Text-Helfer, der alle Einstellungen speichert (max. Länge 255) |
| `temperature_entity` | | – | Raumtemperatur für die Hefe-Schätzung; ohne Sensor wird ein einstellbarer Ersatzwert genutzt |
| `weather_entity` | | – | Wettervorhersage zur Backzeit |
| `title` | | `Nächster Pizzaabend` | Überschrift |
| `oven_name` | | `Pizzaofen` | Name deines Ofens |

### 3. Erinnerungen einrichten (optional)

[![Home Assistant öffnen und den Blueprint-Import anzeigen.](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fflorian-ha86%2Fpizza-dough-planner-card%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fpizza_dough_planner_reminders.yaml)

1. Blueprint importieren und daraus eine Automation erstellen.
2. **Denselben Speicher-Helfer** wie in der Karte auswählen.
3. Bei **Benachrichtigung** eine Aktion einfügen – z. B. *Benachrichtigung senden* ans Handy – mit `{{ title }}` als Titel und `{{ message }}` als Text.
4. Optional denselben Temperatursensor wie in der Karte wählen, damit die Hefemengen übereinstimmen.

In der Karte **„Erinnerungen an“** einschalten. Du bekommst eine Vorwarnung mit Zutatenliste und danach Nachrichten zum Kneten, Stretch & Fold, Ballen formen, Kühlschrank, Ofen und zur Essenszeit. Danach schaltet sich der Plan von selbst ab.

---

## 🌾 Eigene Mehle ergänzen

`/config/www/pizza-flours.js` anlegen (siehe [`examples/eigene-mehle.js`](examples/eigene-mehle.js)) und als zusätzliche Ressource vom Typ **JavaScript-Modul** einbinden:

```js
window.PIZZA_FLOURS = Object.assign(window.PIZZA_FLOURS || {}, {
  'Mein Mehl': { p: '12,5 %', w: '280', min: 12, max: 36, hmin: 60, hmax: 68, tip: 'Eigener Eintrag.' }
});
```

`p` Eiweiß · `w` W-Wert · `min`/`max` ideale Gesamtgare in Stunden · `hmin`/`hmax` übliche Hydration in % · `tip` kurzer Hinweis.

---

## 🧮 So wird gerechnet

Alle Einstellungen liegen als kompaktes JSON im Text-Helfer – jedes Gerät zeigt denselben Plan, und der Blueprint liest dieselben Daten. Karte und Blueprint rechnen identisch:

- **Teig:** Gesamt = Pizzen × Teiglinggewicht; Mehl = Gesamt ÷ (1 + Hydration + Salz + Hefe).
- **Lievito Madre:** Anteil am Gesamtmehl; Mehl und Wasser darin (aus der LM-Hydration) werden von den Hauptmengen abgezogen.
- **Hefe:** effektive Stunden = Raumstunden × 2^((T − 21)/6) + Kühlschrankstunden × 2^((T<sub>Kühlschrank</sub> − 21)/6); Frischhefe ≈ 4 % ÷ Stunden<sup>1,25</sup> × Korrektur; Trockenhefe = Frischhefe ÷ 3.
- **Eis:** fester Anteil vom Wasser oder automatisch: nötige Wassertemperatur = 3 × Zieltemperatur Teig − Raumtemperatur − Mehltemperatur − Erwärmung beim Kneten; ist sie kälter als das Leitungswasser, Eisanteil = (Leitung − nötig) ÷ (Leitung + 80).
- **Zeitplan:** Kneten = Essenszeit − (Akklimatisieren + Kühlgare + Stockgare); jeder Schritt wird von der Essenszeit zurückgerechnet.

---

## ⚠️ Hinweise

- Die **Hefemenge ist eine Schätzung**. Geht dein Teig regelmäßig zu schnell oder zu langsam, die Hefe-Korrektur anpassen.
- Die **Mehldaten** sind Herstellerangaben bzw. typische Werte – maßgeblich ist die Angabe auf der Packung.
- **Eigene Teige** werden im Browser gespeichert, der **aktuelle Plan** im Helfer – er ist also auf allen Geräten gleich.

---

## 📄 Lizenz

[MIT](LICENSE) © florian-ha86
