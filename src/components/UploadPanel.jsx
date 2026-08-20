import { useCallback, useState } from 'react';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '../lib/plantSchema';

const maxMb = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);

export function validatePlantImage(file) {
  if (!file) return 'Choose a JPG, PNG, or WebP image first.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return `Please choose an image smaller than ${maxMb} MB.`;
  return '';
}

export function UploadPanel({ imageUrl, fileName, loading, onFileSelected, onIdentify, onClear, error }) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file) => {
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <section className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-shell)] p-3 shadow-2xl shadow-black/20 sm:p-4">
      <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-lg shadow-black/15 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-200">Step 1</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-[var(--app-text)]">Upload a plant photo</h2>
            <label className="inline-flex w-fit cursor-pointer rounded-[8px] bg-[var(--app-leaf)] px-4 py-2 text-sm font-black text-[#1f2618] shadow-sm transition hover:bg-[#c9e899]">
              Browse photo
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={(event) => handleFile(event.target.files?.[0])}
                className="sr-only"
              />
            </label>
          </div>
        </div>
        {fileName && <p className="max-w-full truncate rounded-full bg-emerald-300/10 px-3 py-1 text-sm font-bold text-emerald-100 ring-1 ring-emerald-300/25">{fileName}</p>}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-5 rounded-[14px] border-2 border-dashed p-4 transition ${
          dragging ? 'border-[var(--app-leaf)] bg-[var(--app-bark)]' : 'border-[var(--app-border-strong)] bg-[var(--app-bark)]'
        }`}
      >
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--app-text-muted)]">
          Drag a plant photo here, or use Browse photo above. JPG, PNG, or WebP up to {maxMb} MB.
        </p>
      </div>

      {error && <div className="mt-4 rounded-[12px] border border-rose-200/40 bg-rose-200/15 p-4 text-sm font-semibold text-rose-100">{error}</div>}

      <div className="mt-5 overflow-hidden rounded-[14px] border border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] shadow-sm">
        {imageUrl ? (
          <img src={imageUrl} alt="Uploaded plant preview" className="block max-h-[520px] w-full object-cover" />
        ) : (
          <div className="flex min-h-[320px] items-center justify-center bg-[var(--app-panel-soft)] px-6 text-center text-[var(--app-ink-muted)]">
            Your selected plant photo will appear here.
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
          <button
          onClick={onIdentify}
          disabled={!imageUrl || loading}
          className="rounded-[8px] bg-[var(--app-leaf)] px-5 py-3 text-sm font-black text-[#1f2618] shadow-sm transition hover:bg-[#c9e899] disabled:cursor-not-allowed disabled:bg-[#8b9075] disabled:text-[#e7dac1]"
        >
          {loading ? 'Identifying...' : 'Identify plant'}
        </button>
        <button
          onClick={onClear}
          disabled={loading && !imageUrl}
          className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bark)] px-5 py-3 text-sm font-black text-[var(--app-text)] shadow-sm transition hover:bg-[#6b553e]"
        >
          Clear
        </button>
      </div>
      </div>
    </section>
  );
}
