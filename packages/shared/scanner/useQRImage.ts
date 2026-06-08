/**
 * Generate a styled QR code as a data URL for use in <img> tags.
 * Dynamically imports `qr-code-styling` for SSR safety (browser APIs only).
 *
 * Style: rounded dots, extra-rounded corner squares, square inner corner dots,
 * pure black on transparent. Error correction level H.
 */
export async function generateQRDataUrl(
  data: string,
  options?: { width?: number; margin?: number },
): Promise<string> {
  const { default: QRCodeStyling } = await import("qr-code-styling");
  const width = options?.width ?? 256;

  const qr = new QRCodeStyling({
    type: "canvas",
    width,
    height: width,
    data,
    margin: options?.margin ?? 0,
    qrOptions: { errorCorrectionLevel: "L" },
    dotsOptions: { type: "dots", color: "#000000" },
    cornersSquareOptions: { type: "extra-rounded", color: "#000000" },
    cornersDotOptions: { type: "square", color: "#000000" },
    backgroundOptions: { color: "transparent" },
  });

  const blob = await qr.getRawData("png");
  if (!blob) throw new Error("failed to generate qr");
  return await blobToDataUrl(blob as Blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("blob read failed"));
    reader.readAsDataURL(blob);
  });
}
