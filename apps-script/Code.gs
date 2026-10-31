/**
 * Stock Scanner connector for Google Sheets.
 *
 * Paste this into the item sheet (Extensions → Apps Script), set KEY below to a
 * long random secret, then Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). The app sends KEY with every request;
 * requests without it are refused. The app only reads the sheet. The one thing it
 * writes is item photos, saved to a "Stock Scanner Photos" folder in your Drive.
 */
const KEY = "PASTE_A_LONG_RANDOM_SECRET_HERE";
const TAB = "Sheet1";
const PHOTO_FOLDER = "Stock Scanner Photos";
const MAX_COUNT = 20000;

function doGet(e) {
  return respond_(() => {
    const p = e.parameter || {};
    checkKey_(p.key);
    const sh = sheet_();
    switch (p.action) {
      case "meta": {
        const lastCol = sh.getLastColumn();
        // "updated" lets the app skip re-downloading all items when nothing changed since the last visit.
        const updated = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getLastUpdated().toISOString();
        return { tab: sh.getName(), lastRow: sh.getLastRow(), updated, header: sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0] };
      }
      case "index": {
        // Rows start..start+count-1, only the requested column indexes (0-based), as displayed text.
        const start = Math.max(2, parseInt(p.start, 10) || 2);
        const last = sh.getLastRow();
        const count = Math.min(MAX_COUNT, parseInt(p.count, 10) || MAX_COUNT, last - start + 1);
        if (count <= 0) return { start, rows: [] };
        const cols = String(p.cols || "").split(",").map(Number).filter((n) => n >= 0);
        const width = Math.max.apply(null, cols) + 1;
        const values = sh.getRange(start, 1, count, width).getDisplayValues();
        return { start, rows: values.map((r) => cols.map((c) => r[c])) };
      }
      case "row": {
        const row = parseInt(p.row, 10);
        if (!(row >= 2)) throw new Error("bad_row");
        return { row, values: sh.getRange(row, 1, 1, sh.getLastColumn()).getDisplayValues()[0] };
      }
      case "find": {
        // Exact match on the barcode column first, then the item code column.
        const code = String(p.code || "").trim();
        if (!code) return { row: null };
        for (const col of [2, 1]) {
          const hit = sh.getRange(2, col, Math.max(1, sh.getLastRow() - 1), 1).createTextFinder(code).matchEntireCell(true).findNext();
          if (hit) return { row: hit.getRow() };
        }
        return { row: null };
      }
      case "photos": {
        // Which items have a photo, so the app only asks for photos that exist.
        const codes = [], it = folder_().getFiles();
        while (it.hasNext()) { const n = it.next().getName(); if (/^item-.*\.jpg$/.test(n)) codes.push(decodeURIComponent(n.slice(5, -4))); }
        return { codes };
      }
      case "photo": {
        const file = photoFile_(p.code);
        if (!file) return { data: null };
        return { data: Utilities.base64Encode(file.getBlob().getBytes()), type: file.getMimeType(), updated: file.getLastUpdated().toISOString() };
      }
      default:
        throw new Error("unknown_action");
    }
  });
}

function doPost(e) {
  return respond_(() => {
    const body = JSON.parse(e.postData.contents || "{}");
    checkKey_(body.key);
    if (body.action !== "photo") throw new Error("unknown_action");
    const code = String(body.code || "").trim();
    if (!code || !body.data) throw new Error("bad_photo");
    const old = photoFile_(code);
    if (old) old.setTrashed(true);
    const blob = Utilities.newBlob(Utilities.base64Decode(body.data), "image/jpeg", photoName_(code));
    folder_().createFile(blob);
    return { saved: true };
  });
}

function respond_(fn) {
  let out;
  try { out = fn(); } catch (err) { out = { error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function checkKey_(k) { if (!KEY || KEY.indexOf("PASTE_") === 0 || k !== KEY) throw new Error("bad_key"); }
function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
  if (!sh) throw new Error("no_tab");
  return sh;
}
function folder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}
function photoName_(code) { return "item-" + encodeURIComponent(code) + ".jpg"; }
function photoFile_(code) {
  const it = folder_().getFilesByName(photoName_(String(code || "").trim()));
  return it.hasNext() ? it.next() : null;
}
