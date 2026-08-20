import { validatePlantImage } from "../components/UploadPanel";

export function makePhotoPreview(file) {
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    url: URL.createObjectURL(file),
  };
}

export function validateFiles(files) {
  for (const file of files) {
    const error = validatePlantImage(file.file || file);
    if (error) return error;
  }
  return "";
}

export function revokePreviews(photos) {
  photos.forEach((photo) => {
    if (photo.url?.startsWith("blob:")) URL.revokeObjectURL(photo.url);
  });
}
