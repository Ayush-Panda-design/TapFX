import { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";

/**
 * Decodes RGBA pixels with ZXing (the decoder family used by Android scanners).
 * Used for the in-editor "scan check" and in tests. ZXing is far more tolerant of
 * styled modules (hearts, circles, diamonds) than lightweight decoders like jsQR.
 */
export function decodePixels(data: Uint8ClampedArray | Uint8Array, width: number, height: number): string | null {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    lum[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  }
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, width, height)));
    return new QRCodeReader().decode(bitmap, hints).getText();
  } catch {
    return null; // NotFound / Checksum / Format: nothing readable
  }
}
