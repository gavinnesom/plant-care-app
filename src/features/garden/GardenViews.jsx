import { useState } from "react";
import { ErrorBanner, TitleGroup } from "../../components/AppChrome";
import { MAX_IDENTIFICATION_IMAGES } from "../../lib/plantSchema";

export function GardenList({
  plants,
  loading,
  error,
  modeControl,
  onGrow,
  onOpenPlant,
}) {
  return (
    <main>
      <section className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TitleGroup title="My Garden" action={modeControl} />
          <button
            className="garden-button garden-button-primary"
            onClick={onGrow}
          >
            Grow
          </button>
        </div>
      </section>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {loading && (
        <p className="mt-6 text-[var(--app-text-muted)]">
          Opening My Garden...
        </p>
      )}
      {!loading && plants.length === 0 && (
        <section className="mt-6 border-y border-dashed border-[var(--app-border-strong)] py-10 text-center text-[var(--app-text-muted)]">
          <p className="text-lg font-black text-[var(--app-text)]">
            No saved plants yet
          </p>
          <p className="mt-2">
            Use Grow to create one, or save a result from Identify Plant.
          </p>
        </section>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {plants.map((plant) => (
          <button
            key={plant.id}
            className="garden-tile text-left"
            onClick={() => onOpenPlant(plant)}
          >
            <PhotoFrame plant={plant} />
            <div className="mt-4">
              <h2 className="text-xl font-black text-[var(--app-text)]">
                {plant.plantName}
              </h2>
              {plant.location && (
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                  {plant.location}
                </p>
              )}
              <p className="mt-3 text-sm font-bold text-[var(--app-leaf)]">
                {plant.plantType || "Plant Type not set"}
              </p>
              <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                {plant.photoCount || 0} saved photo
                {Number(plant.photoCount) === 1 ? "" : "s"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

export function GrowPlant({
  draft,
  onChange,
  error,
  busy,
  modeControl,
  onAddFiles,
  onRemoveFile,
  onToggleFile,
  onIdentify,
  onSave,
  onCancel,
}) {
  const blocked = Boolean(busy);
  return (
    <main className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10">
      <TitleGroup title="Save a garden plant" action={modeControl} />
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <SectionHeading>Identity / reference photos</SectionHeading>
          <PhotoFilePicker
            files={draft.files}
            selectedIds={draft.selectedFileIds}
            onAdd={onAddFiles}
            onRemove={onRemoveFile}
            onToggle={onToggleFile}
            disabled={blocked}
          />
          <button
            className="garden-button garden-button-primary mt-4 w-full"
            disabled={blocked || !draft.selectedFileIds.length}
            onClick={onIdentify}
          >
            {busy === "identify-draft"
              ? "Identifying..."
              : draft.result
                ? "Re-identify with AI"
                : "Identify with AI"}
          </button>
          <p className="mt-2 text-xs text-[var(--app-text-muted)]">
            {draft.selectedFileIds.length} of {MAX_IDENTIFICATION_IMAGES}{" "}
            selected for this request
          </p>
        </section>
        <PlantForm value={draft} onChange={onChange} />
      </div>
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          className="garden-button garden-button-primary"
          disabled={blocked}
          onClick={onSave}
        >
          {busy === "save-draft" ? "Saving..." : "Save plant"}
        </button>
        <button className="garden-button" disabled={blocked} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </main>
  );
}

export function PlantDetail({
  plant,
  onChange,
  error,
  busy,
  modeControl,
  onBack,
  onSave,
  onDelete,
  onAddReferencePhotos,
  onDeletePhoto,
  onIdentify,
  onCareGuide,
  onSaveObservation,
  onDiagnose,
}) {
  const blocked = Boolean(busy);
  const referencePhotos = plant.photos.filter(
    (photo) => photo.purpose === "identity_reference",
  );
  const problemPhotos = plant.photos.filter(
    (photo) => photo.purpose === "observation_problem",
  );
  const toggleReference = (id) => {
    const ids = plant.selectedReferencePhotoIds || [];
    const next = ids.includes(id)
      ? ids.filter((item) => item !== id)
      : ids.length < MAX_IDENTIFICATION_IMAGES
        ? [...ids, id]
        : ids;
    onChange({ ...plant, selectedReferencePhotoIds: next });
  };
  const toggleObservation = (id) => {
    const ids = plant.selectedObservationIds || [];
    const next = ids.includes(id)
      ? ids.filter((item) => item !== id)
      : [...ids, id];
    onChange({ ...plant, selectedObservationIds: next });
  };

  return (
    <main className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10">
      <TitleGroup title={plant.plantName} action={modeControl} />
      <button
        className="mt-3 text-sm font-black text-[var(--app-leaf)]"
        onClick={onBack}
      >
        Back to My Garden
      </button>
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="mt-7 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid content-start gap-8">
          <section>
            <div className="flex items-center justify-between gap-3">
              <SectionHeading>Identity / reference photos</SectionHeading>
              <FileButton
                label="Add"
                disabled={blocked}
                onFiles={onAddReferencePhotos}
              />
            </div>
            <SavedPhotos
              photos={referencePhotos}
              selectedIds={plant.selectedReferencePhotoIds || []}
              onToggle={toggleReference}
              onDelete={onDeletePhoto}
              disabled={blocked}
            />
            <p className="mt-3 text-xs text-[var(--app-text-muted)]">
              {(plant.selectedReferencePhotoIds || []).length} of{" "}
              {MAX_IDENTIFICATION_IMAGES} selected for Identify/Re-identify
            </p>
            <button
              className="garden-button garden-button-primary mt-3 w-full"
              disabled={
                blocked || !(plant.selectedReferencePhotoIds || []).length
              }
              onClick={onIdentify}
            >
              {busy === "identify-plant"
                ? "Identifying..."
                : plant.aiAssessment
                  ? "Re-identify with AI"
                  : "Identify with AI"}
            </button>
          </section>

          <section className="border-t border-[var(--app-border)] pt-7">
            <SectionHeading>Care guide</SectionHeading>
            <button
              className="garden-button garden-button-primary mt-3"
              disabled={blocked}
              onClick={onCareGuide}
            >
              {busy === "care-guide"
                ? "Generating..."
                : plant.careGuide
                  ? "Refresh care guide"
                  : "Generate care guide"}
            </button>
            {plant.careGuide && <CareGuide guide={plant.careGuide.guide} />}
          </section>
        </div>

        <div className="grid content-start gap-8">
          <section>
            <PlantForm value={plant} onChange={onChange} />
            <AssessmentSummary assessment={plant.aiAssessment} />
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="garden-button garden-button-primary"
                disabled={blocked}
                onClick={onSave}
              >
                {busy === "save-plant" ? "Saving..." : "Save edits"}
              </button>
              <button
                className="garden-button garden-button-danger"
                disabled={blocked}
                onClick={onDelete}
              >
                {busy === "delete-plant" ? "Deleting..." : "Delete plant"}
              </button>
            </div>
          </section>

          <section className="border-t border-[var(--app-border)] pt-7">
            <SectionHeading>Observations / problems</SectionHeading>
            <ObservationForm
              disabled={blocked}
              onSave={onSaveObservation}
              saving={busy === "observation"}
            />
            <ObservationList
              observations={plant.observations || []}
              photos={problemPhotos}
              selectedIds={plant.selectedObservationIds || []}
              onToggle={toggleObservation}
              onDeletePhoto={onDeletePhoto}
              disabled={blocked}
            />
            <button
              className="garden-button garden-button-primary mt-4"
              disabled={blocked || !(plant.selectedObservationIds || []).length}
              onClick={onDiagnose}
            >
              {busy === "diagnosis" ? "Diagnosing..." : "Diagnose problem"}
            </button>
            {plant.diagnosis && (
              <DiagnosisView diagnosis={plant.diagnosis.diagnosis} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function PlantForm({ value, onChange }) {
  const update = (field, nextValue) =>
    onChange({ ...value, [field]: nextValue });
  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className="form-label">Plant Name</span>
        <input
          className="garden-input"
          value={value.plantName || ""}
          onChange={(event) => update("plantName", event.target.value)}
        />
      </label>
      <label className="grid gap-2">
        <span className="form-label">Location</span>
        <input
          className="garden-input"
          value={value.location || ""}
          onChange={(event) => update("location", event.target.value)}
          placeholder="on the patio"
        />
      </label>
      <label className="grid gap-2">
        <span className="form-label">Plant Type</span>
        <input
          className="garden-input"
          value={value.plantType || ""}
          onChange={(event) => update("plantType", event.target.value)}
        />
      </label>
      {"identitySource" in value && (
        <label className="grid gap-2">
          <span className="form-label">Identity source</span>
          <select
            className="garden-input"
            value={value.identitySource || "manual"}
            onChange={(event) => update("identitySource", event.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="ai_accepted">AI accepted</option>
            <option value="label_confirmed">Label confirmed</option>
          </select>
        </label>
      )}
      <div className="border-l-4 border-[var(--app-moss)] pl-4 text-sm text-[var(--app-ink)]">
        <p className="form-label text-[var(--app-moss-dark)]">Latest AI ID</p>
        <p className="mt-2 font-black">
          {value.result?.scientificName ||
            value.aiScientificName ||
            value.aiCommonName ||
            "No assessment"}
        </p>
      </div>
    </div>
  );
}

function PhotoFilePicker({
  files,
  selectedIds,
  onAdd,
  onRemove,
  onToggle,
  disabled,
}) {
  return (
    <div className="mt-3">
      <FileButton label="Add photos" disabled={disabled} onFiles={onAdd} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {files.map((photo) => (
          <figure
            key={photo.id}
            className="overflow-hidden rounded-[8px] border border-[var(--app-border)]"
          >
            <img
              src={photo.url}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
            <figcaption className="grid gap-2 p-3 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(photo.id)}
                  onChange={() => onToggle(photo.id)}
                />
                Use for AI
              </label>
              <button
                className="text-left font-bold text-[var(--app-danger)]"
                onClick={() => onRemove(photo.id)}
              >
                Remove
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function SavedPhotos({ photos, selectedIds, onToggle, onDelete, disabled }) {
  if (!photos.length)
    return (
      <div className="mt-3 flex aspect-[4/3] items-center justify-center border border-dashed border-[var(--app-border-strong)] text-sm font-bold text-[var(--app-text-muted)]">
        No reference photos
      </div>
    );
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {photos.map((photo) => (
        <figure
          key={photo.id}
          className="overflow-hidden rounded-[8px] border border-[var(--app-border)]"
        >
          <img
            src={photo.url}
            alt={photo.altText}
            className="aspect-[4/3] w-full object-cover"
          />
          <figcaption className="grid gap-2 p-3 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(photo.id)}
                disabled={disabled}
                onChange={() => onToggle(photo.id)}
              />
              Use for AI ID
            </label>
            <button
              className="text-left font-bold text-[var(--app-danger)]"
              disabled={disabled}
              onClick={() => onDelete(photo.id)}
            >
              Remove photo
            </button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function ObservationForm({ disabled, onSave, saving }) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const submit = async (event) => {
    event.preventDefault();
    const saved = await onSave({ description, files });
    if (saved) {
      setDescription("");
      setFiles([]);
    }
  };
  return (
    <form className="mt-4 grid gap-3" onSubmit={submit}>
      <textarea
        className="garden-input min-h-24"
        required
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Yellowing leaves, wilting, spots, pests, unusual growth..."
      />
      <label className="garden-button w-fit cursor-pointer">
        Add problem photos
        <input
          className="sr-only"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => {
            setFiles(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <p className="text-xs text-[var(--app-text-muted)]">
          {files.map((file) => file.name).join(", ")}
        </p>
      )}
      <button className="garden-button" disabled={disabled}>
        {saving ? "Saving..." : "Save observation"}
      </button>
    </form>
  );
}

function AssessmentSummary({ assessment }) {
  if (!assessment) return null;
  const result = assessment.result || {};
  return (
    <div className="mt-5 border-l-4 border-[var(--app-gold)] pl-4 text-sm text-[var(--app-ink)]">
      <p className="font-black">
        AI confidence: {Math.round(Number(assessment.confidence) * 100)}%
      </p>
      {result.identificationNotes && (
        <p className="mt-2 leading-relaxed">{result.identificationNotes}</p>
      )}
      {result.likelyAlternatives?.length > 0 && (
        <p className="mt-2 text-[var(--app-ink-muted)]">
          Alternatives:{" "}
          {result.likelyAlternatives
            .map((item) => item.scientificName || item.commonName)
            .join(", ")}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--app-text-muted)]">
        Assessed {new Date(assessment.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function ObservationList({
  observations,
  photos,
  selectedIds,
  onToggle,
  onDeletePhoto,
  disabled,
}) {
  if (!observations.length) return null;
  const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
  return (
    <div className="mt-5 grid gap-4">
      {observations.map((observation) => (
        <article
          key={observation.id}
          className="border-l-4 border-[var(--app-gold)] pl-4"
        >
          <label className="flex items-start gap-3">
            <input
              className="mt-1"
              type="checkbox"
              checked={selectedIds.includes(observation.id)}
              disabled={disabled}
              onChange={() => onToggle(observation.id)}
            />
            <span>
              <span className="block text-sm font-bold text-[var(--app-text)]">
                {observation.description}
              </span>
              <span className="mt-1 block text-xs text-[var(--app-text-muted)]">
                {new Date(observation.observedAt).toLocaleDateString()}
              </span>
            </span>
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {observation.photoIds
              .map((id) => photoMap.get(id))
              .filter(Boolean)
              .map((photo) => (
                <figure key={photo.id}>
                  <img
                    src={photo.url}
                    alt={photo.altText}
                    className="aspect-square w-full rounded-[6px] object-cover"
                  />
                  <button
                    className="mt-1 text-xs font-bold text-[var(--app-danger)]"
                    disabled={disabled}
                    onClick={() => onDeletePhoto(photo.id)}
                  >
                    Remove
                  </button>
                </figure>
              ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function CareGuide({ guide }) {
  return (
    <dl className="mt-5 grid gap-4 text-sm">
      {Object.entries(guide).map(([key, value]) => (
        <div key={key}>
          <dt className="font-black capitalize text-[var(--app-moss-dark)]">
            {splitKey(key)}
          </dt>
          <dd className="mt-1 leading-relaxed text-[var(--app-ink)]">
            {Array.isArray(value) ? value.join(" • ") : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DiagnosisView({ diagnosis }) {
  return (
    <div className="mt-5 border-t border-[var(--app-border)] pt-5 text-sm text-[var(--app-ink)]">
      <p className="font-black text-[var(--app-text)]">{diagnosis.summary}</p>
      <p className="mt-2">
        Confidence: {Math.round(Number(diagnosis.confidence) * 100)}%
      </p>
      {diagnosis.likelyCauses?.map((item) => (
        <div key={item.cause} className="mt-4">
          <p className="font-black">
            {item.cause} · {item.likelihood}
          </p>
          <p className="mt-1 leading-relaxed">{item.rationale}</p>
        </div>
      ))}
      <List title="Recommended actions" items={diagnosis.recommendedActions} />
      <List title="Monitor next" items={diagnosis.monitorNext} />
      <List title="Safety" items={diagnosis.urgentSafetyNotes} />
      {diagnosis.uncertainty && (
        <p className="mt-4 italic">{diagnosis.uncertainty}</p>
      )}
    </div>
  );
}

function List({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="font-black">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FileButton({ label, disabled, onFiles }) {
  return (
    <label
      className={`garden-button cursor-pointer ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      {label}
      <input
        className="sr-only"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--app-moss-dark)]">
      {children}
    </h2>
  );
}

function PhotoFrame({ plant }) {
  if (plant.photoUrl)
    return (
      <img
        src={plant.photoUrl}
        alt=""
        className="aspect-[4/3] w-full rounded-[8px] object-cover"
      />
    );
  return (
    <div className="flex aspect-[4/3] items-center justify-center border border-dashed border-[var(--app-border-strong)] text-sm font-bold text-[var(--app-text-muted)]">
      No photo
    </div>
  );
}

function splitKey(key) {
  return key.replace(/([A-Z])/g, " $1").trim();
}
