import { LOW_CONFIDENCE_THRESHOLD, resultSectionLabels } from '../lib/plantSchema';
import { TraitBadge } from './TraitBadge';

function confidenceLabel(confidence) {
  return `${Math.round((confidence || 0) * 100)}%`;
}

export function ResultPanel({ result, loading, onAddToGarden }) {
  if (loading) {
    return (
      <section className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-shell)] p-3 shadow-2xl shadow-black/20 sm:p-4">
        <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-lg shadow-black/15 sm:p-6">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-200">Step 2</p>
        <h2 className="mt-1 text-2xl font-black text-[var(--app-text)]">Reading the plant clues</h2>
        <div className="mt-6 min-h-[420px] rounded-[14px] bg-[var(--app-panel-soft)] p-5">
          <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-5 h-14 animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-shell)] p-3 shadow-2xl shadow-black/20 sm:p-4">
        <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-lg shadow-black/15 sm:p-6">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-200">Step 2</p>
        <h2 className="mt-1 text-2xl font-black text-[var(--app-text)]">Plant-care result</h2>
        <div className="mt-6 flex min-h-[420px] items-center justify-center rounded-[14px] border-2 border-dashed border-[var(--app-border-strong)] bg-[var(--app-bark)] px-6 text-center text-[var(--app-text-muted)]">
          Upload a plant photo to see a polished care card with name, confidence, traits, and practical notes.
        </div>
        </div>
      </section>
    );
  }

  const care = result.care || {};
  const summaryTraits = [
    care.light,
    care.water,
    care.soil,
    care.difficulty,
    care.californiaSuitability,
    care.petSafety,
  ].filter(Boolean);
  const lowConfidence = result.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <section className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-shell)] p-3 shadow-2xl shadow-black/20 sm:p-4">
      <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-5 text-[var(--app-ink)] shadow-lg shadow-black/15">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">Likely match</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight text-[var(--app-ink)]">{result.commonName}</h2>
            <p className="mt-1 text-lg italic text-[var(--app-ink-muted)]">{result.scientificName}</p>
          </div>
          <div className="rounded-[12px] bg-emerald-100 px-4 py-3 text-emerald-950">
            <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Confidence</p>
            <p className="text-2xl font-black">{confidenceLabel(result.confidence)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddToGarden}
          className="mt-5 rounded-[8px] bg-[var(--app-plum)] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[var(--app-plum-dark)]"
        >
          Add to Garden
        </button>

        {lowConfidence && (
          <div className="mt-5 rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            Low-confidence identification. Compare the alternatives below and confirm with another source before acting on the result.
          </div>
        )}

        <p className="mt-5 text-base leading-relaxed text-[var(--app-ink)]">{result.identificationNotes}</p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--app-ink-muted)]">
          AI-assisted identification can be uncertain. Confirm before eating or touching unknown plants, treating pests or disease,
          or exposing pets and children.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaryTraits.map((trait) => (
            <TraitBadge key={trait} value={trait} />
          ))}
        </div>
      </div>

      {result.likelyAlternatives?.length > 0 && (
        <div className="mt-5 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-lg shadow-black/15">
          <h3 className="text-lg font-black text-[var(--app-text)]">Likely alternatives</h3>
          <div className="mt-3 grid gap-3">
            {result.likelyAlternatives.map((plant) => (
              <div key={`${plant.commonName}-${plant.scientificName}`} className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bark)] p-4">
                <p className="font-extrabold text-[var(--app-text)]">{plant.commonName}</p>
                <p className="text-sm italic text-[var(--app-text-muted)]">{plant.scientificName}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{plant.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        <GrowingConditions sections={result.sections} />

        {Object.entries(resultSectionLabels).map(([key, label]) => {
          const text = result.sections?.[key];
          if (!text) return null;
          return <CareDetails key={key} title={label} open={key === 'overview'}>{text}</CareDetails>;
        })}
      </div>
    </section>
  );
}

function GrowingConditions({ sections }) {
  const conditionItems = [
    ['Sunlight', sections?.sunlight],
    ['Watering', sections?.watering],
    ['Soil', sections?.soil],
  ].filter(([, text]) => Boolean(text));

  if (!conditionItems.length) return null;

  return (
    <details className="group rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-[var(--app-ink)] shadow-sm">
      <summary className="cursor-pointer list-none text-base font-black text-[var(--app-ink)]">
        <SummaryLabel title="Sun, water, and soil" />
      </summary>
      <div className="mt-4 grid gap-3">
        {conditionItems.map(([title, text]) => (
          <div key={title} className="rounded-[12px] bg-slate-100 p-4">
            <p className="text-sm font-black text-[var(--app-ink)]">{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-ink-muted)]">{text}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function CareDetails({ title, open = false, children }) {
  return (
    <details className="group rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-[var(--app-ink)] shadow-sm" open={open}>
      <summary className="cursor-pointer list-none text-base font-black text-[var(--app-ink)]">
        <SummaryLabel title={title} />
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-[var(--app-ink-muted)]">{children}</p>
    </details>
  );
}

function SummaryLabel({ title }) {
  return (
    <span className="inline-flex w-full items-center justify-between gap-4">
      {title}
      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-[var(--app-ink-muted)] group-open:hidden">Open</span>
      <span className="hidden rounded-full bg-slate-200 px-2 py-1 text-xs text-[var(--app-ink-muted)] group-open:inline">Close</span>
    </span>
  );
}
