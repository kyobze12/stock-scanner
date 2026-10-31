(() => {
  "use strict";
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const html = htm.bind(React.createElement);

  /* ================= constants & helpers ================= */
  const PAGE = 60, CHUNK_ROWS = 20000, PARALLEL = 2;
  const STALE_MS = 24 * 3600 * 1000;      // re-download at least this often when the script can't report changes
  const CHECK_MS = 10 * 60 * 1000;        // ask the sheet "anything new?" at most this often
  const MAX_HITS = 1500, SCORE_LIMIT = 20000;
  const LS_KEY = "ftc-stock-scanner-v1";
  const WORKER_URL = "__WORKER_URL__";    // filled in by tools/build.mjs
  const ZXING_URL = "__ZXING_URL__";
  const SEP = "\u0001";
  const DIM_KEYS = ["dept", "subdept", "supplier", "category", "brand"];

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  // The item index is large (tens of MB), so it lives in IndexedDB, never localStorage.
  const idb = (() => {
    let p = null;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open("ftc-stock-scanner", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => { const t = db.transaction("kv", mode); const q = fn(t.objectStore("kv")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
    };
    return {
      async get(k) { try { return await tx("readonly", (s) => s.get(k)); } catch { return null; } },
      async set(k, v) { try { await tx("readwrite", (s) => s.put(v, k)); return true; } catch { return false; } },
      async del(k) { try { await tx("readwrite", (s) => s.delete(k)); } catch {} }
    };
  })();

  const num = (v) => { const x = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(x) ? x : 0; };
  const numOrNaN = (v) => { const s = String(v ?? "").trim(); if (s === "") return NaN; const x = parseFloat(s.replace(/[^0-9.\-]/g, "")); return isFinite(x) ? x : NaN; };
  const r2 = (x) => (x !== x ? "" : Math.round(x * 10000) / 10000);
  const qty = (v) => { const x = Number(v) || 0; return Number.isInteger(x) ? x.toLocaleString() : x.toLocaleString(undefined, { maximumFractionDigits: 2 }); };
  const money = (v, cur = "$") => (v === "" || v == null || isNaN(v) ? "—" : cur + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(60); } catch {} };
  const ago = (t) => {
    if (!t) return "never";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " h ago";
    return Math.round(h / 24) + " days ago";
  };
  const colLetter = (i) => { let s = "", n = i + 1; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const quoteTab = (t) => "'" + String(t).replace(/'/g, "''") + "'";
  // Keep the browser responsive during long loops: hand control back so taps and animations aren't blocked.
  const yieldToMain = () => ("scheduler" in window && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

  /* Lowercase and strip accents without changing the string's length, so offsets in the raw and search text line up. */
  const NON_ASCII = /[^\x00-\x7f]/;
  function fold(s) {
    s = String(s ?? "");
    if (!NON_ASCII.test(s)) return s.toLowerCase();
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      if (c.charCodeAt(0) < 128) out += c.toLowerCase();
      else out += (c.normalize("NFD").charAt(0).toLowerCase().charAt(0)) || c;
    }
    return out;
  }
  const clean = (v) => String(v ?? "").replace(/[\u0001\n\r\t]+/g, " ").trim();
  const facetVal = (v) => { const s = clean(v); return s === "-" || s === "#N/A" ? "" : s; };

  /* Columns in the item sheet, matched by header name so the sheet can gain or reorder columns. */
  const COLS = {
    code: ["ga_codearticle", "code", "item code", "sku"], barcode: ["barcode", "bar code", "upc", "ean"],
    name: ["item name", "description", "name"], supplier: ["supplier"], dept: ["department"], subdept: ["subdepartment"],
    trade: ["trade"], retail: ["retail", "selling price", "price"], brand: ["brand"], category: ["category"], subcategory: ["subcategory"],
    stock: ["phisyque", "physique", "stock", "qty"], gst: ["gst", "tax"], pmap: ["pmap", "avg cost"], uscost: ["us cost"],
    type: ["item type"], collection: ["ga_collection"], tracked: ["ga_tenuestock"], ref: ["ga_charlibre1"], dpa: ["ga_dpa"],
    byHowMany: ["by how many"], scale: ["scale item"]
  };
  const INDEX_FIELDS = ["code", "barcode", "name", "supplier", "dept", "subdept", "category", "brand", "retail", "stock", "pmap"];
  function mapColumns(header) {
    const h = header.map((x) => norm(x).trim());
    const map = {};
    for (const [f, names] of Object.entries(COLS)) { const i = h.findIndex((x) => names.includes(x)); if (i >= 0) map[f] = i; }
    return map;
  }

  const LEVEL = {
    out: { label: "Out", pill: "bg-bad-soft text-bad", num: "text-bad" },
    ok: { label: "In stock", pill: "bg-accent-soft text-accent", num: "text-fg" }
  };

  function sheetError(e) {
    const c = e && e.code;
    if (c === "not_connected") return { title: "Connect your sheet", text: "Add the connection link and key from your Google Sheet's Stock Scanner script in Settings.", settings: true };
    if (c === "bad_key") return { title: "Wrong connection key", text: "The sheet refused the key. Check the key in Settings matches the KEY line in the sheet's script.", settings: true };
    if (c === "no_tab") return { title: "Tab not found", text: "The script couldn't find the item tab. Check the TAB line in the sheet's script matches the tab name." };
    if (c === "network") return { title: "Can't reach the sheet", text: "Check your internet connection. If it keeps happening, make sure the script is deployed as a web app with access for Anyone.", retry: true };
    if (c === "bad_response") return { title: "The sheet didn't answer properly", text: "The connection link may be wrong. It should end in /exec. Check it in Settings.", settings: true };
    return { title: "Couldn't read the sheet", text: "The sheet's script reported: " + String((e && (e.message || e.code)) || "unknown error").slice(0, 160), retry: true };
  }

  /* ================= compact item index =================
     166,000 items as separate objects cost well over 100 MB of memory and seconds to rebuild. Instead the index is
     two long strings (raw text for display, folded text for searching, one line per item) plus typed arrays for the numbers
     and for each filter column (value ids into a small dictionary). It loads from storage in one step. */
  function packChunk(rows, start, pos, map) {
    const g = (f, v) => (map[f] === undefined ? "" : v[pos[map[f]]] ?? "");
    const o = { lines: [], hay: [], rows: [], stock: [], retail: [], pmap: [] };
    for (const k of DIM_KEYS) o[k] = [];
    for (let i = 0; i < rows.length; i++) {
      const v = rows[i];
      const code = clean(g("code", v)), barcode = clean(g("barcode", v));
      if (!code && !barcode) continue;
      const line = code + SEP + barcode + SEP + clean(g("name", v)) + SEP + clean(g("brand", v));
      o.lines.push(line); o.hay.push(fold(line));
      o.rows.push(start + i); o.stock.push(num(g("stock", v))); o.retail.push(numOrNaN(g("retail", v))); o.pmap.push(numOrNaN(g("pmap", v)));
      for (const k of DIM_KEYS) o[k].push(facetVal(g(k, v)));
    }
    return o;
  }
  async function assemble(parts) {
    parts = parts.filter((p) => p.rows.length);
    const n = parts.reduce((a, p) => a + p.rows.length, 0);
    const off = new Int32Array(n + 1), rows = new Int32Array(n);
    const stock = new Float64Array(n), retail = new Float64Array(n), pmap = new Float64Array(n);
    const dim = {}, dict = {}, maps = {};
    for (const k of DIM_KEYS) { dim[k] = new Uint32Array(n); dict[k] = [""]; maps[k] = new Map([["", 0]]); }
    let i = 0, pos = 1;
    for (const p of parts) {
      for (let j = 0; j < p.rows.length; j++, i++) {
        off[i] = pos; pos += p.lines[j].length + 1;
        rows[i] = p.rows[j]; stock[i] = p.stock[j]; retail[i] = p.retail[j]; pmap[i] = p.pmap[j];
      }
      for (const k of DIM_KEYS) {
        const m = maps[k], d = dict[k], arr = dim[k], base = i - p.rows.length, vals = p[k];
        for (let j = 0; j < vals.length; j++) { let id = m.get(vals[j]); if (id === undefined) { id = d.length; d.push(vals[j]); m.set(vals[j], id); } arr[base + j] = id; }
      }
      await yieldToMain();
    }
    off[n] = pos;
    const R = "\n" + parts.map((p) => p.lines.join("\n")).join("\n") + "\n";
    await yieldToMain();
    const H = "\n" + parts.map((p) => p.hay.join("\n")).join("\n") + "\n";
    return { v: 2, n, R, H, off, rows, stock, retail, pmap, dim, dict };
  }
  const dictMap = (db, k) => (db.maps || (db.maps = {}))[k] || (db.maps[k] = new Map(db.dict[k].map((v, i) => [v, i])));

  function itemAt(db, i) {
    const [code, barcode, name, brand] = db.R.slice(db.off[i], db.off[i + 1] - 1).split(SEP);
    const f = {}; for (const k of DIM_KEYS) f[k] = db.dict[k][db.dim[k][i]];
    return { idx: i, row: db.rows[i], code, barcode, name, brand, stock: db.stock[i], retail: r2(db.retail[i]), pmap: r2(db.pmap[i]), f };
  }
  function itemFromValues(v, map, row) {
    const g = (f) => (map[f] === undefined ? "" : String(v[map[f]] ?? "").trim());
    const f = {}; for (const k of DIM_KEYS) f[k] = facetVal(g(k));
    const r = g("retail"), p = g("pmap");
    return { idx: -1, row, code: g("code"), barcode: g("barcode"), name: g("name"), brand: g("brand"), stock: num(g("stock")), retail: r === "" ? "" : num(r), pmap: p === "" ? "" : num(p), f, extra: true };
  }
  const lineAt = (off, pos) => { let lo = 0, hi = off.length - 2; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (off[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  function rowIndex(db, row) { const a = db.rows; let lo = 0, hi = a.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] === row) return m; if (a[m] < row) lo = m + 1; else hi = m - 1; } return -1; }

  /* Exact barcode or item code. Tries the common leading-zero variants (UPC-A vs EAN-13). */
  function lookup(db, raw) {
    const q = fold(String(raw).trim()); if (!q) return -1;
    // Scanners and sheets disagree about leading zeros (UPC-A 12 digits, EAN-13 13 digits, codes stored with or without padding).
    const bare = q.replace(/^0+/, "");
    const cands = [...new Set([q, bare, ...(/^\d+$/.test(bare) ? [8, 12, 13, 14].filter((L) => L >= bare.length).map((L) => bare.padStart(L, "0")) : [])].filter(Boolean))];
    const { H, off } = db;
    for (const c of cands) {
      let p = H.indexOf("\n" + c + SEP);
      if (p >= 0) return lineAt(off, p + 1);
      p = 0;
      while ((p = H.indexOf(SEP + c + SEP, p)) >= 0) { const i = lineAt(off, p); if (H.indexOf(SEP, off[i]) === p) return i; p++; }
    }
    return -1;
  }

  const FILTER_DIMS = [["dept", "Department"], ["subdept", "Subdepartment"], ["supplier", "Supplier"], ["category", "Category"], ["brand", "Brand"]];
  const EMPTY_FILTERS = { dept: "", subdept: "", supplier: "", category: "", brand: "", stock: "", min: "", max: "" };
  const activeCount = (f) => Object.entries(f).filter(([, v]) => v !== "").length;
  // Non-column conditions (stock, price). Returns null when there are none.
  function extraTest(db, f) {
    const min = f.min === "" ? null : num(f.min), max = f.max === "" ? null : num(f.max);
    if (!f.stock && min === null && max === null) return null;
    const { stock, retail } = db;
    return (i) => (f.stock === "in" ? stock[i] > 0 : f.stock === "out" ? stock[i] <= 0 : true) && (min === null || retail[i] >= min) && (max === null || retail[i] <= max);
  }
  function makeFilter(db, f) {
    const conds = [];
    for (const k of DIM_KEYS) if (f[k] !== "") { const id = dictMap(db, k).get(f[k]); conds.push(id === undefined ? () => false : (i) => db.dim[k][i] === id); }
    const ex = extraTest(db, f); if (ex) conds.push(ex);
    if (!conds.length) return null;
    return (i) => { for (let c = 0; c < conds.length; c++) if (!conds[c](i)) return false; return true; };
  }
  /* Text search over the whole index with a handful of string scans instead of a loop over 166k objects:
     find the longest word with indexOf, then check the other words on just those lines. */
  function searchDb(db, rawQuery, f) {
    const words = fold(rawQuery).split(/\s+/).filter(Boolean);
    const fp = makeFilter(db, f);
    const exact = [], starts = [], rest = [];
    let total = 0;
    if (!words.length) {
      for (let i = 0; i < db.n; i++) if (!fp || fp(i)) { total++; if (rest.length < MAX_HITS) rest.push(i); }
      return { total, list: rest };
    }
    let anchor = words[0]; for (const w of words) if (w.length > anchor.length) anchor = w;
    const q = words.join(" "), { H, off } = db;
    let pos = 0, i = 0;
    for (;;) {
      pos = H.indexOf(anchor, pos); if (pos < 0) break;
      while (off[i + 1] <= pos) i++;
      const start = off[i], end = off[i + 1] - 1;
      let ok = true;
      if (words.length > 1) { const line = H.slice(start, end); for (const w of words) if (w !== anchor && !line.includes(w)) { ok = false; break; } }
      if (ok && (!fp || fp(i))) {
        total++;
        if (total <= SCORE_LIMIT) {     // rank exact code/barcode first, then names that start with the query
          const s1 = H.indexOf(SEP, start), s2 = H.indexOf(SEP, s1 + 1);
          if (H.startsWith(q + SEP, start) || H.startsWith(q + SEP, s1 + 1)) { exact.push(i); }
          else if (H.startsWith(q, s2 + 1)) { if (starts.length < MAX_HITS) starts.push(i); }
          else if (rest.length < MAX_HITS) rest.push(i);
        } else if (rest.length < MAX_HITS) rest.push(i);
      }
      pos = off[i + 1];
    }
    return { total, list: exact.concat(starts, rest).slice(0, MAX_HITS) };
  }
  /* Option counts for every filter column in one pass: an option's count ignores its own column's choice, so the
     other options stay visible as you pick. */
  function facetsDb(db, f) {
    const counts = {}; for (const k of DIM_KEYS) counts[k] = new Uint32Array(db.dict[k].length);
    const want = DIM_KEYS.map((k) => (f[k] === "" ? -1 : (dictMap(db, k).get(f[k]) ?? -2)));
    const arrs = DIM_KEYS.map((k) => db.dim[k]), cnt = DIM_KEYS.map((k) => counts[k]), D = DIM_KEYS.length;
    const ex = extraTest(db, f);
    let match = 0;
    for (let i = 0; i < db.n; i++) {
      if (ex && !ex(i)) continue;
      let fails = 0, which = -1;
      for (let d = 0; d < D; d++) if (want[d] !== -1 && arrs[d][i] !== want[d]) { fails++; which = d; if (fails > 1) break; }
      if (fails === 0) { match++; for (let d = 0; d < D; d++) cnt[d][arrs[d][i]]++; }
      else if (fails === 1) cnt[which][arrs[which][i]]++;
    }
    const options = {};
    for (const k of DIM_KEYS) {
      const out = [], c = counts[k], dict = db.dict[k];
      for (let id = 1; id < c.length; id++) if (c[id] > 0) out.push([dict[id], c[id]]);
      out.sort((a, b) => b[1] - a[1]); options[k] = out;
    }
    return { match, options };
  }

  /* ================= sheet connection (Apps Script web app) ================= */
  const validUrl = (u) => /^https:\/\/script\.google(usercontent)?\.com\//.test(u || "");
  // A staff setup link carries the connection after #connect=  (base64 of "url|key").
  function connFromText(text) {
    const m = String(text || "").match(/connect=([^&\s]+)/);
    if (!m) return null;
    try {
      const [url, key] = atob(decodeURIComponent(m[1]).replace(/ /g, "+")).split("|");
      return validUrl(url) && key ? { url, key } : null;
    } catch { return null; }
  }
  function takeConnectHash() {
    const c = connFromText(location.hash);
    if (c) { ls.set(LS_KEY + ":conn", c); history.replaceState(null, "", location.pathname + location.search); }
    return c;
  }
  const setupLink = (conn) => location.origin + location.pathname + "#connect=" + encodeURIComponent(btoa(conn.url + "|" + conn.key));

  function useSheet() {
    const [conn, setConn] = useState(() => { takeConnectHash(); return ls.get(LS_KEY + ":conn") || { url: "", key: "" }; });
    const [db, setDb] = useState(null);
    const [extras, setExtras] = useState([]);       // items found by scanning that the saved list doesn't have yet
    const [meta, setMeta] = useState({ syncedAt: 0, checkedAt: 0, header: [], map: {}, updated: "", lastRow: 0 });
    const [status, setStatus] = useState({ kind: "loading" });
    const connRef = useRef(conn); connRef.current = conn;
    const dbRef = useRef(db); dbRef.current = db;
    const extrasRef = useRef(extras); extrasRef.current = extras;
    const metaRef = useRef(meta); metaRef.current = meta;
    const syncing = useRef(false);
    const photoIdx = useRef(null);
    const connected = !!(conn.url && conn.key);
    const cacheKey = "idx4:" + conn.url;

    const api = useCallback(async (action, params = {}) => {
      const c = connRef.current;
      if (!c.url || !c.key) throw { code: "not_connected" };
      let res;
      try { res = await fetch(c.url + "?" + new URLSearchParams({ action, key: c.key, ...params }), { redirect: "follow" }); }
      catch { throw { code: "network" }; }
      let data;
      try { data = await res.json(); } catch { throw { code: "bad_response" }; }
      if (data && data.error) throw { code: data.error, message: data.error };
      return data;
    }, []);

    const loadMeta = useCallback(async () => {
      const m0 = await api("meta");
      const header = m0.header || [], map = mapColumns(header);
      if (map.code === undefined && map.barcode === undefined) throw { code: "no_columns", message: "The first row needs a GA_CODEARTICLE or BARCODE column." };
      const m = { ...metaRef.current, header, map };
      metaRef.current = m; setMeta(m);          // available straight away, so scanning works while the list downloads
      return { m0, header, map };
    }, [api]);

    const sync = useCallback(async (opts = {}) => {
      if (syncing.current) return;
      syncing.current = true;
      const prev = metaRef.current.syncedAt && dbRef.current ? metaRef.current : null;
      try {
        const { m0, header, map } = await loadMeta();
        // "Anything new?" costs one small call. Download again only when the sheet changed (or the script can't tell us).
        const unchanged = prev && !opts.force && (m0.updated ? m0.updated === prev.updated && m0.lastRow === prev.lastRow : Date.now() - prev.syncedAt < STALE_MS);
        if (unchanged) {
          const m = { ...metaRef.current, checkedAt: Date.now() }; metaRef.current = m; setMeta(m); idb.set(cacheKey + ":meta", m);
          setStatus({ kind: "ready" }); return;
        }
        const cols = [...new Set(INDEX_FIELDS.map((f) => map[f]).filter((i) => i !== undefined))].sort((a, b) => a - b);
        const pos = {}; cols.forEach((c, j) => { pos[c] = j; });
        const total = Math.max(0, m0.lastRow - 1);
        const starts = []; for (let s = 2; s <= m0.lastRow; s += CHUNK_ROWS) starts.push(s);
        const parts = new Array(starts.length);
        let next = 0, done = 0;
        setStatus({ kind: "syncing", done: 0, total, quiet: !!prev });
        const worker = async () => {
          while (next < starts.length) {
            const k = next++, s = starts[k];
            const res = await api("index", { start: s, count: CHUNK_ROWS, cols: cols.join(",") });
            parts[k] = packChunk(res.rows || [], s, pos, map);
            done += (res.rows || []).length;
            setStatus({ kind: "syncing", done: Math.min(done, total), total, quiet: !!prev });
            await yieldToMain();
          }
        };
        await Promise.all(Array.from({ length: Math.min(PARALLEL, starts.length) }, worker));
        const nextDb = await assemble(parts);
        const m = { syncedAt: Date.now(), checkedAt: Date.now(), header, map, updated: m0.updated || "", lastRow: m0.lastRow };
        dbRef.current = nextDb; metaRef.current = m;
        setDb(nextDb); setMeta(m); setExtras([]); setStatus({ kind: "ready" });
        idb.set(cacheKey + ":db", nextDb); idb.set(cacheKey + ":meta", m);
      } catch (e) {
        setStatus(dbRef.current && opts.quiet ? { kind: "ready" } : { kind: "error", err: e });
      } finally { syncing.current = false; }
    }, [api, cacheKey, loadMeta]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        if (!connected) { setDb(null); setStatus({ kind: "error", err: { code: "not_connected" } }); return; }
        setStatus({ kind: "loading" });
        const [cdb, cmeta] = await Promise.all([idb.get(cacheKey + ":db"), idb.get(cacheKey + ":meta")]);
        if (cancelled) return;
        if (cdb && cdb.v === 2 && cmeta) { dbRef.current = cdb; metaRef.current = cmeta; setDb(cdb); setMeta(cmeta); setStatus({ kind: "ready" }); }
        if (!(cdb && cdb.v === 2 && cmeta) || Date.now() - (cmeta.checkedAt || cmeta.syncedAt || 0) > CHECK_MS) sync({ quiet: true });
      })();
      return () => { cancelled = true; };
    }, [cacheKey, connected]);

    // Opening a setup link while the app is already open only changes the address's hash, so watch for that.
    useEffect(() => {
      const onHash = () => { const c = takeConnectHash(); if (c) setConn(c); };
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);
    // A phone that stays open all day should pick up sheet edits when it's brought back to the front.
    useEffect(() => {
      const onVis = () => { if (!document.hidden && dbRef.current && Date.now() - (metaRef.current.checkedAt || 0) > 30 * 60 * 1000) sync({ quiet: true }); };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }, [sync]);

    const find = useCallback((raw) => {
      const q = fold(String(raw).trim()); if (!q) return null;
      const ex = extrasRef.current.find((it) => fold(it.code) === q || fold(it.barcode) === q); if (ex) return ex;
      const d = dbRef.current; if (!d) return null;
      const i = lookup(d, raw); return i >= 0 ? itemAt(d, i) : null;
    }, []);
    const itemByRow = useCallback((row) => {
      const d = dbRef.current, i = d ? rowIndex(d, row) : -1;
      return i >= 0 ? itemAt(d, i) : extrasRef.current.find((it) => it.row === row) || null;
    }, []);

    const rowToFull = (values, m) => {
      const full = {};
      Object.keys(COLS).forEach((f) => { full[f] = m.map[f] === undefined ? "" : String(values[m.map[f]] ?? "").trim(); });
      return full;
    };
    // Read one item's full row live, and confirm it still holds the same item.
    const readRow = useCallback(async (it) => {
      if (!metaRef.current.header.length) await loadMeta();
      const m = metaRef.current;
      const res = await api("row", { row: it.row });
      const full = rowToFull(res.values || [], m);
      if (full.code !== it.code) throw { code: "row_moved" };
      return full;
    }, [api, loadMeta]);
    // For barcodes missing from the saved list (items added since the last update). Works even while the list is still downloading.
    const findLive = useCallback(async (code) => {
      if (!metaRef.current.header.length) await loadMeta();
      const m = metaRef.current;
      const res = await api("find", { code });
      if (!res.row) return null;
      const r = await api("row", { row: res.row });
      const it = itemFromValues(r.values || [], m.map, res.row);
      const list = [...extrasRef.current.filter((x) => x.row !== it.row), it];
      extrasRef.current = list; setExtras(list);
      return it;
    }, [api, loadMeta]);
    // Keep the saved list in step with what a live row read just showed (in memory only; the next sync refreshes storage).
    const patchLocal = useCallback((it, patch) => {
      const d = dbRef.current;
      if (it.idx >= 0 && d && d.rows[it.idx] === it.row) { if ("stock" in patch) d.stock[it.idx] = patch.stock; if ("retail" in patch) d.retail[it.idx] = patch.retail === "" ? NaN : patch.retail; }
    }, []);

    // Photos: ask once which items have one, then fetch only those.
    const getPhoto = useCallback(async (code) => {
      if (!photoIdx.current) photoIdx.current = api("photos").then((r) => new Set(r.codes || []), () => "unknown");
      const idx = await photoIdx.current;
      if (idx !== "unknown" && !idx.has(code)) return null;
      const r = await api("photo", { code });
      return r.data ? "data:" + (r.type || "image/jpeg") + ";base64," + r.data : null;
    }, [api]);
    const savePhoto = useCallback(async (code, blob) => {
      const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      let res;
      try { res = await fetch(connRef.current.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ key: connRef.current.key, action: "photo", code, data }) }); }
      catch { throw { code: "network" }; }
      const out = await res.json().catch(() => ({ error: "bad_response" }));
      if (out.error) throw { code: out.error };
      const idx = photoIdx.current && await photoIdx.current; if (idx && idx !== "unknown") idx.add(code);
    }, []);

    const saveConn = (next) => { ls.set(LS_KEY + ":conn", next); setConn(next); };
    const count = (db ? db.n : 0) + extras.length;
    return { conn, saveConn, connected, db, extras, count, meta, status, sync, find, itemByRow, readRow, findLive, patchLocal, getPhoto, savePhoto };
  }

  /* ================= barcode decoding =================
     Phones with a built-in barcode reader (most Android) use it. iPhones don't have one, so frames go to a
     background worker running ZXing; that keeps taps and animations smooth while it works. */
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code", "data_matrix"];
  let detectorP = null, worker = null, workerSeq = 0, zxingP = null, zxReader = null;
  function getDetector() {
    if (!detectorP) detectorP = (async () => {
      try {
        if (!("BarcodeDetector" in window)) return null;
        const sup = await window.BarcodeDetector.getSupportedFormats();
        const use = FORMATS.filter((f) => sup.includes(f));
        return use.length ? new window.BarcodeDetector({ formats: use }) : null;
      } catch { return null; }
    })();
    return detectorP;
  }
  function getWorker() {
    if (worker === null) { try { worker = new Worker(WORKER_URL); worker.onerror = () => { worker = false; }; } catch { worker = false; } }
    return worker;
  }
  // Start loading the reader before the scanner opens, so the first scan isn't slowed by it.
  function warmUp() { getDetector().then((d) => { if (!d) getWorker(); }); }
  const frameCanvas = document.createElement("canvas");
  function workerDecode(w, imageData) {
    return new Promise((resolve) => {
      const id = ++workerSeq;
      const done = (e) => { if (e.data.id === id) { w.removeEventListener("message", done); resolve(e.data.text); } };
      w.addEventListener("message", done);
      w.postMessage({ id, width: imageData.width, height: imageData.height, buf: imageData.data.buffer }, [imageData.data.buffer]);
    });
  }
  // Fallback when workers are unavailable: load ZXing on the main thread.
  function loadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingP) zxingP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = ZXING_URL;
      s.onload = () => res(window.ZXing); s.onerror = () => { zxingP = null; rej(new Error("zxing")); };
      document.head.appendChild(s);
    });
    return zxingP;
  }
  function zxDecodeMain(Z, cv) {
    if (!zxReader) {
      const hints = new Map(), F = Z.BarcodeFormat;
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX]);
      zxReader = new Z.MultiFormatReader(); zxReader.setHints(hints);
    }
    const { width: w, height: h } = cv;
    const px = cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    try { return zxReader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, h, w, h, 0, 0)))).getText(); }
    catch { return null; } finally { zxReader.reset(); }
  }
  // Decode a video frame or photo. Live frames are cropped to the viewfinder band; photos are tried whole, then cropped.
  async function decode(src, w, h, { crop, maxSide }) {
    const det = await getDetector();
    if (det) { try { const r = await det.detect(src); if (r && r.length) return r[0].rawValue; } catch {} }
    let sx = 0, sy = 0, sw = w, sh = h;
    if (crop) { sw = w * 0.9; sh = h * 0.5; sx = (w - sw) / 2; sy = (h - sh) / 2; }
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    frameCanvas.width = Math.round(sw * scale); frameCanvas.height = Math.round(sh * scale);
    const ctx = frameCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, frameCanvas.width, frameCanvas.height);
    const wk = getWorker();
    if (wk) return workerDecode(wk, ctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height));
    let Z; try { Z = await loadZxing(); } catch { return null; }
    return zxDecodeMain(Z, frameCanvas);
  }

  /* Short beep when a barcode is read (phones that can't vibrate still give feedback). The audio context is created
     from the Scan tap, which browsers require. */
  const audio = { ctx: null };
  function primeAudio() { try { audio.ctx = audio.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (audio.ctx.state === "suspended") audio.ctx.resume(); } catch {} }
  function beep() {
    const prefs = ls.get(LS_KEY + ":prefs") || {};
    if (prefs.beep === false || !audio.ctx) return;
    try {
      const c = audio.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = 1568; g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.15);
    } catch {}
  }

  /* ================= icons ================= */
  const Icon = ({ d, size = 22, sw = 2, className = "" }) => html`
    <svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${sw} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" className=${className}>
      ${[].concat(d).map((p, i) => html`<path key=${i} d=${p} />`)}
    </svg>`;
  const I = {
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
    scan: ["M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2", "M7 8v8M10.5 8v8M14 8v8M17 8v8"],
    x: "M6 6l12 12M18 6 6 18",
    list: "M4 6h16M4 12h16M4 18h10",
    download: ["M12 3v12m0 0-4-4m4 4 4-4", "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"],
    camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"],
    pin: ["M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z", "M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"]
  };

  /* ================= small building blocks ================= */
  const btn = {
    base: "inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border px-4 font-semibold transition-colors disabled:opacity-50",
    primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
    plain: "bg-surface text-fg border-line hover:border-accent",
    danger: "bg-surface text-bad border-line hover:border-bad"
  };
  const Button = ({ kind = "plain", className = "", ...p }) => html`<button type="button" className=${`${btn.base} ${btn[kind]} ${className}`} ...${p} />`;
  const IconButton = ({ label, d, onClick, className = "" }) => html`
    <button type="button" aria-label=${label} onClick=${onClick} className=${"grid place-items-center w-11 h-11 flex-none rounded-xl hover:bg-surface2 " + className}><${Icon} d=${d} /></button>`;
  const Pill = ({ className, children }) => html`<span className=${"inline-block rounded-md px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide " + className}>${children}</span>`;
  const Card = ({ title, aside, children }) => html`
    <section className="mt-3 rounded-2xl border border-line bg-surface p-4">
      ${title && html`<div className="mb-3 flex items-center gap-2"><h3 className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">${title}</h3>${aside}</div>`}
      ${children}
    </section>`;

  function Highlight({ text, words }) {
    if (!words.length || !text) return text || null;
    const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    return String(text).split(re).map((part, i) => i % 2 ? html`<mark key=${i} className="rounded bg-accent-soft px-px text-fg">${part}</mark>` : part);
  }

  function Sheet({ onClose, title, sub, children }) {
    useEffect(() => {
      const k = (e) => e.key === "Escape" && onClose();
      document.addEventListener("keydown", k);
      return () => document.removeEventListener("keydown", k);
    }, [onClose]);
    return html`
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick=${(e) => e.target === e.currentTarget && onClose()}>
        <div role="dialog" aria-modal="true" aria-label=${title} className="sheet-in gutter max-h-[92%] w-full max-w-[640px] overflow-y-auto rounded-t-3xl bg-bg pt-2 pb-safe">
          <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded bg-line"></div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[1.35rem] font-bold leading-tight [text-wrap:balance] break-words">${title}</h2>
              ${sub && html`<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">${sub}</div>`}
            </div>
            <${IconButton} label="Close" d=${I.x} onClick=${onClose} />
          </div>
          <div className="pb-6">${children}</div>
        </div>
      </div>`;
  }

  function Toast({ msg }) {
    if (!msg) return null;
    return html`<div role="status" className="fixed left-1/2 z-[70] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-card" style=${{ bottom: "calc(104px + env(safe-area-inset-bottom, 0px))" }}>${msg.text}</div>`;
  }


  /* ================= scanner ================= */
  // Remembered for this visit: once the viewer refuses live camera, the scan button opens the phone camera directly.
  const camState = { blocked: false };

  function Viewfinder({ mode, children }) {
    const cls = mode === "hit" ? "vf-hit" : mode === "live" || mode === "idle" ? "vf-live" : "";
    const c = (pos, dx, dy, extra) => html`<span className=${"vf-corner " + pos} style=${{ "--dx": dx, "--dy": dy, ...extra }}></span>`;
    return html`
      <div className=${"vf-mask relative overflow-hidden rounded-[22px] " + cls + (mode === "miss" ? " shake" : "")}
        style=${{ width: "min(84vw, 360px)", height: "calc(min(84vw, 360px) * .625)", "--vf-h": "calc(min(84vw, 360px) * .625)" }}>
        ${children}
        <div className="vf-grid"></div>
        ${(mode === "live" || mode === "idle" || mode === "reading") && html`<div className="vf-beam"></div>`}
        ${c("left-2 top-2 rounded-tl-[14px] border-l-[4px] border-t-[4px]", "-3px", "-3px", { borderRight: 0, borderBottom: 0 })}
        ${c("right-2 top-2 rounded-tr-[14px] border-r-[4px] border-t-[4px]", "3px", "-3px", { borderLeft: 0, borderBottom: 0 })}
        ${c("bottom-2 left-2 rounded-bl-[14px] border-b-[4px] border-l-[4px]", "-3px", "3px", { borderRight: 0, borderTop: 0 })}
        ${c("bottom-2 right-2 rounded-br-[14px] border-b-[4px] border-r-[4px]", "3px", "3px", { borderLeft: 0, borderTop: 0 })}
        ${mode === "hit" && html`<div className="absolute inset-0 grid place-items-center bg-[rgba(61,220,151,.18)]">
          <span className="pop grid h-16 w-16 place-items-center rounded-full bg-[#3ddc97] text-[#03140d] shadow-[0_0_40px_rgba(61,220,151,.8)]"><${Icon} d="M5 12.5l4.5 4.5L19 7.5" size=${34} sw=${3} /></span>
        </div>`}
      </div>`;
  }

  function Scanner({ onClose, onCode, initialFile }) {
    const photoFirst = !!initialFile || camState.blocked;
    const videoRef = useRef(null), photoRef = useRef(null), trackRef = useRef(null);
    const [mode, setMode] = useState(photoFirst ? "idle" : "starting"); // starting | live | hit | idle | reading | miss
    const [photoUrl, setPhotoUrl] = useState("");
    const [torch, setTorch] = useState(null); // null = unsupported
    const [typing, setTyping] = useState(false);
    const [manual, setManual] = useState("");
    const [flash, setFlash] = useState(0);
    const doneRef = useRef(false);

    const finish = (code) => {
      if (doneRef.current) return; doneRef.current = true;
      buzz(); beep(); setMode("hit"); setFlash((f) => f + 1);
      setTimeout(() => onCode(code), 380);
    };

    useEffect(() => {
      if (photoFirst) return;
      let stream = null, timer = 0, stopped = false;
      const stop = () => { stopped = true; clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
      (async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("nocam");
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          if (stopped) return stop();
          const v = videoRef.current; v.srcObject = stream; await v.play();
          const track = stream.getVideoTracks()[0]; trackRef.current = track;
          try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch {}
          try { const caps = track.getCapabilities && track.getCapabilities(); if (caps && caps.torch) setTorch(false); } catch {}
          setMode("live");
          // About 5 decodes a second is plenty for a handheld scan and keeps the phone cool.
          const tick = async () => {
            if (stopped) return;
            if (!document.hidden && v.videoWidth) {
              const code = await decode(v, v.videoWidth, v.videoHeight, { crop: true, maxSide: 1200 });
              if (code && !stopped) { stop(); return finish(code); }
            }
            timer = setTimeout(tick, 120);
          };
          tick();
        } catch {
          stop(); camState.blocked = true; setMode("idle");
          warmUp();
        }
      })();
      const onHide = () => { if (document.hidden) onClose(); };
      document.addEventListener("visibilitychange", onHide);
      return () => { stop(); document.removeEventListener("visibilitychange", onHide); };
    }, []);
    useEffect(() => {
      const k = (e) => e.key === "Escape" && onClose();
      document.addEventListener("keydown", k);
      if (initialFile) readPhoto(initialFile); else if (photoFirst) warmUp();
      return () => document.removeEventListener("keydown", k);
    }, []);

    async function readPhoto(file) {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url); setMode("reading");
      try {
        let src, w, h;
        if (window.createImageBitmap) { src = await createImageBitmap(file); w = src.width; h = src.height; }
        else { src = new Image(); src.src = url; await src.decode(); w = src.naturalWidth; h = src.naturalHeight; }
        const code = (await decode(src, w, h, { crop: false, maxSide: 1600 })) || (await decode(src, w, h, { crop: true, maxSide: 1600 }));
        if (code) return finish(code);
        setMode("miss");
      } catch { setMode("miss"); }
    }
    const snap = () => photoRef.current && photoRef.current.click();
    const toggleTorch = async () => {
      try { await trackRef.current.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch { setTorch(null); }
    };

    const hint = {
      starting: "Starting camera…",
      live: "Hold the barcode inside the frame",
      hit: "Got it",
      idle: "Tap the shutter to snap the barcode",
      reading: "Reading barcode…",
      miss: "No barcode found. Get closer, keep the bars sharp and level, and snap again."
    }[mode];

    return html`
      <div className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#020806] text-[#eef6f2]">
        <div className="pointer-events-none absolute inset-0 opacity-70" style=${{ background: "radial-gradient(60% 40% at 50% 35%, rgba(61,220,151,.16), transparent 70%), radial-gradient(50% 35% at 60% 70%, rgba(46,197,216,.12), transparent 70%)" }}></div>
        <video ref=${videoRef} playsInline muted className=${"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " + (mode === "live" || mode === "hit" ? "opacity-100" : "opacity-0")}></video>
        ${flash > 0 && html`<div key=${flash} className="flash pointer-events-none absolute inset-0 z-10 bg-white"></div>`}

        <div className="gutter relative z-20 flex items-center justify-between py-2.5">
          <button type="button" onClick=${onClose} aria-label="Close scanner" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"><${Icon} d=${I.x} /></button>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold tracking-wide backdrop-blur-md">${mode === "live" || mode === "hit" ? "● LIVE" : "SCAN"}</span>
          ${torch !== null ? html`<button type="button" onClick=${toggleTorch} aria-label=${torch ? "Turn flashlight off" : "Turn flashlight on"} aria-pressed=${torch}
              className=${"grid h-11 w-11 place-items-center rounded-full backdrop-blur-md " + (torch ? "bg-[#3ddc97] text-[#03140d]" : "bg-white/10 hover:bg-white/20")}><${Icon} d=${I.bolt} /></button>`
            : html`<span className="h-11 w-11"></span>`}
        </div>

        <div className="relative z-20 grid min-h-0 flex-1 place-items-center">
          <div className="grid justify-items-center gap-5">
            <${Viewfinder} mode=${mode}>
              ${(mode === "reading" || mode === "miss") && photoUrl && html`<img src=${photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />`}
              ${(mode === "idle" || mode === "starting") && html`<div className="absolute inset-0 grid place-items-center">
                <div className="flex h-[46%] items-end gap-[5px] opacity-50" aria-hidden="true">
                  ${[3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 3, 2, 1, 4, 1, 2, 1, 3].map((w, i) => html`<span key=${i} className="emblem-bar block h-full rounded-sm bg-white" style=${{ width: w * 2 + "px", animationDelay: i * 0.08 + "s" }}></span>`)}
                </div>
              </div>`}
            </${Viewfinder}>
            <p className="max-w-[300px] text-center text-[15px] leading-snug [text-shadow:0_1px_6px_rgba(0,0,0,.8)]" role="status">${hint}</p>
          </div>
        </div>

        <div className="gutter relative z-20 grid justify-items-center gap-3 pb-4 pt-2">
          <input ref=${photoRef} id="photo" type="file" accept="image/*" capture="environment" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; f && readPhoto(f); }} />
          ${mode !== "live" && mode !== "hit" && mode !== "starting" && html`
            <button type="button" onClick=${snap} aria-label="Snap barcode with camera" className="group relative grid h-[84px] w-[84px] place-items-center rounded-full border-[3px] border-white/80 fade-in">
              <span className="grad-fill block h-[66px] w-[66px] rounded-full transition-transform group-active:scale-90"></span>
            </button>`}
          ${typing ? html`
            <form className="flex w-full max-w-[420px] gap-2 fade-in" onSubmit=${(e) => { e.preventDefault(); manual.trim() && finish(manual); }}>
              <input autoFocus value=${manual} onChange=${(e) => setManual(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Barcode or item code"
                aria-label="Type a barcode or item code" className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-base text-white backdrop-blur-md placeholder:text-white/70" />
              <button type="submit" className="rounded-2xl bg-white px-5 font-semibold text-[#03140d]">Find</button>
            </form>`
          : html`<button type="button" onClick=${() => setTyping(true)} className="min-h-[44px] rounded-full px-4 text-[14px] text-white/75 underline-offset-4 hover:underline">Type the code instead</button>`}
          ${mode === "idle" && camState.blocked && html`<p className="max-w-[340px] text-center text-[12px] text-white/50">Camera access is off for this site. Allow the camera in your browser's site settings for live scanning, or snap a photo with the shutter.</p>`}
        </div>
      </div>`;
  }

  Object.assign(I, {
    refresh: ["M20 11a8 8 0 0 0-14.9-3.9L4 9", "M4 4v5h5", "M4 13a8 8 0 0 0 14.9 3.9L20 15", "M20 20v-5h-5"],
    sheet: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z", "M3 9h18M3 15h18M9 3v18"],
    back: "M15 18l-6-6 6-6",
    more: ["M5 12h.01M12 12h.01M19 12h.01"],
    sliders: ["M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0", "M16 4v4M10 10v4M18 16v4"],
    bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
    gear: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"]
  });

  /* ================= barcode graphic for EAN-13 / UPC-A ================= */
  function eanBits(code) {
    let d = String(code);
    if (/^\d{12}$/.test(d)) d = "0" + d;
    if (!/^\d{13}$/.test(d)) return null;
    const n = d.split("").map(Number);
    const sum = n.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0);
    if ((10 - (sum % 10)) % 10 !== n[12]) return null;
    const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
    const G = L.map((p) => p.split("").map((b) => (b === "1" ? "0" : "1")).reverse().join(""));
    const R = L.map((p) => p.split("").map((b) => (b === "1" ? "0" : "1")).join(""));
    const par = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"][n[0]];
    let s = "101";
    for (let i = 1; i < 7; i++) s += par[i - 1] === "L" ? L[n[i]] : G[n[i]];
    s += "01010"; for (let i = 7; i < 13; i++) s += R[n[i]]; s += "101";
    return s;
  }
  function BarcodeArt({ code }) {
    const bits = useMemo(() => eanBits(code), [code]);
    if (!bits) return null;
    return html`<svg viewBox=${`0 0 ${bits.length} 40`} preserveAspectRatio="none" className="h-14 w-full max-w-[260px]" aria-hidden="true">
      ${bits.split("").map((b, i) => b === "1" && html`<rect key=${i} x=${i} y="0" width="1.02" height="40" fill="currentColor" />`)}
    </svg>`;
  }

  /* ================= home ================= */
  function Emblem() {
    const bars = [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 4];
    let x = 0;
    return html`<svg viewBox="0 0 150 120" className="h-[120px] w-[150px]" aria-hidden="true">
      <defs><linearGradient id="eg" x1="0" x2="1"><stop offset="0" stop-color="var(--accent)" /><stop offset="1" stop-color="var(--accent-2)" /></linearGradient></defs>
      ${bars.map((w, i) => { const r = html`<rect key=${i} className="emblem-bar" style=${{ animationDelay: i * 0.09 + "s" }} x=${x} y="4" width=${w * 2.4} height="112" rx="1.2" fill="url(#eg)" />`; x += w * 2.4 + 3.2; return r; })}
      <g className="emblem-beam"><rect x="-6" y="0" width="162" height="2.5" rx="1.25" fill="var(--laser)" /><rect x="-6" y="-10" width="162" height="10" fill="var(--laser)" opacity=".12" /></g>
    </svg>`;
  }

  function Home({ sheet, onScan, onSearch, onSettings }) {
    const s = sheet.status;
    const err = s.kind === "error" ? sheetError(s.err) : null;
    return html`
      <div className="relative flex min-h-full flex-col overflow-hidden">
        <div className="aurora"></div>
        <header className="gutter pt-safe relative z-10 flex items-center justify-between" style=${{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}>
          <div className="min-w-0">
            <p className="font-display text-[1.15rem] font-extrabold leading-none tracking-tight">Stock Scanner</p>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[.12em] text-muted">Farmers Trading Center</p>
          </div>
          <button type="button" onClick=${onSettings} aria-label="Settings" className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-surface/70 backdrop-blur hover:border-accent">
            <${Icon} d=${I.gear} size=${20} />
            ${(s.kind === "syncing" || err) && html`<span className=${"absolute right-2 top-2 h-2 w-2 rounded-full " + (err ? "bg-bad" : "bg-warn")}></span>`}
          </button>
        </header>

        <main className="gutter relative z-10 flex flex-1 flex-col items-center justify-center pb-10 pt-6 text-center">
          <div className="fade-in"><${Emblem} /></div>
          <h1 className="mt-6 font-display text-[2.4rem] font-extrabold leading-[1.02] tracking-tight [text-wrap:balance]">Scan any <span className="grad-text">item</span></h1>
          <p className="mt-2 max-w-[300px] text-[15px] text-muted">Point your camera at a barcode for price, stock and details from your Google Sheet.</p>

          <div className="relative mt-10 h-[112px] w-[112px]">
            <span className="ring"></span><span className="ring"></span><span className="ring"></span>
            <button type="button" id="scanBtn" onClick=${onScan} aria-label="Scan a barcode"
              className="grad-fill relative grid h-full w-full place-items-center rounded-full text-accent-ink shadow-glow transition-transform active:scale-95">
              <${Icon} d=${I.scan} size=${42} sw=${2.2} />
            </button>
          </div>
          <p className="mt-3 text-[13px] font-semibold tracking-wide text-accent">Tap to scan</p>

          <button type="button" onClick=${onSearch}
            className="mt-10 flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3.5 text-left text-muted shadow-card backdrop-blur hover:border-accent">
            <${Icon} d=${I.search} size=${20} />
            <span className="min-w-0 flex-1 truncate">Search <span className="hidden min-[360px]:inline">${sheet.count ? sheet.count.toLocaleString() + " " : ""}</span>items</span>
            <span className="flex items-center gap-1 rounded-lg bg-surface2 px-2 py-1 text-[12px] font-semibold"><${Icon} d=${I.sliders} size=${14} />Filters</span>
          </button>

          ${sheet.count > 0 && s.kind !== "syncing" && html`<p className="mt-3 text-[12px] text-muted tabular-nums">${sheet.count.toLocaleString()} items · checked ${ago(sheet.meta.checkedAt || sheet.meta.syncedAt)}${typeof navigator !== "undefined" && navigator.onLine === false ? " · offline" : ""}</p>`}
          ${s.kind === "syncing" && html`<div className="mt-5 w-full max-w-[420px] fade-in"><${SyncBar} s=${s} /></div>`}
          ${err && html`<div className="mt-5 w-full max-w-[420px] rounded-2xl border border-bad bg-bad-soft p-3.5 text-left text-[13px] fade-in" role="alert">
            <b className="block text-bad">${err.title}</b><p className="mt-0.5">${err.text}</p>
            <${Button} className="mt-2" onClick=${err.settings ? onSettings : () => sheet.sync({ force: true })}>${err.settings ? "Open settings" : "Try again"}</${Button}>
          </div>`}
        </main>
      </div>`;
  }

  function SyncBar({ s }) {
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    if (s.quiet) return html`<p className="text-[12px] text-muted tabular-nums" role="status">Updating the item list in the background… ${pct}%</p>`;
    return html`<div className="rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5 text-left text-[12px] backdrop-blur" role="status">
      <div className="flex justify-between gap-2"><span>Getting items from Google Sheets…</span><span className="tabular-nums text-muted">${s.total ? pct + "%" : ""}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="grad-fill h-full rounded-full transition-all duration-500" style=${{ width: Math.max(4, pct) + "%" }}></div></div>
    </div>`;
  }

  /* ================= layer shell ================= */
  function Layer({ children, label }) {
    return html`<div role="dialog" aria-modal="true" aria-label=${label} className="layer-in fixed inset-0 z-40 overflow-y-auto overflow-x-hidden bg-bg pt-safe pb-safe">${children}</div>`;
  }
  const BackButton = ({ onClick, label = "Back" }) => html`
    <button type="button" onClick=${onClick} aria-label=${label} className="grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface hover:border-accent"><${Icon} d=${I.back} /></button>`;

  /* ================= search & filters ================= */
  function FilterSheet({ db, filters, setFilters, onClose }) {
    const [draft, setDraft] = useState(filters);
    const [find, setFind] = useState({});
    // Counts come from one pass over the index; deferring keeps taps instant while it runs.
    const dDraft = React.useDeferredValue(draft);
    const fac = useMemo(() => facetsDb(db, dDraft), [db, dDraft]);
    const options = fac.options, matches = fac.match;
    const set = (k, v) => setDraft((d) => ({ ...d, [k]: d[k] === v ? "" : v }));
    const chip = (k, v, count) => html`<button type="button" key=${v} aria-pressed=${draft[k] === v} onClick=${() => set(k, v)}
      className=${"min-h-[38px] rounded-full border px-3.5 text-[13px] " + (draft[k] === v ? "border-transparent grad-fill text-accent-ink" : "border-line bg-surface text-fg")}>
      ${v}${count != null && html`<span className="ml-1.5 font-mono text-[11px] opacity-70">${count.toLocaleString()}</span>`}</button>`;

    return html`<${Sheet} title="Filters" onClose=${onClose}>
      ${FILTER_DIMS.map(([k, label]) => {
        const all = options[k];
        if (!all.length && !draft[k]) return null;
        const q = norm(find[k] || "");
        const list = (q ? all.filter(([v]) => norm(v).includes(q)) : all).slice(0, 24);
        if (draft[k] && !list.some(([v]) => v === draft[k])) list.unshift([draft[k], null]);
        return html`<section key=${k} className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted">${label}</h3>
            ${all.length > 24 && html`<input value=${find[k] || ""} onChange=${(e) => setFind({ ...find, [k]: e.target.value })} placeholder=${"Find " + label.toLowerCase()}
              aria-label=${"Find " + label.toLowerCase()} className="w-[150px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px]" />`}
          </div>
          <div className="flex flex-wrap gap-1.5">${list.map(([v, c]) => chip(k, v, c))}</div>
        </section>`;
      })}
      <section className="mt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Stock</h3>
        <div className="flex flex-wrap gap-1.5">${[["in", "In stock"], ["out", "Out of stock"]].map(([v, l]) => html`<button type="button" key=${v} aria-pressed=${draft.stock === v} onClick=${() => set("stock", v)}
          className=${"min-h-[38px] rounded-full border px-3.5 text-[13px] " + (draft.stock === v ? "border-transparent grad-fill text-accent-ink" : "border-line bg-surface")}>${l}</button>`)}</div>
      </section>
      <section className="mt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Retail price</h3>
        <div className="grid grid-cols-2 gap-2">
          <input id="pmin" type="number" inputMode="decimal" placeholder="Min $" value=${draft.min} onChange=${(e) => setDraft({ ...draft, min: e.target.value })} aria-label="Minimum price" className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base" />
          <input id="pmax" type="number" inputMode="decimal" placeholder="Max $" value=${draft.max} onChange=${(e) => setDraft({ ...draft, max: e.target.value })} aria-label="Maximum price" className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base" />
        </div>
      </section>
      <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 bg-bg px-4 py-3">
        <${Button} className="flex-1" onClick=${() => setDraft(EMPTY_FILTERS)}>Clear</${Button}>
        <${Button} kind="primary" className="flex-[2] grad-fill border-transparent" onClick=${() => { setFilters(draft); onClose(); }}>Show ${matches.toLocaleString()} ${matches === 1 ? "item" : "items"}</${Button}>
      </div>
    </${Sheet}>`;
  }

  function ResultRow({ it, words, onOpen }) {
    const out = it.stock <= 0;
    return html`<button type="button" onClick=${() => onOpen(it)}
      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-accent">
      <span className="min-w-0 break-words font-semibold"><${Highlight} text=${it.name || it.code} words=${words} /></span>
      <span className="row-span-2 text-right">
        <b className="block font-display text-[1.15rem] leading-tight tabular-nums">${money(it.retail)}</b>
        <span className=${"text-[12px] font-semibold tabular-nums " + (out ? "text-bad" : "text-accent")}>${out ? "Out" : qty(it.stock) + " in stock"}</span>
      </span>
      <span className="flex min-w-0 flex-wrap gap-x-2.5 text-[12px] text-muted">
        <span className="break-all font-mono"><${Highlight} text=${it.code} words=${words} /></span>
        ${it.f && it.f.dept && html`<span>${it.f.dept}${it.f.subdept ? " · " + it.f.subdept : ""}</span>`}
      </span>
    </button>`;
  }

  // Items found live by scanning aren't in the index, so check them the plain way (there are only ever a few).
  function extraMatches(it, f, words) {
    for (const k of DIM_KEYS) if (f[k] !== "" && it.f[k] !== f[k]) return false;
    if (f.stock === "in" && !(it.stock > 0)) return false;
    if (f.stock === "out" && !(it.stock <= 0)) return false;
    if (f.min !== "" && !(num(it.retail) >= num(f.min))) return false;
    if (f.max !== "" && !(num(it.retail) <= num(f.max))) return false;
    const hay = fold([it.code, it.barcode, it.name, it.brand].join(SEP));
    return words.every((w) => hay.includes(fold(w)));
  }

  function SearchLayer({ sheet, recent, onOpen, onClose }) {
    const { db, extras } = sheet;
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [showFilters, setShowFilters] = useState(false);
    const [shown, setShown] = useState(PAGE);
    const dq = React.useDeferredValue(query);
    const words = useMemo(() => norm(dq).split(/\s+/).filter(Boolean), [dq]);
    const nf = activeCount(filters);
    const active = words.length > 0 || nf > 0;
    useEffect(() => setShown(PAGE), [dq, filters]);
    const result = useMemo(() => {
      if (!active || !db) return { total: 0, ex: [], idx: [] };
      const r = searchDb(db, dq, filters);
      const ex = extras.filter((it) => extraMatches(it, filters, words));
      return { total: r.total + ex.length, ex, idx: r.list };
    }, [db, extras, dq, filters, active]);
    const rows = useMemo(() => result.ex.concat(result.idx.slice(0, Math.max(0, shown - result.ex.length)).map((i) => itemAt(db, i))), [result, shown]);
    const available = result.ex.length + result.idx.length;
    const recentItems = useMemo(() => recent.map((r) => sheet.itemByRow(r)).filter(Boolean).slice(0, 8), [recent, db]);
    const topDepts = useMemo(() => (db ? facetsDb(db, EMPTY_FILTERS).options.dept.slice(0, 12) : []), [db]);
    const filterChips = Object.entries(filters).filter(([, v]) => v !== "");
    const chipLabel = (k, v) => k === "stock" ? (v === "in" ? "In stock" : "Out of stock") : k === "min" ? "From $" + v : k === "max" ? "Up to $" + v : v;

    return html`<${Layer} label="Search items">
      <h1 className="sr-only">Search items</h1>
      <div className="top-safe gutter sticky z-10 grid grid-cols-[minmax(0,1fr)] gap-2.5 bg-bg pb-3 pt-3">
        <div className="flex items-center gap-2">
          <${BackButton} onClick=${onClose} />
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-line bg-surface pl-3 pr-1 shadow-card focus-within:border-accent">
            <span className="text-muted"><${Icon} d=${I.search} size=${20} /></span>
            <input id="q" autoFocus type="search" value=${query} onChange=${(e) => setQuery(e.target.value)} autoComplete="off" autoCorrect="off" spellCheck="false" enterKeyHint="search"
              placeholder="Name, code or barcode" aria-label="Search items by name, code or barcode"
              onKeyDown=${(e) => { if (e.key === "Enter") { const it = sheet.find(e.target.value); if (it) { e.preventDefault(); onOpen(it); } else e.target.blur(); } }}
              className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-base outline-none" />
            ${query && html`<${IconButton} label="Clear search" d=${I.x} onClick=${() => setQuery("")} />`}
          </div>
          <button type="button" onClick=${() => setShowFilters(true)} aria-label=${"Filters" + (nf ? `, ${nf} on` : "")} disabled=${!db}
            className=${"relative grid h-12 w-12 flex-none place-items-center rounded-2xl border disabled:opacity-50 " + (nf ? "grad-fill border-transparent text-accent-ink" : "border-line bg-surface")}>
            <${Icon} d=${I.sliders} size=${20} />
            ${nf > 0 && html`<span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-fg px-1 text-[11px] font-bold text-bg">${nf}</span>`}
          </button>
        </div>
        ${filterChips.length > 0 && html`<div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          ${filterChips.map(([k, v]) => html`<button type="button" key=${k} onClick=${() => setFilters({ ...filters, [k]: "" })} aria-label=${"Remove filter " + chipLabel(k, v)}
            className="flex min-h-[34px] flex-none items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[13px] text-accent">${chipLabel(k, v)}<${Icon} d=${I.x} size=${14} /></button>`)}
          <button type="button" onClick=${() => setFilters(EMPTY_FILTERS)} className="min-h-[34px] flex-none px-2 text-[13px] text-muted underline">Clear all</button>
        </div>`}
        ${active && html`<p className="text-[12px] text-muted tabular-nums" role="status">${result.total.toLocaleString()} ${result.total === 1 ? "item" : "items"}${available < result.total ? ` · showing the first ${available.toLocaleString()}, add a word or filter to narrow` : ""}</p>`}
      </div>
      <div className="gutter pb-10">
        ${!db ? html`<div className="grid gap-2">${[0, 1, 2, 3].map((i) => html`<div key=${i} className="skeleton h-[68px] rounded-2xl"></div>`)}</div>
          ${sheet.status.kind === "error" ? html`<p className="mt-3 text-center text-[13px] text-muted">${sheetError(sheet.status.err).title}. Search will work once the item list has downloaded.</p>` : html`<p className="mt-3 text-center text-[13px] text-muted">Getting the item list…</p>`}`
        : !active ? html`<div className="fade-in grid gap-6 pt-2">
            ${recentItems.length > 0 && html`<section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Recently viewed</h2>
              <div className="grid gap-2">${recentItems.map((it) => html`<${ResultRow} key=${it.row} it=${it} words=${[]} onOpen=${onOpen} />`)}</div>
            </section>`}
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Browse by department</h2>
              <div className="flex flex-wrap gap-1.5">${topDepts.map(([d, c]) => html`<button type="button" key=${d} onClick=${() => setFilters({ ...EMPTY_FILTERS, dept: d })}
                className="min-h-[40px] rounded-full border border-line bg-surface px-3.5 text-[13px] hover:border-accent">${d}<span className="ml-1.5 font-mono text-[11px] text-muted">${c.toLocaleString()}</span></button>`)}</div>
            </section>
            <p className="text-[13px] text-muted">Tip: tap Filters to narrow by supplier, category, brand, stock or price.</p>
          </div>`
        : !rows.length ? html`<div className="grid justify-items-center gap-2 py-12 text-center text-muted">
            <h2 className="font-display text-lg font-bold text-fg">Nothing matches</h2><p>Try fewer words or remove a filter.</p></div>`
        : html`<div className="grid gap-2">${rows.map((it) => html`<${ResultRow} key=${it.row} it=${it} words=${words} onOpen=${onOpen} />`)}</div>
            ${available > shown && html`<${Button} className="mt-3 w-full" onClick=${() => setShown(shown + PAGE)}>Show more (${Math.min(available, MAX_HITS) - shown > 0 ? (available - shown).toLocaleString() : 0} left)</${Button}>`}`}
      </div>
      ${showFilters && db && html`<${FilterSheet} db=${db} filters=${filters} setFilters=${setFilters} onClose=${() => setShowFilters(false)} />`}
    </${Layer}>`;
  }

  /* ================= item photos (optional, tucked away) ================= */
  const photoKey = (code) => [...String(code)].map((c) => (/[A-Za-z0-9_.-]/.test(c) ? c : "~" + c.charCodeAt(0).toString(16))).join("");
  async function shrinkImage(file) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
  }

  /* ================= item detail (view only, live from the sheet) ================= */
  function ItemLayer({ it, sheet, onClose, onScan, toast }) {
    const [live, setLive] = useState(null);
    const [liveErr, setLiveErr] = useState(null);
    const [menu, setMenu] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [uploading, setUploading] = useState(false);
    const photoInput = useRef(null);

    const load = useCallback(() => {
      setLiveErr(null);
      sheet.readRow(it).then((full) => {
        setLive(full);
        const st = num(full.stock), rt = full.retail === "" ? "" : num(full.retail);
        sheet.patchLocal(it, { stock: st, retail: rt });
      }, setLiveErr);
    }, [it.row]);
    useEffect(() => { if (sheet.connected) load(); else setLiveErr({ code: "not_connected" }); }, [it.row]);
    useEffect(() => {
      let off = false;
      if (sheet.connected) sheet.getPhoto(it.code).then((url) => { if (!off && url) setPhoto({ url }); }, () => {});
      return () => { off = true; };
    }, [it.code]);

    async function addPhoto(file) {
      setUploading(true); setMenu(false);
      try {
        const blob = await shrinkImage(file);
        await sheet.savePhoto(it.code, blob);
        setPhoto({ url: URL.createObjectURL(blob) }); toast("Photo saved to your Google Drive");
      } catch { toast("Couldn't save the photo. Try again."); }
      setUploading(false);
    }

    const f = live || {};
    const stock = live ? num(live.stock) : it.stock;
    const retail = live ? (live.retail === "" ? "" : num(live.retail)) : it.retail;
    const pmap = live ? (live.pmap === "" ? "" : num(live.pmap)) : it.pmap;
    const out = stock <= 0;
    const margin = retail && pmap !== "" && pmap > 0 ? ((retail - pmap) / retail) * 100 : null;
    const ok = (v) => v && v !== "-" && v !== "#N/A" && v !== "0";
    const dl = (label, v) => ok(v) ? html`<div key=${label} className="flex justify-between gap-3 border-b border-dashed border-line py-2.5 last:border-0"><dt className="text-muted">${label}</dt><dd className="break-all text-right font-mono">${v}</dd></div>` : null;
    const price = (label, v) => html`<div key=${label} className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5"><small className="block truncate text-[11px] text-muted">${label}</small><b className="font-mono text-[1rem] tabular-nums">${v}</b></div>`;

    return html`<${Layer} label=${it.name || it.code}>
      <div className="top-safe gutter sticky z-10 flex items-center justify-between bg-bg/80 py-3 backdrop-blur">
        <${BackButton} onClick=${onClose} />
        <span className=${"rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide " + (live ? "bg-accent-soft text-accent" : "bg-surface2 text-muted")}>
          ${live ? "● Live from sheet" : liveErr ? "Saved list" : "Checking sheet…"}</span>
        <div className="relative">
          <button type="button" onClick=${() => setMenu(!menu)} aria-label="More options" aria-expanded=${menu} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface hover:border-accent"><${Icon} d=${I.more} sw=${3} /></button>
          ${menu && html`<div className="fade-in absolute right-0 top-12 z-20 w-[230px] overflow-hidden rounded-2xl border border-line bg-surface shadow-card" role="menu">
            ${sheet.connected && html`<button type="button" role="menuitem" onClick=${() => photoInput.current.click()} className="block w-full px-4 py-3 text-left text-[14px] hover:bg-surface2">${photo ? "Replace item photo" : "Add photo of item"}</button>`}
            <button type="button" role="menuitem" onClick=${() => { setMenu(false); load(); }} disabled=${!sheet.connected} className="block w-full px-4 py-3 text-left text-[14px] hover:bg-surface2">Re-check the sheet</button>
          </div>`}
          <input ref=${photoInput} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => { const file = e.target.files[0]; e.target.value = ""; file && addPhoto(file); }} />
        </div>
      </div>

      <div className="gutter pb-12">
        ${(photo || uploading) && html`<div className="fade-in mt-1 overflow-hidden rounded-3xl border border-line bg-surface">
          ${uploading ? html`<div className="skeleton aspect-[4/3] w-full max-w-full"></div>` : html`<img src=${photo.url} alt=${"Photo of " + (it.name || it.code)} className="aspect-[4/3] w-full max-w-full object-cover" />`}
        </div>`}

        <section className="fade-in pt-3">
          <h1 className="font-display text-[1.9rem] font-extrabold leading-[1.08] tracking-tight [text-wrap:balance] break-words">${(live && live.name) || it.name || it.code}</h1>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="font-mono">${it.code}</span>
            ${f.dept && html`<span>${f.dept}${f.subdept ? " · " + f.subdept : ""}</span>`}
            ${f.supplier && html`<span>${f.supplier}</span>`}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-[1.25fr_1fr] gap-2.5">
          <div className="relative overflow-hidden rounded-3xl p-4 text-accent-ink grad-fill shadow-glow">
            <small className="text-[12px] font-semibold uppercase tracking-[.1em] opacity-80">Retail price</small>
            <b className="mt-1 block font-display text-[2.3rem] font-extrabold leading-none tabular-nums">${money(retail)}</b>
            ${f.gst && html`<small className="mt-2 block text-[12px] opacity-80">${f.gst === "EXO" ? "GST exempt" : f.gst === "NOR" ? "Includes standard GST" : "Tax " + f.gst}</small>`}
          </div>
          <div className=${"rounded-3xl border p-4 " + (out ? "border-bad bg-bad-soft" : "border-line bg-surface")}>
            <small className="text-[12px] font-semibold uppercase tracking-[.1em] text-muted">In stock</small>
            <b className=${"mt-1 block font-display text-[2.3rem] font-extrabold leading-none tabular-nums " + (out ? "text-bad" : "text-fg")}>${qty(stock)}</b>
            <small className=${"mt-2 block text-[12px] " + (out ? "text-bad" : "text-muted")}>${out ? "Out of stock" : live && live.tracked === "-" ? "Not stock-tracked" : "On hand"}</small>
          </div>
        </section>

        ${it.barcode && html`<section className="mt-2.5 grid justify-items-center gap-1 rounded-3xl border border-line bg-surface px-4 py-4 text-fg">
          <${BarcodeArt} code=${it.barcode} />
          <span className="font-mono text-[15px] tracking-[.18em]">${it.barcode}</span>
        </section>`}

        <section className="mt-2.5 rounded-3xl border border-line bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Prices</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            ${price("Trade", money(live && live.trade !== "" ? num(live.trade) : ""))}
            ${price("Avg cost (PMAP)", money(pmap))}
            ${price("Last purchase", money(live && live.dpa !== "" && num(live.dpa) ? num(live.dpa) : ""))}
            ${price("Margin", margin === null ? "—" : margin.toFixed(1) + "%")}
            ${live && num(live.uscost) ? price("US cost", money(num(live.uscost))) : null}
          </div>
          ${!live && !liveErr && html`<div className="mt-2 grid grid-cols-2 gap-2"><div className="skeleton h-12 rounded-xl"></div><div className="skeleton h-12 rounded-xl"></div></div>`}
        </section>

        ${live && html`<section className="mt-2.5 rounded-3xl border border-line bg-surface px-4 pb-2 pt-4">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Details</h2>
          <dl className="text-[14px]">
            ${dl("Supplier", live.supplier)}${dl("Department", live.dept)}${dl("Subdepartment", live.subdept)}${dl("Brand", live.brand)}
            ${dl("Category", live.category)}${dl("Subcategory", live.subcategory)}${dl("Item type", live.type)}${dl("Reference", live.ref)}
            ${dl("Collection", live.collection)}${dl("By how many", live.byHowMany)}${dl("Scale item", live.scale)}${dl("Sheet row", String(it.row))}
          </dl>
        </section>`}

        ${liveErr && html`<p className="mt-3 rounded-2xl bg-surface2 px-4 py-3 text-[13px] text-muted">${liveErr.code === "row_moved"
          ? "This item has moved in the sheet. Refresh the list in Sheet settings to see its current numbers."
          : sheetError(liveErr).title + ". Showing numbers saved " + ago(sheet.meta.syncedAt) + "."}</p>`}

        <button type="button" onClick=${onScan} className="grad-fill mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-accent-ink shadow-glow active:scale-[.98]">
          <${Icon} d=${I.scan} size=${22} />Scan next item</button>
      </div>
    </${Layer}>`;
  }

  function NotFoundLayer({ code, syncing, onClose, onScan, onSearch }) {
    return html`<${Sheet} title="Not in the sheet" sub=${html`<span className="font-mono">${code}</span>`} onClose=${onClose}>
      <p className="my-3 text-[14px] text-muted">${syncing ? "The item list is still downloading and the sheet doesn't have this barcode yet. Wait a moment and scan again, or search by name." : "No item has this barcode or code. The barcode may be missing from the sheet, so try searching by name."}</p>
      <div className="grid grid-cols-2 gap-2"><${Button} onClick=${onSearch}>Search by name</${Button}><${Button} kind="primary" className="grad-fill border-transparent" onClick=${onScan}>Scan again</${Button}></div>
    </${Sheet}>`;
  }

  /* ================= settings ================= */
  function Field({ id, label, ...p }) {
    return html`<div className="grid min-w-0 gap-1">
      <label htmlFor=${"f_" + id} className="text-[12px] font-semibold tracking-wide text-muted">${label}</label>
      <input id=${"f_" + id} name=${id} className="w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-base" ...${p} />
    </div>`;
  }
  function SettingsLayer({ sheet, onClose, toast }) {
    const { conn, meta, status } = sheet;
    const [url, setUrl] = useState(conn.url);
    const [key, setKey] = useState(conn.key);
    const err = status.kind === "error" ? sheetError(status.err) : null;
    const section = (title, body) => html`<section className="mt-3 rounded-3xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-display text-lg font-bold">${title}</h2>${body}</section>`;
    const copy = async () => {
      const link = setupLink(conn);
      try { await navigator.clipboard.writeText(link); toast("Setup link copied"); }
      catch { window.prompt && window.prompt("Copy this setup link", link); }
    };
    return html`<${Layer} label="Settings">
      <div className="top-safe gutter sticky z-10 flex items-center gap-3 bg-bg py-3">
        <${BackButton} onClick=${onClose} /><h1 className="font-display text-xl font-extrabold">Settings</h1>
      </div>
      <div className="gutter pb-12">
        ${status.kind === "syncing" && html`<${SyncBar} s=${status} />`}
        ${err && html`<div className="rounded-2xl border border-bad bg-bad-soft p-3.5 text-[13px]" role="alert"><b className="block text-bad">${err.title}</b><p className="mt-0.5">${err.text}</p>
          ${err.retry && html`<${Button} className="mt-2" onClick=${() => sheet.sync({ force: true })}>Try again</${Button}>`}</div>`}
        ${section("Sheet connection", html`<form className="grid gap-3" onSubmit=${(e) => { e.preventDefault(); const pasted = connFromText(url) || connFromText(key); const next = pasted || { url: url.trim(), key: key.trim() }; if (!validUrl(next.url) || !next.key) { toast("Paste the web app link (it starts with https://script.google.com) and the key."); return; } setUrl(next.url); setKey(next.key); sheet.saveConn(next); toast("Connecting…"); }}>
          <${Field} id="connUrl" label="Web app link (ends in /exec)" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" value=${url} onChange=${(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          <${Field} id="connKey" label="Connection key" value=${key} onChange=${(e) => setKey(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
          <button type="submit" className=${`${btn.base} ${btn.primary} grad-fill border-transparent`}>Save and connect</button>
          ${sheet.connected && html`<button type="button" onClick=${copy} className=${`${btn.base} ${btn.plain}`}>Copy setup link for staff</button>
            <p className="text-[12px] text-muted">Send this link to staff. Opening it once on their phone connects the app, so they don't type anything. Treat it like a password: anyone with it can look up prices and costs.</p>`}
        </form>`)}
        ${sheet.connected && section("Search list", html`
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
            <dt className="text-muted">Items</dt><dd className="tabular-nums">${sheet.count.toLocaleString()}</dd>
            <dt className="text-muted">Downloaded</dt><dd>${ago(meta.syncedAt)}</dd>
            <dt className="text-muted">Last checked</dt><dd>${ago(meta.checkedAt || meta.syncedAt)}</dd>
            <dt className="text-muted">Item details</dt><dd>Read live when you open an item</dd>
          </dl>
          <${Button} kind="primary" className="mt-3 w-full grad-fill border-transparent" disabled=${status.kind === "syncing"} onClick=${() => sheet.sync({ force: true })}>
            <${Icon} d=${I.refresh} size=${18} />${status.kind === "syncing" ? "Updating…" : "Update search list now"}</${Button}>
          <p className="mt-2 text-[12px] text-muted">The app checks the sheet for changes whenever you open it and downloads again only when something changed. Scanning a barcode that isn't in the list yet checks the sheet directly. This app never changes the sheet.</p>`)}
        ${Object.keys(meta.map || {}).length > 0 && section("Columns found", html`<div className="flex flex-wrap gap-1.5 text-[12px]">
          ${Object.entries(meta.map).sort((a, b) => a[1] - b[1]).map(([k, i]) => html`<span key=${k} className="rounded-md bg-surface2 px-2 py-1 font-mono">${colLetter(i)} · ${meta.header[i]}</span>`)}
        </div>`)}
        ${section("Scanning", html`<label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-[14px]"><span>Beep when a barcode is read</span>
          <input id="beepToggle" type="checkbox" className="h-6 w-6 accent-[var(--accent)]" defaultChecked=${(ls.get(LS_KEY + ":prefs") || {}).beep !== false} onChange=${(e) => ls.set(LS_KEY + ":prefs", { ...(ls.get(LS_KEY + ":prefs") || {}), beep: e.target.checked })} /></label>`)}
        ${section("Install on your phone", html`<p className="text-[14px] text-muted">Add this app to your home screen so it opens full screen like a regular app. On iPhone: Share → Add to Home Screen. On Android: menu ⋮ → Add to Home screen.</p>`)}
        ${section("Barcode scanner guns", html`<p className="text-[14px] text-muted">Bluetooth and USB scanners work too. Pair the scanner as a keyboard, keep this app open and scan: the item opens on its own.</p>`)}
      </div>
    </${Layer}>`;
  }

  /* ================= app ================= */
  function App() {
    const sheet = useSheet();
    const sheetRef = useRef(sheet); sheetRef.current = sheet;
    const prefs = useMemo(() => ls.get(LS_KEY + ":prefs") || {}, []);
    const [layer, setLayer] = useState(null);   // {kind: "search"|"item"|"notfound"|"settings", item?, code?}
    const [scan, setScan] = useState(null);     // null | {file?}
    const [recent, setRecent] = useState(prefs.recentRows || []);
    const [toastMsg, setToastMsg] = useState(null);
    const quickPhoto = useRef(null);

    const toast = useCallback((text) => setToastMsg({ text, id: Date.now() }), []);
    useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 2800); return () => clearTimeout(t); }, [toastMsg]);
    useEffect(() => { ls.set(LS_KEY + ":prefs", { ...(ls.get(LS_KEY + ":prefs") || {}), recentRows: recent }); }, [recent]);
    // Get the barcode reader ready while the home screen is idle, so the first scan starts fast.
    useEffect(() => { const t = "requestIdleCallback" in window ? requestIdleCallback(warmUp) : setTimeout(warmUp, 800); return () => ("cancelIdleCallback" in window ? cancelIdleCallback(t) : clearTimeout(t)); }, []);

    const openItem = useCallback((it) => {
      setLayer({ kind: "item", item: it });
      setRecent((r) => [it.row, ...r.filter((x) => x !== it.row)].slice(0, 12));
    }, []);
    const handleCode = useCallback(async (raw) => {
      const code = String(raw).trim(); setScan(null); if (!code) return;
      const sh = sheetRef.current;
      const it = sh.find(code);
      if (it) return openItem(it);
      // Not in the saved list (still downloading, or added to the sheet recently): ask the sheet directly.
      if (sh.connected) {
        setToastMsg({ text: "Checking the sheet…", id: Date.now() });
        try { const hit = await sh.findLive(code); if (hit) { setToastMsg(null); return openItem(hit); } } catch {}
        setToastMsg(null);
      }
      setLayer({ kind: "notfound", code });
    }, [openItem]);
    // Once live camera is known to be blocked here, open the phone camera straight from the tap.
    const startScan = () => {
      primeAudio();
      if (camState.blocked && quickPhoto.current) quickPhoto.current.click();
      else setScan({});
    };

    // Keyboard-wedge scanners type fast and end with Enter.
    useEffect(() => {
      let buf = "", last = 0;
      const onKey = (e) => {
        const t = e.target;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.id !== "q") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const now = performance.now();
        if (now - last > 60) buf = "";
        last = now;
        if (e.key === "Enter") { if (buf.length >= 4) { e.preventDefault(); buzz(); handleCode(buf); } buf = ""; }
        else if (e.key.length === 1) buf += e.key;
      };
      document.addEventListener("keydown", onKey, true);
      return () => document.removeEventListener("keydown", onKey, true);
    }, [handleCode]);

    const current = layer && layer.kind === "item" ? layer.item : null;
    return html`
      <div className="mx-auto h-full max-w-[640px]">
        <${Home} sheet=${sheet} onScan=${startScan} onSearch=${() => setLayer({ kind: "search" })} onSettings=${() => setLayer({ kind: "settings" })} />
      </div>
      <input ref=${quickPhoto} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) setScan({ file: f }); }} />

      ${layer && layer.kind === "search" && html`<${SearchLayer} sheet=${sheet} recent=${recent} onOpen=${openItem} onClose=${() => setLayer(null)} />`}
      ${layer && layer.kind === "settings" && html`<${SettingsLayer} sheet=${sheet} toast=${toast} onClose=${() => setLayer(null)} />`}
      ${current && html`<${ItemLayer} key=${current.row} it=${current} sheet=${sheet} toast=${toast} onClose=${() => setLayer(null)} onScan=${startScan} />`}
      ${layer && layer.kind === "notfound" && html`<${NotFoundLayer} code=${layer.code} syncing=${sheet.status.kind === "syncing"} onClose=${() => setLayer(null)} onScan=${() => { setLayer(null); startScan(); }}
        onSearch=${() => setLayer({ kind: "search" })} />`}
      ${scan && html`<${Scanner} initialFile=${scan.file} onClose=${() => setScan(null)} onCode=${handleCode} />`}
      <${Toast} msg=${toastMsg} />`;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
  // Offline support and instant repeat visits: the service worker keeps the app's own files (not your data) on the phone.
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
