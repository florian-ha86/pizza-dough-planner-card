/*!
 * Pizza Dough Planner Card for Home Assistant
 * Plans pizza dough backwards from the time you want to eat.
 * License: MIT
 */
const PDP_VERSION = '1.1.0';
console.info(`%c PIZZA-DOUGH-PLANNER %c ${PDP_VERSION} `, 'background:#8DA68A;color:#fff;border-radius:3px 0 0 3px;padding:2px 4px', 'background:#333;color:#fff;border-radius:0 3px 3px 0;padding:2px 4px');

/* ---------- Data model (stored as compact JSON in one input_text helper, max 255) ----------
 n  pizzas            g  dough ball weight (g)   h  hydration (%)     s  salt (%)
 y  leavening F|T|L   la levain share (%)       lh levain hydration (%)
 sg bulk until balls (h)   sf stretch & fold after (h)   kg cold retard (h)   st room proof / acclimatise (h)
 o  oven preheat (min)     k  yeast correction (%)       kt fridge temp (°C)  rt room temp fallback (°C)
 em ice mode O|F|A (off / fixed share / automatic)   ea ice share (%)   tz target dough temp (°C)   tl tap water temp (°C)   tr kneading heat-up (°C)
 m  flour name        r  recipe name   e  eating time (unix seconds)   a  reminders active (0/1)
 The reminder blueprint reads the same keys – keep both in sync. */
const DEF = { n: 4, g: 260, h: 65, s: 2.8, y: 'F', la: 15, lh: 50, sg: 1.5, sf: 1, kg: 24, st: 4, o: 20, k: 100, kt: 7, rt: 21, em: 'O', ea: 30, tz: 23, tl: 12, tr: 12, m: 'Caputo Pizzeria (blau)', r: 'Neapolitanisch', e: null, a: 0 };
const LIM = { n: [1, 20, 1, 'Stück'], g: [120, 650, 5, 'g'], h: [50, 85, 0.5, '%'], s: [1, 4, 0.1, '%'], la: [3, 40, 1, '%'], lh: [40, 120, 5, '%'], sg: [0, 24, 0.5, 'h'], sf: [0, 6, 0.25, 'h'], kg: [0, 96, 1, 'h'], st: [0, 12, 0.5, 'h'], o: [0, 120, 5, 'min'], k: [50, 200, 5, '%'], kt: [1, 12, 0.5, '°C'], rt: [16, 30, 0.5, '°C'], ea: [0, 60, 5, '%'], tz: [18, 27, 0.5, '°C'], tl: [2, 25, 1, '°C'], tr: [0, 20, 1, '°C'] };
const ORDER = ['n', 'g', 'h', 's', 'y', 'la', 'lh', 'sg', 'sf', 'kg', 'st', 'o', 'k', 'kt', 'rt', 'em', 'ea', 'tz', 'tl', 'tr', 'm', 'r', 'e', 'a'];
const YEAST = { F: 'Frischhefe', T: 'Trockenhefe', L: 'Lievito Madre' };
const ICEMODES = { O: 'Aus', F: 'Fester Anteil', A: 'Automatisch' };

/* Flour data are typical / manufacturer values – the package is authoritative.
   Add your own flours without touching this file:
   window.PIZZA_FLOURS = Object.assign(window.PIZZA_FLOURS || {}, { 'Mein Mehl': {p:'12 %', w:'–', min:8, max:24, hmin:58, hmax:65, tip:'…'} }); */
