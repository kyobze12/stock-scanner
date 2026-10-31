/* Reads barcodes from camera frames off the main thread, so the screen stays smooth while it works. */
importScripts("__ZXING_URL__");
let reader = null;
function init() {
  const Z = self.ZXing, F = Z.BarcodeFormat, hints = new Map();
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX]);
  reader = new Z.MultiFormatReader(); reader.setHints(hints);
}
self.onmessage = (e) => {
  const { id, width: w, height: h, buf } = e.data;
  let text = null;
  try {
    if (!reader) init();
    const px = new Uint8ClampedArray(buf), lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    const Z = self.ZXing;
    text = reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, h, w, h, 0, 0)))).getText();
  } catch (_) { text = null; }
  finally { if (reader) reader.reset(); }
  self.postMessage({ id, text });
};
