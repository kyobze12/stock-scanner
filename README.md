# FTC Stock Scanner

A phone web app for Farmers Trading Center: point the camera at a barcode and see the item's price, stock and details from the store's Google Sheet. It reads the sheet only; it never changes it.

Live app: https://kyobze12.github.io/stock-scanner/

## How it works

- The sheet is read through a small Google Apps Script web app (`apps-script/Code.gs`) that the sheet owner adds to the sheet. Every request carries a secret key; the script refuses requests without it.
- All ~166k items are downloaded once into a compact index kept on the phone (IndexedDB, about 17 MB), so search and scanning are instant and work offline. The app asks the sheet "anything new?" when opened and downloads again only when the sheet changed.
- Opening an item reads its row live from the sheet. A scanned barcode that isn't in the saved index yet is looked up in the sheet directly.
- Barcodes are read live from the camera (the phone's built-in reader where it exists, otherwise ZXing in a background worker).
- Item photos (optional, in the ⋯ menu on an item) are saved to a "Stock Scanner Photos" folder in the sheet owner's Google Drive.
- A service worker keeps the app's own files on the phone so it opens instantly and offline.

## Set up the sheet connection

1. Open the item sheet → **Extensions → Apps Script**.
2. Replace the editor's contents with `apps-script/Code.gs`, set `KEY` to a long random secret, and check `TAB` matches the item tab name. Save.
3. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, authorize, and copy the web app link (ends in `/exec`). After later script changes use **Manage deployments → ✏️ → Version: New version**.
4. Open the app → **Settings** → paste the link and the key → **Save and connect**.
5. Tap **Copy setup link for staff** and send it to staff. Opening it once connects their phone.

No sheet data or keys are stored in this repository.

## Developing

```
npm install
npm run build      # src/ -> dist/
```

- `src/app.js` is the whole app (React + htm, Tailwind classes), `src/styles.css` the theme tokens and animations.
- `tools/build.mjs` compiles the CSS, minifies the script, copies React/ZXing/fonts so everything is served from the same site, and generates the service worker.
- `dist/` is committed; `.github/workflows/pages.yml` publishes it to GitHub Pages on every push to `main`.
- The page's Content-Security-Policy only allows this site plus `script.google.com`.