const FLOURS = {
  'Caputo Pizzeria (blau)': { p: '12,5 %', w: '260–270', min: 8, max: 24, hmin: 55, hmax: 65, tip: 'Der Klassiker für Neapolitanisch. Ideal für 8–24 h, Kühlschrankgare bis etwa 24 h.' },
  'Caputo Pizzeria (rot, 1 kg)': { p: '13 %', w: 'keine Angabe', min: 12, max: 48, hmin: 58, hmax: 68, tip: 'Rote 1-kg-Haushaltspackung (13 g Eiweiß laut Nährwerttabelle). Ohne W-Angabe – Garbereich aus dem Eiweiß abgeleitet.' },
  'Caputo Nuvola': { p: '12,5 %', w: '270–290', min: 8, max: 24, hmin: 60, hmax: 70, tip: 'Tipo 0 für besonders luftige Ränder (Canotto). Laut Hersteller für Gare bis 24 h.' },
  'Caputo Nuvola Super': { p: '13,5 %', w: '320–340', min: 36, max: 48, hmin: 62, hmax: 72, tip: 'Stärkere Nuvola-Variante, laut Hersteller für 36–48 h – auch für Biga und Poolish.' },
  'Caputo Cuoco (rot)': { p: '13 %', w: '300–320', min: 24, max: 72, hmin: 60, hmax: 70, tip: 'Kräftiges Mehl für lange Kühlgare und höhere Hydration.' },
  'Le 5 Stagioni Napoletana': { p: '12,5 %', w: '260–280', min: 8, max: 24, hmin: 55, hmax: 65, tip: 'Für 8–24 h, gut verträglich mit kurzer Kühlgare.' },
  'Le 5 Stagioni Superiore': { p: 'ca. 13,5 %', w: 'ca. 360', min: 48, max: 96, hmin: 62, hmax: 75, tip: 'Sehr starkes Mehl – spielt seine Stärke erst ab etwa 48 h Gare aus.' },
  'Italiamo Nuvola (Lidl)': { p: '13 %', w: 'keine Angabe', min: 24, max: 48, hmin: 62, hmax: 70, tip: 'Tipo 0 (Aktionsware). Ohne W-Angabe – Erfahrungswerte: um 65 % Hydration, 24–48 h kalte Gare.' },
  'Italiamo Doppio Zero (Lidl)': { p: '12 %', w: 'keine Angabe', min: 8, max: 36, hmin: 58, hmax: 65, tip: 'Tipo 00 (Aktionsware). Ideal bis etwa 24 h Kühlgare, maximal rund 36 h.' },
  'Frießinger La Farina 14': { p: '14 %', w: 'keine Angabe', min: 24, max: 72, hmin: 60, hmax: 70, tip: 'Tipo 00, laut Hersteller für 1–3 Tage Teigruhe.' },
  'Frießinger Pizzamehl Tipo 00': { p: '12 %', w: 'keine Angabe', min: 8, max: 48, hmin: 58, hmax: 65, tip: 'Hersteller nennt 1–3 Tage, mit 12 % Eiweiß ist bis etwa 48 h realistischer.' },
  'Tipo 00 (allgemein)': { p: '10–12 %', w: 'ca. 180–250', min: 6, max: 24, hmin: 55, hmax: 65, tip: 'Supermarkt-Tipo-00 ohne W-Angabe ist meist eher schwach – besser nicht über 24 h.' },
  'Manitoba': { p: '14–15 %', w: '350–400+', min: 48, max: 96, hmin: 65, hmax: 78, tip: 'Sehr stark. Für Langzeitgare oder als Beimischung zu schwächerem Mehl.' },
  'Weizenmehl Type 550': { p: '10–12 %', w: 'ca. 180–220', min: 4, max: 24, hmin: 58, hmax: 65, tip: 'Gute deutsche Alternative. Kühlgare bis etwa 24 h.' },
  'Weizenmehl Type 405': { p: '9–10 %', w: 'ca. 130–170', min: 2, max: 8, hmin: 55, hmax: 62, tip: 'Schwaches Haushaltsmehl – nur für kurze Gare am selben Tag.' },
  'Weizenmehl Type 1050': { p: '11–12 %', w: 'keine Angabe', min: 4, max: 24, hmin: 62, hmax: 70, tip: 'Mehr Schalenanteil, nimmt mehr Wasser. Eher bis 24 h.' },
  'Dinkelmehl Type 630': { p: '11–12 %', w: 'weicher Kleber', min: 2, max: 12, hmin: 55, hmax: 62, tip: 'Dinkelkleber ist empfindlich: kurz kneten, kurze Gare, nicht zu nass.' }
};
const fl = () => Object.assign({}, FLOURS, window.PIZZA_FLOURS || {});
const PRESETS = [
  { name: 'Neapolitanisch', v: { h: 65, s: 2.8, g: 260, sg: 1.5, sf: 1, kg: 24, st: 4, m: 'Caputo Pizzeria (blau)' } },
  { name: 'Römisch (dünn)', v: { h: 60, s: 2.5, g: 180, sg: 1.5, sf: 1, kg: 24, st: 3, m: 'Tipo 00 (allgemein)' } },
  { name: 'Schnell (gleicher Tag)', v: { h: 63, s: 2.5, g: 250, sg: 4, sf: 1, kg: 0, st: 2, m: 'Caputo Pizzeria (blau)' } },
  { name: 'Canotto (luftig)', v: { h: 70, s: 2.8, g: 270, sg: 1.5, sf: 1, kg: 24, st: 4, m: 'Caputo Nuvola' } },
  { name: '48 h Kühlgare', v: { h: 68, s: 2.8, g: 260, sg: 1.5, sf: 1, kg: 48, st: 4, m: 'Caputo Cuoco (rot)' } }
];
const COND = { 'clear-night': 'klar', cloudy: 'bewölkt', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter mit Regen', partlycloudy: 'teils bewölkt', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'sonnig', windy: 'windig', 'windy-variant': 'windig, bewölkt', exceptional: 'Unwetter' };
const ICO = {
  mixer: '<path d="M3.5 21h17M17.5 21V6.5"/><path d="M17.5 6.5H8.5A3.5 3.5 0 0 0 5 10v1h12.5"/><path d="M10.5 11v3.2"/><path d="M5.5 14h10a5 5 0 0 1-10 0z"/>',
  fold: '<path d="M4.5 16.5c0-3.2 3.3-5.3 7.5-5.3s7.5 2.1 7.5 5.3-3.3 4-7.5 4-7.5-.8-7.5-4z"/><path d="M12 9V2.8M9.4 5.4 12 2.8l2.6 2.6"/>',
  balls: '<circle cx="7" cy="16.2" r="3.8"/><circle cx="17" cy="16.2" r="3.8"/><circle cx="12" cy="8.2" r="3.8"/>',
  fridge: '<rect x="5.5" y="2.5" width="13" height="19" rx="2.2"/><path d="M5.5 10h13M8.8 5.4v2.2M8.8 12.8v3.4"/>',
  oven: '<path d="M2.8 17.5a9.2 8.6 0 0 1 18.4 0z"/><path d="M8.3 17.5a3.7 3.1 0 0 1 7.4 0z"/><path d="M2.2 17.5h19.6v2.6H2.2z"/><path d="M12 13.2c-.9.9-.9 1.9 0 2.6.9-.7.9-1.7 0-2.6z" fill="#E8893A" stroke="none"/>',
  pizza: '<path d="M12 2.8 4.2 19.6c5.1 2 10.5 2 15.6 0z" fill="#E7B65A" stroke="#B9782F"/><circle cx="11.3" cy="12.6" r="1.7" fill="#C2412D" stroke="none"/><circle cx="14.4" cy="16.9" r="1.5" fill="#C2412D" stroke="none"/><circle cx="8.9" cy="17.4" r="1.4" fill="#C2412D" stroke="none"/>'
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const pad = n => String(n).padStart(2, '0');
const HOUR = 3600000;
const DAYS_AHEAD = 21;
const QUICKTIMES = ['12:00', '13:00', '18:00', '19:00', '20:00'];
const OPENKEY = 'pizza-dough-planner-open';
const RECKEY = 'pizza-dough-planner-recipes';
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

/* Shared calculation – mirrored in the reminder blueprint. */
function calc(d, roomT) {
  const tot = d.n * d.g, h = d.h / 100, s = d.s / 100;
  if (d.y === 'L') {
    const F = tot / (1 + h + s), p = d.la / 100, lh = d.lh / 100;
    const yeast = F * p, lmF = yeast / (1 + lh), lmW = yeast - lmF;
    return { flour: F - lmF, water: Math.max(F * h - lmW, 0), salt: F * s, yeast, pct: d.la, lmF, lmW };
  }
  const eff = (d.sg + d.st) * 2 ** ((roomT - 21) / 6) + d.kg * 2 ** ((d.kt - 21) / 6);
  let p = 4 / Math.max(eff, 0.5) ** 1.25 * d.k / 100;
  p = Math.min(Math.max(p, 0.02), 3.5);
  if (d.y === 'T') p /= 3;
  const flour = tot / (1 + h + s + p / 100);
  return { flour, water: flour * h, salt: flour * s, yeast: flour * p / 100, pct: p, lmF: 0, lmW: 0 };
}
/* Ice cubes: part of the (unchanged) total water is added as ice. Mirrored in the blueprint. */
function iceCalc(d, water, roomT) {
  const tw = 3 * d.tz - roomT - roomT - d.tr; let f = 0;
  if (d.em === 'F') f = d.ea / 100;
  else if (d.em === 'A') f = tw >= d.tl ? 0 : Math.min(0.6, (d.tl - tw) / (d.tl + 80));
  return { ice: Math.min(water, Math.round(water * f)), tw };
}
function times(d) {
  if (!d.e) return {};
  const E = d.e * 1000, kneten = E - (d.st + d.kg + d.sg) * HOUR;
  return {
    kneten, sf: d.sf > 0 && d.sf < d.sg ? kneten + d.sf * HOUR : null,
    kuehl: d.kg > 0 ? E - (d.st + d.kg) * HOUR : null, formen: E - d.st * HOUR, ofen: E - d.o * 60000, essen: E
  };
}

class PizzaDoughPlannerCard extends HTMLElement {
  static getConfigForm() {
    return {
      schema: [
        { name: 'entity', required: true, selector: { entity: { filter: [{ domain: 'input_text' }] } } },
        { name: 'temperature_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'temperature' }] } } },
        { name: 'weather_entity', selector: { entity: { filter: [{ domain: 'weather' }] } } },
        { name: 'title', selector: { text: {} } },
        { name: 'oven_name', selector: { text: {} } }
      ],
      computeLabel: s => ({ entity: 'Speicher-Helfer (Text, max. 255 Zeichen)', temperature_entity: 'Raumtemperatur-Sensor (optional)', weather_entity: 'Wetter-Integration (optional)', title: 'Überschrift', oven_name: 'Name des Ofens' }[s.name] || s.name),
      computeHelper: s => ({ entity: 'Speichert alle Einstellungen. Denselben Helfer im Erinnerungs-Blueprint auswählen.', temperature_entity: 'Ohne Sensor wird ein einstellbarer Ersatzwert verwendet.', weather_entity: 'Zeigt die Vorhersage zur Backzeit.' }[s.name])
    };
  }
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find(k => k.startsWith('input_text.') && k.includes('pizza'));
    return { entity: e || '', title: 'Nächster Pizzaabend', oven_name: 'Pizzaofen' };
  }
  setConfig(c) { this._c = Object.assign({ title: 'Nächster Pizzaabend', oven_name: 'Pizzaofen' }, c || {}); if (!this._open) this._open = lsGet(OPENKEY, {}); if (this._subs) { this._unsub(); } if (this._hass) { this._subscribe(); this._render(); } }
  getCardSize() { return 18; }
  getGridOptions() { return { columns: 'full', min_columns: 6 }; }
  connectedCallback() { this._tick = setInterval(() => this._safe(), 30000); if (this._hass && !this._subs) this._subscribe(); }
  disconnectedCallback() { clearInterval(this._tick); clearTimeout(this._selT); this._unsub(); }
  _unsub() { (this._subs || []).forEach(p => p.then(u => u && u()).catch(() => { })); this._subs = null; this._fc = null; }
  _subscribe() {
    const w = this._c && this._c.weather_entity; this._subs = [];
    if (!w || !this._hass || !this._hass.connection) return; this._fc = {};
    this._subs = ['hourly', 'daily'].map(ft => this._hass.connection.subscribeMessage(m => { this._fc[ft] = m.forecast || []; this._safe(); }, { type: 'weather/subscribe_forecast', entity_id: w, forecast_type: ft }).catch(() => null));
  }
  set hass(h) {
    const old = this._hass; this._hass = h; if (!this._c) return; if (!this._subs) this._subscribe();
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' }); const r = this.shadowRoot;
      r.addEventListener('click', e => this._click(e)); r.addEventListener('change', e => this._change(e));
      r.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('g[data-a]')) { e.preventDefault(); this._click(e); } });
      r.addEventListener('focusout', () => setTimeout(() => { if (this._pending) { this._pending = false; this._safe(); } }, 250));
      this._render(); return;
    }
    const ids = [this._c.entity, this._c.temperature_entity, this._c.weather_entity].filter(Boolean);
    if (!old || ids.some(id => old.states[id] !== h.states[id])) this._safe();
  }
  _safe() { if (!this.shadowRoot) return; const a = this.shadowRoot.activeElement; if (a && a.tagName === 'INPUT') { this._pending = true; return; } this._render(); }
  /* ---- state ---- */
  _read() {
    const o = this._hass && this._hass.states[this._c.entity];
    if (!o || ['unknown', 'unavailable', ''].includes(o.state)) return Object.assign({}, DEF);
    try { return Object.assign({}, DEF, JSON.parse(o.state)); } catch (e) { return Object.assign({}, DEF); }
  }
  get d() { return this._local || this._read(); }
  _ser(d) {
    const o = {}; ORDER.forEach(k => { let v = d[k]; if (typeof v === 'number') v = Math.round(v * 100) / 100; o[k] = v; });
    const max = (this._hass.states[this._c.entity] || { attributes: {} }).attributes.max || 255;
    let js = JSON.stringify(o); if (js.length > max) { o.r = ''; js = JSON.stringify(o); } if (js.length > max) { o.m = ''; js = JSON.stringify(o); }
    return js;
  }
  _write(d) {
    this._local = d; this._render(); clearTimeout(this._wt);
    this._wt = setTimeout(() => {
      const val = this._ser(d); this._err = '';
      this._hass.callService('input_text', 'set_value', { entity_id: this._c.entity, value: val })
        .catch(err => { this._err = 'Speichern fehlgeschlagen: ' + (err && err.message ? err.message : err); this._render(); })
        .finally(() => setTimeout(() => { if (this._local === d) { this._local = null; this._safe(); } }, 1500));
    }, 400);
  }
  set(patch) {
    const d = Object.assign({}, this.d, patch);
    Object.keys(patch).forEach(k => { if (LIM[k]) { const [mn, mx, st] = LIM[k]; let v = Math.min(mx, Math.max(mn, Number(patch[k]))); v = Math.round(v / st) * st; d[k] = parseFloat(v.toFixed(2)); } });
    this._write(d);
  }
  roomT() { const id = this._c.temperature_entity; const v = id && this._hass.states[id] ? parseFloat(this._hass.states[id].state) : NaN; return isNaN(v) ? null : v; }
  /* ---- helpers ---- */
  wd(d) { return d.toLocaleDateString('de-DE', { weekday: 'long' }); }
  hm(d) { return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
  sd(d) { return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + this.hm(d); }
  ftxt(d) { return d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' + this.hm(d) + ' Uhr'; }
  dur(ms) { const m = Math.round(Math.abs(ms) / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60; return d ? `${d} T ${h} h` : h ? `${h} h ${mi} min` : `${mi} min`; }
  rel(ms) { return ms >= 0 ? 'in ' + this.dur(ms) : 'vor ' + this.dur(ms); }
  base() { const d = this.d; if (d.e) return new Date(d.e * 1000); const x = new Date(); x.setHours(19, 0, 0, 0); return x; }
  setDT(x) { this.set({ e: Math.floor(x.getTime() / 1000) }); }
  recipes() { const r = lsGet(RECKEY, []); return Array.isArray(r) ? r : []; }
  /* ---- events ---- */
  _click(e) {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, k = b.dataset.k; const d = this.d;
    switch (a) {
      case 'inc': case 'dec': this.set({ [k]: d[k] + (a === 'inc' ? LIM[k][2] : -LIM[k][2]) }); break;
      case 'preset': { const p = PRESETS[+b.dataset.i]; this.set(Object.assign({}, p.v, { r: p.name })); break; }
      case 'slot': { const r = this.recipes()[+b.dataset.i]; if (r) { const v = Object.assign({}, r); delete v.e; delete v.a; this.set(v); } break; }
      case 'yeast': this.set({ y: b.dataset.v }); break;
      case 'ice': this.set({ em: b.dataset.v }); break;
      case 'plan': this.set({ a: d.a ? 0 : 1 }); break;
      case 'day': { const bs = this.base(); const x = new Date(); x.setHours(bs.getHours(), bs.getMinutes(), 0, 0); x.setDate(x.getDate() + (+b.dataset.d)); this._centerDay = true; this.setDT(x); break; }
      case 'time': { const [h, m] = b.dataset.t.split(':').map(Number); const x = this.base(); x.setHours(h, m, 0, 0); this.setDT(x); break; }
      case 'tadj': { const x = this.base(); x.setMinutes(x.getMinutes() + (+b.dataset.m)); this.setDT(x); break; }
      case 'rs': { const i = +b.dataset.i; this._sel = (i < 0 || this._sel === i) ? null : i; clearTimeout(this._selT); if (this._sel != null) this._selT = setTimeout(() => { this._sel = null; this._render(); }, 15000); this._render(); break; }
      case 'sect': this._open[k] = !this._open[k]; lsSet(OPENKEY, this._open); this._render(); break;
      case 'savemode': this._save = !this._save; this._render(); break;
      case 'saveto': { const inp = this.shadowRoot.getElementById('savename'); const name = ((inp && inp.value) || d.r || 'Mein Teig').trim().slice(0, 30); const r = this.recipes(); const v = Object.assign({}, d, { r: name }); delete v.e; delete v.a; r[+b.dataset.i] = v; lsSet(RECKEY, r); this._save = false; this.set({ r: name }); break; }
      case 'clear': { const r = this.recipes(); r[+b.dataset.i] = null; lsSet(RECKEY, r); this._render(); break; }
    }
  }
  _change(e) {
    const t = e.target;
    if (t.dataset.a === 'num') { const v = parseFloat(String(t.value).replace(',', '.')); if (!isNaN(v)) this.set({ [t.dataset.k]: v }); }
    else if (t.dataset.a === 'flour') this.set({ m: t.value });
  }
  /* ---- partials ---- */
  stepper(label, k, dec, note) {
    const [, , , u] = LIM[k];
    return `<div class="stp"><div class="sl">${label}${note ? `<small>${note}</small>` : ''}</div><div class="ctl"><button class="sb" data-a="dec" data-k="${k}" aria-label="${label} verringern">−</button><input class="num" data-a="num" data-k="${k}" inputmode="decimal" value="${fmt(this.d[k], dec)}" aria-label="${label}"><span class="u">${u}</span><button class="sb" data-a="inc" data-k="${k}" aria-label="${label} erhöhen">+</button></div></div>`;
  }
  pane(k, title, meta, body) { const o = !!this._open[k]; return `<section class="panel pane ${o ? 'open' : ''}"><button class="paneh" data-a="sect" data-k="${k}" aria-expanded="${o}"><span class="pt">${title}</span><span class="pm">${meta}</span><span class="chev">${o ? '−' : '+'}</span></button>${o ? `<div class="paneb">${body}</div>` : ''}</section>`; }
  picker(essen) {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); let selOff = null;
    if (essen) { const e0 = new Date(essen.getFullYear(), essen.getMonth(), essen.getDate()); selOff = Math.round((e0 - t0) / 86400000); }
    const max = Math.max(DAYS_AHEAD, (selOff || 0) + 1); let days = '';
    for (let o = 0; o < max; o++) {
      const x = new Date(t0); x.setDate(x.getDate() + o); const wdS = o === 0 ? 'Heute' : o === 1 ? 'Morgen' : x.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''); const we = x.getDay() === 0 || x.getDay() === 6;
      days += `<button class="dch ${o === selOff ? 'on' : ''} ${we ? 'we' : ''}" data-a="day" data-d="${o}" aria-label="${x.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}"><span class="dw">${wdS}</span><span class="dn">${x.getDate()}</span><span class="dm">${x.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</span></button>`;
    }
    const cur = essen ? this.hm(essen) : '19:00';
    return `<div class="picker"><div class="plabel">Tag</div><div class="daysc">${days}</div><div class="plabel">Uhrzeit</div><div class="trow"><div class="tctl"><button class="sb" data-a="tadj" data-m="-15" aria-label="15 Minuten früher">−</button><span class="tval">${cur}</span><button class="sb" data-a="tadj" data-m="15" aria-label="15 Minuten später">+</button></div><div class="tchips">${QUICKTIMES.map(t => `<button class="tch ${t === cur ? 'on' : ''}" data-a="time" data-t="${t}">${t}</button>`).join('')}</div></div></div>`;
  }
  forecastAt(dt) {
    if (!dt || !this._fc) return null; const t = dt.getTime();
    const pick = (arr, maxDiff) => { if (!arr || !arr.length) return null; let best = null, bd = Infinity; for (const f of arr) { const x = Math.abs(new Date(f.datetime).getTime() - t); if (x < bd) { bd = x; best = f; } } return bd <= maxDiff ? best : null; };
    const h = pick(this._fc.hourly, 90 * 60000); if (h) return { f: h, type: 'stündliche Vorhersage' };
    const dl = pick(this._fc.daily, 24 * HOUR); return dl ? { f: dl, type: 'Tagesvorhersage' } : null;
  }
  ring(steps, essen, now, warn) {
    const V = 360, cx = 180, cy = 180, rc = 105, C = 2 * Math.PI * rc, L = C * 300 / 360, RB = 152;
    const t0 = steps[0].d ? steps[0].d.getTime() : null, tE = essen ? essen.getTime() : null; const ok = t0 && tE && tE > t0;
    const prog = ok ? Math.max(0, Math.min(1, (now - t0) / (tE - t0))) : 0;
    const P = (a, r) => { const x = a * Math.PI / 180; return [(cx + r * Math.cos(x)).toFixed(1), (cy + r * Math.sin(x)).toFixed(1)]; };
    const nextIdx = steps.findIndex(s => s.d && s.d.getTime() > now);
    const sp = steps.map((s, i) => 120 + 300 * i / Math.max(1, steps.length - 1)); const bakeA = 120 + 300 * prog;
    const spots = [132, 150, 171, 196, 223, 247, 268, 291, 317, 342, 366, 389, 408].filter(a => a <= bakeA).map((a, k) => { const [x, y] = P(a, rc + (k % 3 - 1) * 5); return `<circle cx="${x}" cy="${y}" r="${2 + (k % 2)}" fill="#4a2a12" opacity=".55"/>`; }).join('');
    const cheese = [95, 150, 205, 262, 318, 15].map((a, k) => { const [x, y] = P(a, 82); return `<circle cx="${x}" cy="${y}" r="${9 + (k % 3) * 2}" fill="#F4EAD5"/>`; }).join('');
    const basil = [125, 235, 345, 55].map(a => { const [x, y] = P(a, 85); return `<ellipse cx="${x}" cy="${y}" rx="8" ry="4.2" fill="#3F7A3A" transform="rotate(${a + 60} ${x} ${y})"/>`; }).join('');
    const sel = this._sel;
    const badges = steps.map((s, i) => { const [x, y] = P(sp[i], RB); const cls = i === nextIdx ? 'bn' : (nextIdx < 0 || i < nextIdx) ? 'bd' : 'bf'; return `<g class="bdg ${cls} ${sel === i ? 'sel' : ''}" data-a="rs" data-i="${i}" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="${s.t}${s.d ? ', ' + this.ftxt(s.d) : ''}"><circle r="${i === nextIdx ? 25 : 22}"/><g transform="translate(-12 -12)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICO[s.ic] || ''}</g></g>`; }).join('');
    const intro = !this._intro; this._intro = true; const S = sel != null ? steps[sel] : null; let center;
    if (S) center = `<div class="rc-k">${S.t}</div><div class="rc-v sm">${S.d ? this.hm(S.d) : '–'}</div><div class="rc-s">${S.d ? S.d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '<br>' + this.rel(S.d.getTime() - now) : ''}</div>`;
    else if (!essen) center = `<div class="rc-k">Noch kein Termin</div><div class="rc-v">🍕</div><div class="rc-s">Tag und Uhrzeit wählen</div>`;
    else if (warn) center = `<div class="rc-k">Zeit reicht nicht</div><div class="rc-v warnc">!</div><div class="rc-s">Termin anpassen</div>`;
    else if (nextIdx >= 0) { const n = steps[nextIdx]; center = `<div class="rc-k">${n.t}</div><div class="rc-v">${this.dur(n.d.getTime() - now)}</div><div class="rc-s">${n.d.toLocaleDateString('de-DE', { weekday: 'short' })}, ${this.hm(n.d)} Uhr</div>`; }
    else center = `<div class="rc-k">Fertig</div><div class="rc-v">Buon appetito</div>`;
    const info = S ? `<div class="rinfo"><div class="ri-h"><b>${S.t}</b><button class="ri-x" data-a="rs" data-i="-1" aria-label="Schließen">×</button></div><div class="ri-t">${S.d ? `${this.ftxt(S.d)} · ${this.rel(S.d.getTime() - now)}` : 'Keine Zeit berechnet'}</div><p>${S.sub}</p></div>` : `<p class="rhint">Tippe auf ein Symbol für Details.</p>`;
    const bake = prog > 0.005 ? `<circle class="bake ${intro ? 'intro' : ''}" cx="${cx}" cy="${cy}" r="${rc}" transform="rotate(120 ${cx} ${cy})" stroke-dasharray="${(L * prog).toFixed(1)} ${C.toFixed(1)}" style="--l:${(L * prog).toFixed(1)}px;--c:${C.toFixed(1)}px"/>` : '';
    return `<div class="rwrap"><div class="ring"><svg viewBox="0 0 ${V} ${V}"><circle cx="${cx}" cy="${cy}" r="117" fill="#E6C38D"/>${bake}${spots}<circle cx="${cx}" cy="${cy}" r="94" fill="#C2412D"/>${cheese}${basil}<circle cx="${cx}" cy="${cy}" r="69" fill="#F7F1E4"/>${badges}<circle cx="${cx}" cy="${cy}" r="69" fill="transparent" data-a="rs" data-i="-1"/></svg><div class="rc">${center}</div></div>${info}</div>`;
  }
  flourEval(total) {
    const f = fl()[this.d.m]; if (!f) return null; let cls, st, short;
    if (total > f.max) { cls = 'bad'; short = 'Gare zu lang'; st = `${fmt(total, 1)} h Gesamtgare sind zu lang für dieses Mehl (bis ${f.max} h). Der Teig kann schlaff werden – kürzer kühlen oder ein stärkeres Mehl nehmen.`; }
    else if (total < f.min) { cls = 'info'; short = 'Gare eher kurz'; st = `${fmt(total, 1)} h Gesamtgare sind kürzer als ideal (ab ${f.min} h). Klappt trotzdem, ein schwächeres Mehl passt aber besser.`; }
    else { cls = 'ok'; short = 'passt'; st = `${fmt(total, 1)} h Gesamtgare passen zu diesem Mehl.`; }
    return { f, cls, st, short };
  }
  flourBox(total, hyd) {
    const F = fl(), cur = this.d.m, ev = this.flourEval(total);
    const opts = (F[cur] ? [] : [`<option selected value="${esc(cur)}">${esc(cur || '– Mehl wählen –')}</option>`]).concat(Object.keys(F).map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`)).join('');
    const sel = `<select class="sel" data-a="flour" aria-label="Mehlsorte">${opts}</select>`; if (!ev) return sel; const { f, cls, st } = ev;
    let hw = ''; if (hyd > f.hmax) hw = `<div class="note info">Mit ${fmt(hyd, 1)} % Hydration wird der Teig sehr weich – üblich sind ${f.hmin}–${f.hmax} %.</div>`; else if (hyd < f.hmin) hw = `<div class="note info">${fmt(hyd, 1)} % Hydration liegen unter dem üblichen Bereich von ${f.hmin}–${f.hmax} %.</div>`;
    const MAXH = 96, l = f.min / MAXH * 100, w = (f.max - f.min) / MAXH * 100, mk = Math.min(total, MAXH) / MAXH * 100;
    const best = Object.entries(F).filter(([k, v]) => total >= v.min && total <= v.max && k !== cur).map(([k]) => k);
    return `${sel}<div class="facts"><div><span>Eiweiß</span><b>${esc(f.p)}</b></div><div><span>W-Wert</span><b>${esc(f.w)}</b></div><div><span>Gare</span><b>${f.min}–${f.max} h</b></div><div><span>Hydration</span><b>${f.hmin}–${f.hmax} %</b></div></div>
<div class="gbar"><div class="grng" style="left:${l}%;width:${w}%"></div><div class="gmk ${cls}" style="left:${mk}%"><span>${fmt(total, 1)} h</span></div></div><div class="gax"><span>0</span><span>24</span><span>48</span><span>72</span><span>96 h</span></div>
<div class="note ${cls}">${st}</div>${hw}<p class="small">${esc(f.tip)}</p>${best.length && cls !== 'ok' ? `<p class="small">Passt zu ${fmt(total, 1)} h: ${best.map(esc).join(', ')}.</p>` : ''}<p class="small">Richtwerte nach Herstellerangaben bzw. typischen Werten – maßgeblich ist die Angabe auf der Packung.</p>`;
  }
  ovenBox(essen, ofenD) {
    const d = this.d, we = this._c.weather_entity, ws = we && this._hass.states[we];
    let wx = '<p class="small">Für Wetterinfos zur Backzeit im Karten-Editor eine Wetter-Integration auswählen.</p>', rain = false, shield = false;
    if (ws) {
      const t = ws.attributes.temperature, w = ws.attributes.wind_speed, wu = ws.attributes.wind_speed_unit || 'km/h', tu = ws.attributes.temperature_unit || '°C';
      const fc = this.forecastAt(essen); let fcH;
      if (fc) {
        const f = fc.f, pp = f.precipitation_probability; rain = (pp != null && pp >= 50) || ['rainy', 'pouring', 'lightning-rainy', 'snowy', 'snowy-rainy', 'hail'].includes(f.condition); shield = (f.temperature != null && f.temperature < 10) || (f.wind_speed != null && f.wind_speed > 20);
        fcH = `<div class="wx"><div><span>Temperatur</span><b>${f.temperature != null ? fmt(f.temperature, 0) + ' ' + tu : '–'}</b></div><div><span>Wetter</span><b>${esc(COND[f.condition] || f.condition || '–')}</b></div><div><span>Regen</span><b>${pp != null ? fmt(pp, 0) + ' %' : '–'}</b></div><div><span>Wind</span><b>${f.wind_speed != null ? fmt(f.wind_speed, 0) + ' ' + wu : '–'}</b></div></div><p class="small">${fc.type} für ${this.ftxt(essen)}.</p>`;
      } else fcH = `<p class="small">Die Vorhersage für den Backtermin erscheint, sobald er im Vorhersagezeitraum liegt.</p>`;
      wx = `<div class="ovs">Jetzt draußen ${t != null ? fmt(t, 1) + ' ' + tu : '–'}, ${esc(COND[ws.state] || ws.state || '')}, Wind ${w != null ? fmt(w, 0) + ' ' + wu : '–'}</div><h4>Zur Backzeit</h4>${fcH}`;
    }
    return `<div class="ovtop"><div class="flame">${fmt(d.o)}<small>min</small></div><div><div class="ovt">Vorheizen</div><div class="ovs">${ofenD ? `Anheizen ${ofenD.toLocaleDateString('de-DE', { weekday: 'short' })}, ${this.hm(ofenD)} Uhr` : '–'}</div></div></div>${wx}
${rain ? `<div class="note bad">Regen oder Schnee möglich – Unterstand für den Ofen einplanen.</div>` : ''}${shield ? `<div class="note info">Kalt oder windig – Ofen windgeschützt stellen, ggf. länger vorheizen.</div>` : ''}`;
  }
  iceBox(raum, ic, water) {
    const d = this.d, eis = ic.ice;
    const segs = Object.entries(ICEMODES).map(([k, v]) => `<button class="${d.em === k ? 'on' : ''}" data-a="ice" data-v="${k}">${v}</button>`).join('');
    let body;
    if (d.em === 'F') body = `${this.stepper('Anteil als Eis', 'ea', 0, 'vom Gesamtwasser')}<p class="small">${eis > 0 ? `${fmt(eis)} g Eiswürfel und ${fmt(water - eis)} g eiskaltes Wasser.` : 'Kein Eis eingeplant.'}</p>`;
    else if (d.em === 'A') body = `${this.stepper('Teig nach dem Kneten', 'tz', 1, 'Zieltemperatur')}${this.stepper('Leitungswasser', 'tl', 0, 'Temperatur aus dem Hahn')}${this.stepper('Erwärmung beim Kneten', 'tr', 0, 'einmal mit Thermometer messen')}<div class="note ${eis > 0 ? 'info' : 'ok'}">${eis > 0 ? `Nötige Wassertemperatur ${fmt(ic.tw, 1)} °C – kälter als dein Leitungswasser (${fmt(d.tl)} °C). Dafür ${fmt(eis)} g Eiswürfel einplanen.` : `Nötige Wassertemperatur ${fmt(ic.tw, 1)} °C – kaltes Leitungswasser (${fmt(d.tl)} °C) reicht, kein Eis nötig.`}</div><p class="small">Mehl wird mit Raumtemperatur (${fmt(raum, 1)} °C) angenommen.</p>`;
    else body = '<p class="small">Das ganze Wasser wird flüssig zugegeben.</p>';
    return `<div class="sub2">Wasser & Eis</div><div class="seg" role="group" aria-label="Eis">${segs}</div>${body}`;
  }
  setup(msg) {
    this.shadowRoot.innerHTML = `<style>.s{padding:20px;border-radius:16px;background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);font:inherit;line-height:1.5}.s b{display:block;font-size:1.1rem;margin-bottom:6px}.s ol{margin:8px 0 0;padding-left:20px}</style><div class="s"><b>🍕 Pizza-Teigplaner einrichten</b>${msg}<ol><li>Einstellungen → Geräte & Dienste → Helfer → Helfer erstellen → <i>Text</i>.</li><li>Name z. B. „Pizza Teigplaner“, <b style="display:inline;font-size:inherit">Maximale Länge 255</b>.</li><li>Den Helfer im Karten-Editor unter „Speicher-Helfer“ auswählen.</li></ol></div>`;
  }
  /* ---- render ---- */
  _render() {
    if (!this._hass || !this.shadowRoot || !this._c) return;
    const ent = this._c.entity, eo = ent && this._hass.states[ent];
    if (!ent || !eo) { this.setup(ent ? `<div>Der Helfer <code>${esc(ent)}</code> wurde nicht gefunden.</div>` : '<div>Es ist noch kein Speicher-Helfer ausgewählt.</div>'); return; }
    if (!ent.startsWith('input_text.')) { this.setup('<div>Der Speicher-Helfer muss ein Text-Helfer (input_text) sein.</div>'); return; }
    const now = Date.now(); const oldSc = this.shadowRoot.querySelector('.daysc'); const keepScroll = oldSc && !this._centerDay ? oldSc.scrollLeft : null;
    const d = this.d, isLM = d.y === 'L', yLabel = YEAST[d.y] || YEAST.F, mehlsorte = d.m || 'Mehl';
    const live = this.roomT(), raum = live != null ? live : d.rt;
    const c = calc(d, raum), T = times(d), ic = iceCalc(d, c.water, raum), eis = ic.ice, wfl = c.water - eis;
    const dt = v => v == null ? null : new Date(v);
    const essen = dt(T.essen), total = d.sg + d.kg + d.st, ofenD = dt(T.ofen);
    const hDec = isLM ? 0 : 2, pDec = isLM ? 0 : 3;
    const steps = [
      { ic: 'mixer', t: 'Teig kneten', d: dt(T.kneten), sub: `${fmt(c.flour)} g ${esc(mehlsorte)}, ${eis > 0 ? `${fmt(wfl)} g eiskaltes Wasser, ${fmt(eis)} g Eiswürfel` : `${fmt(c.water)} g Wasser`}, ${fmt(c.salt, 1)} g Salz und ${fmt(c.yeast, hDec)} g ${yLabel} zu einem glatten Teig kneten${eis > 0 ? ' (Eis gleich am Anfang dazugeben)' : ''} und abgedeckt ruhen lassen.` },
      T.sf ? { ic: 'fold', t: 'Stretch & Fold', d: dt(T.sf), sub: `Teig dehnen, falten und wieder abdecken. ${fmt((d.sg - d.sf) * 60)} min später werden die Ballen geformt.` } : null,
      d.kg > 0 ? { ic: 'balls', t: 'Ballen formen', d: dt(T.kuehl), sub: `${fmt(d.n)} Ballen à ${fmt(d.g)} g abstechen, rund schleifen und ${fmt(d.kg)} h bei ${fmt(d.kt, 1)} °C in den Kühlschrank.` } : null,
      d.kg > 0 ? { ic: 'fridge', t: 'Aus dem Kühlschrank', d: dt(T.formen), sub: `Teiglinge rausnehmen und ${fmt(d.st, 1)} h abgedeckt bei Raumtemperatur akklimatisieren lassen.` } : { ic: 'balls', t: 'Ballen formen', d: dt(T.formen), sub: `${fmt(d.n)} Ballen à ${fmt(d.g)} g formen, rund schleifen und ${fmt(d.st, 1)} h gehen lassen.` },
      { ic: 'oven', t: `${esc(this._c.oven_name)} anheizen`, d: ofenD, sub: `${fmt(d.o)} min vorheizen.` },
      { ic: 'pizza', t: 'Pizza', d: essen, sub: 'Einschießen, backen, genießen.' }
    ].filter(Boolean);
    if (this._sel != null && this._sel >= steps.length) this._sel = null;
    const nextIdx = steps.findIndex(s => s.d && s.d.getTime() > now), kn = steps[0].d; let warn = '';
    if (essen && essen.getTime() < now) warn = 'Die Essenszeit liegt in der Vergangenheit. Wähle einen neuen Termin.';
    else if (kn && kn.getTime() < now) warn = `Für diesen Termin hättest du ${this.rel(kn.getTime() - now)} kneten müssen. Verschieb die Essenszeit oder wähl eine kürzere Gare, zum Beispiel „Schnell“.`;
    const maxLen = eo.attributes.max || 100; const lenWarn = maxLen < 230 ? `<div class="warn">Der Speicher-Helfer erlaubt nur ${maxLen} Zeichen. Bitte in den Helfer-Einstellungen die maximale Länge auf 255 setzen, sonst können Einstellungen verloren gehen.</div>` : '';
    const tl = steps.map((s, i) => { const cls = nextIdx < 0 || i < nextIdx ? 'done' : i === nextIdx ? 'next' : ''; return `<li class="${cls}"><div class="tt">${s.d ? `<b>${this.hm(s.d)}</b><span>${s.d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>` : '–'}</div><div class="tm"><div class="th">${s.t}${i === nextIdx && s.d ? `<em>${this.rel(s.d.getTime() - now)}</em>` : ''}</div><div class="ts">${s.sub}</div></div></li>`; }).join('');
    const recs = this.recipes();
    const presets = PRESETS.map((p, i) => `<button class="chip ${p.name === d.r ? 'on' : ''}" data-a="preset" data-i="${i}">${esc(p.name)}</button>`).join('');
    const slots = [0, 1, 2].map(i => { const r = recs[i]; return r ? `<button class="chip own ${r.r === d.r ? 'on' : ''}" data-a="slot" data-i="${i}">★ ${esc(r.r)}</button>` : `<span class="chip empty">Platz ${i + 1} frei</span>`; }).join('');
    const saveBox = this._save ? `<div class="save"><input id="savename" class="txt" maxlength="30" placeholder="Name für deinen Teig" value="${esc(d.r)}">${[0, 1, 2].map(i => { const r = recs[i]; return `<div class="srow"><button class="btn" data-a="saveto" data-i="${i}">Auf Platz ${i + 1} speichern</button><span class="occ">${r ? 'ersetzt „' + esc(r.r) + '“' : 'frei'}</span>${r ? `<button class="x" data-a="clear" data-i="${i}" aria-label="Platz ${i + 1} leeren">Leeren</button>` : ''}</div>`; }).join('')}<p class="small">Eigene Teige werden in diesem Browser gespeichert.</p></div>` : '';
    const tot = c.flour + c.water + c.salt + c.yeast || 1; const seg = (v, cl) => `<i class="${cl}" style="flex-basis:${Math.max(v / tot * 100, 0.8).toFixed(2)}%"></i>`;
    const raumRow = live != null ? `<div class="stp"><div class="sl">Raumtemperatur<small>live vom Sensor</small></div><div class="lv">${fmt(live, 1)} °C</div></div>` : this.stepper('Raumtemperatur', 'rt', 1, 'kein Sensor – fester Wert');
    const recipeBody = `<div class="chips">${presets}</div><div class="sub2">Meine Teige</div><div class="chips">${slots}</div><button class="btn ghost" data-a="savemode">${this._save ? 'Abbrechen' : 'Aktuellen Teig speichern'}</button>${saveBox}`;
    const lmBody = isLM ? `<div class="sub2">Lievito Madre</div>${this.stepper('Anteil', 'la', 0, 'vom Gesamtmehl')}${this.stepper('LM-Hydration', 'lh', 0, '50 % fest, 100 % flüssig (Licoli)')}<p class="small">Richtwert: etwa 15–20 % bei kurzer Gare im Raum, etwa 5–10 % bei 24 h oder mehr im Kühlschrank. Mehl und Wasser im Lievito Madre werden automatisch abgezogen.</p>` : '';
    const teigBody = `${this.stepper('Pizzen', 'n', 0)}${this.stepper('Teigling', 'g', 0)}${this.stepper('Hydration', 'h', 1, isLM ? 'gesamt, inkl. Lievito Madre' : '')}${this.stepper('Salz', 's', 1)}${lmBody}${this.iceBox(raum, ic, c.water)}`;
    const gareBody = `${raumRow}${this.stepper('Kühlschrank', 'kt', 1)}${this.stepper('Stretch & Fold nach', 'sf', 2, '0 = kein Stretch & Fold')}${this.stepper('Ballen nach', 'sg', 1, 'Stockgare bei Raumtemperatur')}${this.stepper('Kühlgare', 'kg', 0, '0 = ohne Kühlschrank')}${this.stepper('Akklimatisieren', 'st', 1, 'bzw. Stückgare bei Raumtemperatur')}${isLM ? '' : this.stepper('Hefe-Korrektur', 'k', 0, 'wenn der Teig zu schnell oder langsam geht')}${this.stepper('Vorheizen', 'o', 0)}<p class="small">Die Hefemenge ist eine Schätzung aus Gärzeit und Temperaturen.</p>`;
    const fe = this.flourEval(total), nx = nextIdx >= 0 ? steps[nextIdx] : null;
    const metaAblauf = !essen ? 'kein Termin' : nx && nx.d ? `Als Nächstes: ${nx.t}, ${this.sd(nx.d)}` : 'abgeschlossen';
    const metaOfen = `${fmt(d.o)} min${ofenD ? `, anheizen ${this.sd(ofenD)}` : ''}`;
    const metaMehl = `${fe ? `<i class="sdot ${fe.cls}"></i>` : ''}${esc(mehlsorte)}${fe ? `, ${fe.short}` : ''}`;
    const metaTeig = `${fmt(d.n)} × ${fmt(d.g)} g, ${fmt(d.h, 1)} %${isLM ? `, LM ${fmt(c.pct, 0)} %` : ''}${eis > 0 ? `, ${fmt(eis)} g Eis` : ''}`;
    this.shadowRoot.innerHTML = `<style>${PizzaDoughPlannerCard.css}</style>
<div class="wrap">
<section class="panel hero"><div>
<div class="kicker">${esc(this._c.title)}</div>
<h2 class="when">${essen ? `${this.wd(essen)}, ${this.hm(essen)}<span>${essen.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}</span>` : 'Termin wählen'}</h2>
<div class="meta">${esc(d.r || 'Eigener Teig')} mit ${esc(mehlsorte)}${isLM ? ' und Lievito Madre' : ''}<br>${fmt(d.n)} Pizzen à ${fmt(d.g)} g</div>
${this.picker(essen)}
<button class="toggle ${d.a ? 'on' : ''}" data-a="plan" aria-pressed="${!!d.a}"><span class="sw"></span><span><b>Erinnerungen ${d.a ? 'an' : 'aus'}</b><small>${d.a ? 'Der Erinnerungs-Blueprint meldet sich bei jedem Schritt' : 'Einschalten, damit der Erinnerungs-Blueprint dich erinnert'}</small></span></button>
${warn ? `<div class="warn">${warn}</div>` : ''}${lenWarn}${this._err ? `<div class="warn">${esc(this._err)}</div>` : ''}
</div>${this.ring(steps, essen, now, warn)}</section>
<section class="panel dough"><h3>Zutaten</h3>
<div class="qty">
<div class="q"><span><i class="cf"></i>${esc(mehlsorte)}</span><b>${fmt(c.flour)}<small>g</small></b></div>
<div class="q"><span><i class="cw"></i>Wasser${eis > 0 ? ' eiskalt' : ''}${isLM || eis > 0 ? '' : `, ${fmt(d.h, 1)} %`}</span><b>${fmt(wfl)}<small>g</small></b></div>
${eis > 0 ? `<div class="q"><span><i class="ci"></i>Eiswürfel</span><b>${fmt(eis)}<small>g</small></b></div>` : ''}
<div class="q"><span><i class="cs"></i>Salz, ${fmt(d.s, 1)} %</span><b>${fmt(c.salt, 1)}<small>g</small></b></div>
<div class="q"><span><i class="cy"></i>${yLabel}, ${fmt(c.pct, pDec)} %</span><b>${fmt(c.yeast, hDec)}<small>g</small></b></div>
</div>
<div class="stack" aria-hidden="true">${seg(c.flour, 'cf')}${seg(wfl, 'cw')}${eis > 0 ? seg(eis, 'ci') : ''}${seg(c.salt, 'cs')}${seg(c.yeast, 'cy')}</div>
${eis > 0 ? `<p class="lmnote">${fmt(c.water)} g Wasser gesamt (${fmt(d.h, 1)} %), davon ${fmt(eis)} g als Eiswürfel. Kleine Würfel oder Crushed Ice gleich am Anfang mit dem Wasser in die Schüssel geben.</p>` : ''}
${isLM ? `<p class="lmnote">Im Lievito Madre stecken bereits ${fmt(c.lmF)} g Mehl und ${fmt(c.lmW)} g Wasser – die sind oben schon abgezogen. Die Gesamthydration bleibt bei ${fmt(d.h, 1)} %.</p>` : ''}
<div class="drow"><span>${fmt(d.n * d.g)} g Teig gesamt, Raum ${fmt(raum, 1)} °C, Kühlschrank ${fmt(d.kt, 1)} °C</span><div class="seg" role="group" aria-label="Triebmittel">${Object.entries(YEAST).map(([k, v]) => `<button class="${d.y === k ? 'on' : ''}" data-a="yeast" data-v="${k}">${v}</button>`).join('')}</div></div>
</section>
<div class="list">
${this.pane('mehl', 'Mehl', metaMehl, this.flourBox(total, d.h))}
${this.pane('rezept', 'Rezept', esc(d.r || ''), recipeBody)}
${this.pane('teig', 'Teig', metaTeig, teigBody)}
${this.pane('gare', 'Gare & Temperatur', `${fmt(total, 1)} h gesamt`, gareBody)}
${this.pane('ofen', esc(this._c.oven_name), metaOfen, this.ovenBox(essen, ofenD))}
${this.pane('ablauf', 'Ablauf', metaAblauf, `<ol class="tl">${tl}</ol>`)}
</div></div>`;
    const sc = this.shadowRoot.querySelector('.daysc');
    if (sc) { if (keepScroll != null) sc.scrollLeft = keepScroll; else { const on = sc.querySelector('.dch.on'); if (on) sc.scrollLeft = Math.max(0, on.offsetLeft - sc.offsetLeft - 70); } }
    this._centerDay = false;
  }
}
PizzaDoughPlannerCard.css = `
:host{display:block;--sage:#8DA68A;--sage-d:#6F8A6C;--sage-s:rgba(141,166,138,.16);--crust:#D08A4A;--crust-s:rgba(208,138,74,.14);--tomato:#D2553F;--flour:#E9E1D1;--water:#7FA7C4;--salt:#A9A49A;--yeast:#C9A46A;--line:rgba(127,127,127,.18);--fg:var(--primary-text-color);--mut:var(--secondary-text-color);--bg:var(--ha-card-background,var(--card-background-color,#1f1f1f));--disp:var(--ha-font-family-heading,system-ui),system-ui,sans-serif}
*{box-sizing:border-box}
.wrap{max-width:1180px;margin:0 auto;padding:14px;color:var(--fg);display:grid;gap:18px}
.panel{background:var(--bg);border-radius:16px;box-shadow:var(--ha-card-box-shadow,0 8px 24px rgba(0,0,0,.28));padding:20px}
h2,h3,h4{font-family:var(--disp);margin:0;font-weight:600;letter-spacing:-.01em}
h3{font-size:1.15rem}
h4{font-size:.95rem;margin:18px 0 8px;color:var(--mut);font-weight:600}
button{font:inherit;color:inherit}
button:focus-visible,input:focus-visible,select:focus-visible,g[data-a]:focus-visible{outline:2px solid var(--sage);outline-offset:2px}
.hero{border-radius:24px;padding:26px;display:grid;gap:22px;grid-template-columns:1fr;align-items:center}
.hero>div{min-width:0}
@media(min-width:820px){.hero{grid-template-columns:1fr 1.05fr}}
.kicker{font-size:.95rem;color:var(--mut)}
.when{font-weight:800;font-size:clamp(2.2rem,5.5vw,3.6rem);line-height:1;letter-spacing:-.03em;margin:6px 0 10px}
.when span{display:block;font-weight:400;font-size:.45em;letter-spacing:0;color:var(--mut);margin-top:8px}
.meta{color:var(--mut);font-size:.95rem;line-height:1.5}
.picker{margin-top:18px;display:grid;gap:8px}
.plabel{font-size:.8rem;color:var(--mut)}
.daysc{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.daysc::-webkit-scrollbar{display:none}
.dch{flex:0 0 62px;scroll-snap-align:start;border:1px solid var(--line);background:transparent;border-radius:14px;padding:8px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px}
.dch .dw{font-size:.74rem;color:var(--mut);white-space:nowrap}
.dch .dn{font-family:var(--disp);font-weight:700;font-size:1.35rem;line-height:1.1}
.dch .dm{font-size:.72rem;color:var(--mut)}
.dch.we .dw{color:var(--crust)}
.dch.on{background:var(--sage);border-color:var(--sage);color:#fff}
.dch.on .dw,.dch.on .dm{color:#fff}
.trow{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tctl,.ctl{display:flex;align-items:center;background:var(--line);border-radius:999px;padding:3px}
.tval{font-family:var(--disp);font-weight:700;font-size:1.2rem;min-width:70px;text-align:center}
.tchips{display:flex;flex-wrap:wrap;gap:6px}
.tch{border:1px solid var(--line);background:transparent;border-radius:999px;padding:6px 11px;cursor:pointer;font-size:.85rem}
.tch.on{border-color:var(--sage);color:var(--sage)}
input.txt,select.sel{background:transparent;color:inherit;border:1px solid var(--line);border-radius:12px;padding:9px 12px;font:inherit;font-size:.95rem;color-scheme:light dark}
select.sel{width:100%;background:var(--bg);font-size:1rem}
.toggle{margin-top:18px;display:inline-flex;align-items:center;gap:12px;border:none;background:transparent;cursor:pointer;padding:0}
.sw{flex:0 0 46px;width:46px;height:26px;border-radius:999px;background:var(--line);position:relative;transition:background .2s}
.sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.toggle.on .sw{background:var(--sage)}.toggle.on .sw::after{transform:translateX(20px)}
.toggle b{font-weight:600}.toggle small{display:block;color:var(--mut);font-size:.8rem;text-align:left}
.warn{margin-top:16px;padding:12px 14px;border-radius:12px;background:rgba(210,85,63,.14);border-left:3px solid var(--tomato);font-size:.92rem;line-height:1.4}
.rwrap{display:grid;gap:10px;justify-items:center}
.ring{position:relative;width:100%;max-width:380px;aspect-ratio:1}
.ring svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 10px 18px rgba(0,0,0,.25))}
.bake{fill:none;stroke:#A35E27;stroke-width:22;stroke-linecap:butt;opacity:.9}
.bake.intro{animation:grow 1.4s cubic-bezier(.2,.7,.2,1)}
@keyframes grow{from{stroke-dasharray:0 var(--c)}to{stroke-dasharray:var(--l) var(--c)}}
@media(prefers-reduced-motion:reduce){.bake.intro{animation:none}}
.bdg{cursor:pointer;color:var(--fg)}
.bdg>circle{fill:var(--bg);stroke:var(--sage);stroke-width:2.5}
.bdg.bd>circle{fill:var(--sage)}.bdg.bd{color:#fff}
.bdg.bn>circle{stroke:var(--crust);stroke-width:4}
.bdg.sel>circle{stroke:var(--fg);stroke-width:4}
.rc{position:absolute;inset:32%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#3B2A1E;pointer-events:none}
.rc-k{font-size:.78rem;line-height:1.15}
.rc-v{font-family:var(--disp);font-weight:800;font-size:clamp(1.05rem,3vw,1.55rem);letter-spacing:-.02em;margin:3px 0;line-height:1.05}
.rc-v.sm{font-size:clamp(1.3rem,3.6vw,1.9rem)}
.rc-v.warnc{color:var(--tomato);font-size:2rem}
.rc-s{font-size:.72rem;line-height:1.25;opacity:.8}
.rinfo{width:100%;max-width:380px;background:var(--sage-s);border-radius:14px;padding:12px 14px}
.ri-h{display:flex;justify-content:space-between;align-items:center;gap:8px}.ri-h b{font-family:var(--disp);font-size:1.05rem}
.ri-x{border:none;background:transparent;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--mut);padding:0 4px}
.ri-t{font-size:.85rem;color:var(--mut);margin-top:2px}
.rinfo p{margin:8px 0 0;font-size:.9rem;line-height:1.45}
.rhint{margin:0;font-size:.8rem;color:var(--mut)}
.dough{display:grid;gap:16px}
.qty{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px 18px}
.q span{display:flex;align-items:center;gap:8px;color:var(--mut);font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.q span i{flex:0 0 10px;height:10px;border-radius:3px}
.q b{display:block;font-family:var(--disp);font-weight:800;font-size:clamp(1.9rem,4.5vw,2.6rem);letter-spacing:-.03em;line-height:1.1;margin-top:4px}
.q b small,.flame small{font-size:.45em;font-weight:400;color:var(--mut);margin-left:3px;letter-spacing:0}
.stack{display:flex;height:12px;border-radius:999px;overflow:hidden;gap:2px}
.stack i{display:block;height:100%}
.cf{background:var(--flour)}.cw{background:var(--water)}.ci{background:#B5D4F4}.cs{background:var(--salt)}.cy{background:var(--yeast)}
.drow{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;color:var(--mut);font-size:.88rem}
.seg{display:inline-flex;flex-wrap:wrap;background:var(--line);border-radius:999px;padding:3px}
.seg button{border:none;background:transparent;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:.86rem}
.seg button.on{background:var(--bg);box-shadow:0 1px 4px rgba(0,0,0,.25)}
.lmnote{font-size:.85rem;color:var(--mut);line-height:1.45;margin:0;padding:10px 12px;border-radius:10px;background:var(--sage-s)}
.list{display:grid;gap:14px}
.pane{padding:2px 20px}
.paneh{width:100%;display:flex;align-items:center;gap:12px;background:transparent;border:none;padding:16px 0;cursor:pointer;text-align:left}
.pt{font-family:var(--disp);font-weight:600;font-size:1.15rem;white-space:nowrap}
.pm{flex:1;min-width:0;text-align:right;color:var(--mut);font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chev{width:28px;height:28px;border-radius:50%;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;flex:0 0 28px;font-size:1.05rem}
.pane.open .chev{background:var(--sage);border-color:var(--sage);color:#fff}
.paneb{padding:2px 0 20px}
.sdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle;background:var(--sage)}
.sdot.bad{background:var(--tomato)}.sdot.info{background:var(--yeast)}
ol.tl{list-style:none;margin:0;padding:0;position:relative}
ol.tl::before{content:'';position:absolute;left:73px;top:10px;bottom:10px;width:2px;background:var(--line)}
ol.tl li{display:grid;grid-template-columns:62px 1fr;gap:22px;padding:9px 0;position:relative}
ol.tl li::before{content:'';position:absolute;left:68px;top:15px;width:12px;height:12px;border-radius:50%;background:var(--bg);border:2px solid var(--sage)}
ol.tl li.done{opacity:.5}ol.tl li.done::before{background:var(--sage)}
ol.tl li.next::before{border-color:var(--crust);border-width:3px;width:14px;height:14px;left:67px;top:14px}
.tt{text-align:right}.tt b{display:block;font-family:var(--disp);font-size:1.05rem;font-weight:600}.tt span{font-size:.75rem;color:var(--mut)}
.th{font-weight:600;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.th em{font-style:normal;font-size:.75rem;font-weight:600;color:var(--crust);background:var(--crust-s);padding:2px 8px;border-radius:999px}
.ts{font-size:.86rem;color:var(--mut);margin-top:3px;line-height:1.4}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--line);background:transparent;border-radius:999px;padding:8px 14px;cursor:pointer;font-size:.9rem}
.chip.on{background:var(--sage);border-color:var(--sage);color:#fff}
.chip.empty{border-style:dashed;color:var(--mut);cursor:default}
.sub2{margin:16px 0 8px;font-size:.88rem;color:var(--mut)}
.btn{border:1px solid var(--sage);background:transparent;border-radius:12px;padding:9px 14px;cursor:pointer;font-size:.9rem}
.btn.ghost{margin-top:14px;border-color:var(--line)}
.save{margin-top:12px;display:grid;gap:10px}
.srow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.occ{font-size:.82rem;color:var(--mut)}
.x{border:none;background:transparent;color:var(--tomato);cursor:pointer;font-size:.85rem}
.stp{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0}
.sl{font-size:.95rem}.sl small{display:block;font-size:.76rem;color:var(--mut)}
.lv{font-family:var(--disp);font-weight:600;font-size:1.1rem;padding-right:4px}
.sb{width:32px;height:32px;border-radius:50%;border:none;background:var(--bg);cursor:pointer;font-size:1.1rem;line-height:1}
.num{width:56px;text-align:right;background:transparent;color:inherit;border:none;font-family:var(--disp);font-size:1.05rem;font-weight:600}
.u{width:40px;padding-left:4px;font-size:.8rem;color:var(--mut)}
.facts,.wx{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.facts div,.wx div{border-left:2px solid var(--line);padding-left:10px}
.facts span,.wx span{display:block;font-size:.78rem;color:var(--mut)}
.facts b,.wx b{font-family:var(--disp);font-weight:600;font-size:1.02rem}
.gbar{position:relative;height:8px;border-radius:999px;background:var(--line);margin:34px 0 0}
.grng{position:absolute;top:0;height:100%;border-radius:999px;background:var(--sage)}
.gmk{position:absolute;top:-6px;width:3px;height:20px;margin-left:-1.5px;border-radius:2px;background:var(--fg)}
.gmk span{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);font-size:.75rem;font-weight:600;white-space:nowrap}
.gmk.bad{background:var(--tomato)}.gmk.bad span{color:var(--tomato)}
.gax{display:flex;justify-content:space-between;font-size:.7rem;color:var(--mut);margin-top:5px}
.note{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:.88rem;line-height:1.4;border-left:3px solid var(--sage);background:var(--sage-s)}
.note.bad{border-color:var(--tomato);background:rgba(210,85,63,.12)}
.note.info{border-color:var(--yeast);background:rgba(201,164,106,.14)}
.small{font-size:.82rem;color:var(--mut);line-height:1.45;margin:10px 0 0}
.ovtop{display:flex;gap:18px;align-items:center;margin-bottom:6px}
.flame{font-family:var(--disp);font-weight:800;font-size:2.8rem;letter-spacing:-.03em;color:var(--crust);line-height:1;display:flex;align-items:baseline;gap:4px}
.ovt{font-weight:600}.ovs{font-size:.86rem;color:var(--mut);margin-top:2px}
`;
if (!customElements.get('pizza-dough-planner-card')) customElements.define('pizza-dough-planner-card', PizzaDoughPlannerCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'pizza-dough-planner-card')) window.customCards.push({ type: 'pizza-dough-planner-card', name: 'Pizza-Teigplaner', description: 'Plant Pizzateig rückwärts ab der Essenszeit – mit Rezeptrechner, Mehl-Datenbank, Lievito Madre, Eiswürfel-Planung und Pizza-Garuhr.', preview: false, documentationURL: 'https://github.com/florian-ha86/pizza-dough-planner-card' });
