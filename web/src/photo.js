const PHOTO_SIZE = 400;

// Снимок в чате: длинная сторона не больше 1280px — на экране крупнее он не
// показывается, а вес падает в разы. Предел строки — тот же, что проверяет сервер
const CHAT_SIDE = 1280;
const CHAT_LIMIT = 900_000;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('broken image'));
    };

    image.src = objectUrl;
  });
}

/**
 * Ужимает картинку до квадрата PHOTO_SIZE и возвращает data URL.
 * Кадрирование «по центру» — ровно то, что делает object-fit: cover в карточке.
 * Так фото уходит на сервер обычным JSON: ни загрузки файлов, ни лишней зависимости.
 */
export async function squareDataUrl(file) {
  const image = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;

  const scale = Math.max(PHOTO_SIZE / image.width, PHOTO_SIZE / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  const context = canvas.getContext('2d');
  context.drawImage(image, (PHOTO_SIZE - width) / 2, (PHOTO_SIZE - height) / 2, width, height);

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Снимок для чата: пропорции сохраняются (кадрировать чужое фото нельзя),
 * уменьшается только размер. Если и так тяжело — сжимаем сильнее.
 * Возвращает data URL и размеры: по ним лента заранее держит место под снимок.
 */
export async function chatPhoto(file) {
  const image = await loadImage(file);

  const scale = Math.min(1, CHAT_SIDE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);

  for (const quality of [0.82, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= CHAT_LIMIT) return { dataUrl, width, height };
  }
  throw new Error('too large');
}
