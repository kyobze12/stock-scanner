# FTC Stock Scanner

A phone web app for Farmers Trading Center: point the camera at a barcode and see the item's price, stock and details from the store's Google Sheet. It reads the sheet only; it never changes it.

Live app: https://kyobze12.github.io/stock-scanner/

## How it works

- `index.html` is the whole app (React + Tailwind from CDNs, barcode reading with the phone's built-in reader or ZXing).
- The sheet is read through a small Google Apps Script web app (`apps-script/Code.gs`) that the sheet owner adds to the sheet. Every request carries a secret key; the script refuses requests without it.
- The search list (about 166k items) is downloaded once and cached on each phone, refreshed daily. Opening an item reads its row live.
- Item photos (optional, in the ⋯ menu on an item) are saved to a "Stock Scanner Photos" folder in the sheet owner's Google Drive.

## Set up the sheet connection

1. Open the item sheet → **Extensions → Apps Script**.
2. Replace the editor's contents with `apps-script/Code.gs`, set `KEY` to a long random secret, and check `TAB` matches the item tab name. Save.
3. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, authorize, and copy the web app link (ends in `/exec`).
4. Open the app → **Settings** → paste the link and the key → **Save and connect**.
5. Tap **Copy setup link for staff** and send it to staff. Opening it once connects their phone.

No sheet data or keys are stored in this repository.
