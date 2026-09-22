const PHOTO_SIZE = 400;

/**
 * Ужимает картинку до квадрата PHOTO_SIZE и возвращает data URL.
 * Кадрирование «по центру» — ровно то, что делает object-fit: cover в карточке.
 * Так фото уходит на сервер обычным JSON: ни загрузки файлов, ни лишней зависимости.
 */
export function squareDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = PHOTO_SIZE;
      canvas.height = PHOTO_SIZE;

      const scale = Math.max(PHOTO_SIZE / image.width, PHOTO_SIZE / image.height);
      const width = image.width * scale;
      const height = image.height * scale;

      const context = canvas.getContext('2d');
      context.drawImage(image, (PHOTO_SIZE - width) / 2, (PHOTO_SIZE - height) / 2, width, height);

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('broken image'));
    };

    image.src = objectUrl;
  });
}
