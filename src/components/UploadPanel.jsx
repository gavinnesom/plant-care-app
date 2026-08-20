import { useCallback, useState } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IDENTIFICATION_IMAGES,
  MAX_IMAGE_BYTES,
} from "../lib/plantSchema";

const maxMb = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);

export function validatePlantImage(file) {
  if (!file) return "Choose a JPG, PNG, or WebP image first.";
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
    return "Please choose a JPG, PNG, or WebP image.";
  if (file.size > MAX_IMAGE_BYTES)
    return `Please choose an image smaller than ${maxMb} MB.`;
  return "";
}

export function UploadPanel({
  photos,
  loading,
  onFilesSelected,
  onRemovePhoto,
  onIdentify,
  onClear,
  error,
}) {
  const [dragging, setDragging] = useState(false);
  const hasPhotos = photos.length > 0;

  const handleFiles = useCallback(
    (files) => {
      const nextFiles = Array.from(files || []);
      if (nextFiles.length) onFilesSelected(nextFiles);
    },
    [onFilesSelected],
  );

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <section className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-shell)] p-3 shadow-2xl shadow-black/20 sm:p-4">
      <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-lg shadow-black/15 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-200">
              Step 1
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-[var(--app-text)]">
                Build a photo set
              </h2>
              <label className="inline-flex w-fit cursor-pointer rounded-[8px] bg-[var(--app-leaf)] px-4 py-2 text-sm font-black text-[#1f2618] shadow-sm transition hover:bg-[#c9e899]">
                Browse photos
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  onChange={(event) => {
                    handleFiles(event.target.files);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
          {hasPhotos && (
            <p className="max-w-full truncate rounded-full bg-emerald-300/10 px-3 py-1 text-sm font-bold text-emerald-100 ring-1 ring-emerald-300/25">
              {photos.length} of {MAX_IDENTIFICATION_IMAGES} photos
            </p>
          )}
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`mt-5 rounded-[14px] border-2 border-dashed p-4 transition ${
            dragging
              ? "border-[var(--app-leaf)] bg-[var(--app-bark)]"
              : "border-[var(--app-border-strong)] bg-[var(--app-bark)]"
          }`}
        >
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--app-text-muted)]">
            Drag plant photos here, or use Browse photos above. JPG, PNG, or
            WebP up to {maxMb} MB each.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-[12px] border border-rose-200/40 bg-rose-200/15 p-4 text-sm font-semibold text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-[14px] border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] shadow-sm">
          {hasPhotos ? (
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              {photos.map((photo) => (
                <figure
                  key={photo.id}
                  className="relative overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bark)]"
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-[var(--app-text-muted)]">
                    <span className="min-w-0 truncate">{photo.file.name}</span>
                    <button
                      type="button"
                      className="text-[var(--app-leaf)] hover:text-[#d5f0a5]"
                      onClick={() => onRemovePhoto(photo.id)}
                    >
                      Remove
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center bg-[var(--app-panel-soft)] px-6 text-center text-[var(--app-ink-muted)]">
              Your selected plant photos will appear here.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onIdentify}
            disabled={!hasPhotos || loading}
            className="rounded-[8px] bg-[var(--app-leaf)] px-5 py-3 text-sm font-black text-[#1f2618] shadow-sm transition hover:bg-[#c9e899] disabled:cursor-not-allowed disabled:bg-[#8b9075] disabled:text-[#e7dac1]"
          >
            {loading ? "Identifying..." : "Identify with AI"}
          </button>
          <button
            onClick={onClear}
            disabled={loading && !hasPhotos}
            className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bark)] px-5 py-3 text-sm font-black text-[var(--app-text)] shadow-sm transition hover:bg-[#6b553e]"
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
