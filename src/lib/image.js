// Client-side image downscaling. Keeps stored covers tiny (~20-60KB)
// by capping width and re-encoding as WebP (JPEG fallback).
export function shrinkImage(file, maxW = 400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const done = (blob, ext) => {
        if (blob) resolve({ blob, ext });
        else reject(new Error("Could not encode image"));
      };
      canvas.toBlob(
        (b) => (b ? done(b, "webp") : canvas.toBlob((j) => done(j, "jpg"), "image/jpeg", quality)),
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file"));
    };
    img.src = url;
  });
}
