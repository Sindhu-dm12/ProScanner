/**
 * Downscale large photos before upload to avoid size / memory errors (client-side).
 */
export async function compressImageFile(file, maxEdge = 1600, quality = 0.82) {
  if (!file?.type?.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const maxDim = Math.max(width, height);
    const needsScale = maxDim > maxEdge;
    const needsShrinkBytes = file.size > 1_200_000;

    if (!needsScale && !needsShrinkBytes) {
      bitmap.close();
      return file;
    }

    const scale = needsScale ? maxEdge / maxDim : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || null), 'image/jpeg', quality);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'scan';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
