const CARE_FIELDS = [
  ["Sunlight", "sunlight"],
  ["Watering", "watering"],
  ["Soil & drainage", "soilDrainage"],
  ["Temperature & seasons", "temperatureSeasonal"],
  ["Feeding", "feeding"],
  ["Pruning & maintenance", "pruningMaintenance"],
  ["Container care", "containerAdvice"],
];

export function PlantPrintView({ plant }) {
  const care = plant.careGuide?.guide || null;
  const diagnosis = plant.diagnosis?.diagnosis || null;
  const referencePhotos = (plant.photos || [])
    .filter((photo) => photo.purpose === "identity_reference")
    .slice(0, 2);
  const problemIds = new Set(
    (plant.observations || []).flatMap((observation) => observation.photoIds),
  );
  const problemPhotos = (plant.photos || [])
    .filter(
      (photo) =>
        photo.purpose === "observation_problem" && problemIds.has(photo.id),
    )
    .slice(0, 3);

  return (
    <div className="print-sheet" aria-hidden="true">
      <section className="print-page print-front">
        <PrintHeader plant={plant} side="Care" />
        <div className="print-identity">
          <div>
            <p className="print-kicker">Recorded identity</p>
            <p className="print-identity-name">
              {plant.plantType || "Plant Type not recorded"}
            </p>
            {plant.aiScientificName && (
              <p>
                AI ID: <em>{plant.aiScientificName}</em>
                {plant.aiConfidence != null
                  ? ` (${Math.round(Number(plant.aiConfidence) * 100)}%)`
                  : ""}
              </p>
            )}
            {plant.location && <p>Location: {plant.location}</p>}
          </div>
          <PrintPhotos photos={referencePhotos} label="Reference photos" />
        </div>

        {care ? (
          <>
            <p className="print-summary">{care.summary}</p>
            <div className="print-care-grid">
              {CARE_FIELDS.map(([label, key]) =>
                care[key] ? (
                  <PrintBlock key={key} title={label} text={care[key]} />
                ) : null,
              )}
            </div>
            <div className="print-care-footer">
              {care.watchFor?.length > 0 && (
                <PrintList title="Watch for" items={care.watchFor} />
              )}
              {care.safety && <PrintBlock title="Safety" text={care.safety} />}
            </div>
          </>
        ) : (
          <PrintEmpty>Generate a care guide before printing.</PrintEmpty>
        )}
        <PrintFooter side="Front" />
      </section>

      <section className="print-page print-back">
        <PrintHeader plant={plant} side="Problems & actions" />
        <div className="print-problem-top">
          <div>
            <p className="print-kicker">Recent observations</p>
            {(plant.observations || []).length ? (
              <ul className="print-observations">
                {plant.observations.slice(0, 6).map((observation) => (
                  <li key={observation.id}>
                    <time>{formatDate(observation.observedAt)}</time>
                    {observation.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No observations recorded.</p>
            )}
          </div>
          <PrintPhotos photos={problemPhotos} label="Problem photos" />
        </div>

        {diagnosis ? (
          <div className="print-diagnosis">
            <div className="print-diagnosis-summary">
              <p className="print-kicker">Current assessment</p>
              <p>{diagnosis.summary}</p>
              <p className="print-confidence">
                Confidence: {Math.round(Number(diagnosis.confidence) * 100)}%
              </p>
            </div>
            <PrintList title="Symptoms" items={diagnosis.observedSymptoms} />
            <div className="print-causes">
              <p className="print-block-title">Likely causes</p>
              {diagnosis.likelyCauses?.map((item) => (
                <div key={item.cause}>
                  <strong>
                    {item.cause} ({item.likelihood})
                  </strong>
                  <span>{item.rationale}</span>
                </div>
              ))}
            </div>
            <div className="print-actions-grid">
              <PrintList
                title="What to do now"
                items={diagnosis.recommendedActions}
              />
              <PrintList
                title="What to monitor"
                items={diagnosis.monitorNext}
              />
            </div>
            {diagnosis.urgentSafetyNotes?.length > 0 && (
              <PrintList
                title="Safety / cautions"
                items={diagnosis.urgentSafetyNotes}
              />
            )}
            {diagnosis.uncertainty && (
              <PrintBlock title="Uncertainty" text={diagnosis.uncertainty} />
            )}
          </div>
        ) : (
          <PrintEmpty>Run a diagnosis to add remediation guidance.</PrintEmpty>
        )}
        <PrintFooter side="Back" />
      </section>
    </div>
  );
}

function PrintHeader({ plant, side }) {
  return (
    <header className="print-header">
      <div>
        <p className="print-kicker">My Garden field guide</p>
        <h1>{plant.plantName}</h1>
      </div>
      <p>{side}</p>
    </header>
  );
}

function PrintPhotos({ photos, label }) {
  if (!photos.length) return null;
  return (
    <figure className={`print-photos print-photos-${photos.length}`}>
      {photos.map((photo) => (
        <img key={photo.id} src={photo.url} alt={photo.altText || label} />
      ))}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function PrintBlock({ title, text }) {
  if (!text) return null;
  return (
    <section className="print-block">
      <h2 className="print-block-title">{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function PrintList({ title, items = [] }) {
  if (!items.length) return null;
  return (
    <section className="print-block">
      <h2 className="print-block-title">{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function PrintEmpty({ children }) {
  return <p className="print-empty">{children}</p>;
}

function PrintFooter({ side }) {
  return (
    <footer className="print-footer">
      <span>{side}</span>
      <span>
        Plant care guidance is advisory. Recheck when conditions change.
      </span>
    </footer>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "";
}
