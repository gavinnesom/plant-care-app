import { useEffect, useMemo, useState } from 'react';
import { ResultPanel } from './components/ResultPanel';
import { UploadPanel, validatePlantImage } from './components/UploadPanel';
import { LOW_CONFIDENCE_THRESHOLD } from './lib/plantSchema';

const initialDebugStatus = { requestStatus: 'idle', httpStatus: '', errorMessage: '' };

const emptyDraft = {
  plantName: '',
  location: '',
  plantType: '',
  aiAssessmentState: 'none',
  aiCommonName: '',
  aiScientificName: '',
  aiConfidence: null,
  aiRaw: null,
  photoDataUrl: '',
};

function apiErrorMessage(payload, fallback) {
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.error?.message === 'string') return payload.error.message;
  return fallback;
}

function shouldShowDebugPanel() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

async function readJsonResponse(response, fallback) {
  const responseText = await response.text();
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(apiErrorMessage(payload, fallback));
  return payload;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the selected photo.'));
    reader.readAsDataURL(file);
  });
}

function aiLabel(plant) {
  if (!plant || plant.aiAssessmentState === 'none') return 'No guess';
  return plant.aiScientificName || plant.aiCommonName || 'AI guess';
}

function displayPlantName(plant) {
  return plant?.plantName || plant?.gardenName || '';
}

function App() {
  const [view, setView] = useState('identify');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plantResult, setPlantResult] = useState(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [debugStatus, setDebugStatus] = useState(initialDebugStatus);
  const [showDebugPanel] = useState(shouldShowDebugPanel);
  const [gardenUnlocked, setGardenUnlocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pendingAfterUnlock, setPendingAfterUnlock] = useState(null);
  const [gardenPlants, setGardenPlants] = useState([]);
  const [gardenLoading, setGardenLoading] = useState(false);
  const [gardenError, setGardenError] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [savingPlant, setSavingPlant] = useState(false);
  const [deletingPlant, setDeletingPlant] = useState(false);

  useEffect(() => {
    fetch('/api/garden-session')
      .then((response) => response.json())
      .then((payload) => setGardenUnlocked(Boolean(payload.unlocked)))
      .catch(() => setGardenUnlocked(false));
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const pendingIdentificationDraft = useMemo(() => {
    if (!plantResult) return null;
    return {
      ...emptyDraft,
      plantName: plantResult.commonName || '',
      plantType: plantResult.scientificName || plantResult.commonName || '',
      aiAssessmentState: 'ai_guess',
      aiCommonName: plantResult.commonName || '',
      aiScientificName: plantResult.scientificName || '',
      aiConfidence: plantResult.confidence ?? null,
      aiRaw: plantResult,
    };
  }, [plantResult]);

  const handleFileSelected = (file) => {
    const validationError = validatePlantImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setPlantResult(null);
    setWarning('');
    setError('');
    setDebugStatus({ requestStatus: 'image selected', httpStatus: '', errorMessage: '' });
  };

  const handleIdentifyPlant = async () => {
    const validationError = validatePlantImage(imageFile);
    if (validationError) {
      setError(validationError);
      setDebugStatus({ requestStatus: 'validation error', httpStatus: '', errorMessage: validationError });
      return;
    }

    setLoading(true);
    setError('');
    setWarning('');
    setPlantResult(null);
    setDebugStatus({ requestStatus: 'starting request', httpStatus: '', errorMessage: '' });

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const response = await fetch('/api/identify-plant', { method: 'POST', body: formData });
      setDebugStatus((current) => ({ ...current, requestStatus: 'response received', httpStatus: response.status }));
      const payload = await readJsonResponse(response, 'The plant identification service is unavailable.');
      if (!payload.result) throw new Error('API response did not include a plant result.');
      setPlantResult(payload.result);
      setDebugStatus((current) => ({ ...current, requestStatus: 'success', errorMessage: '' }));
      if (payload.warning) {
        setWarning(payload.warning);
      } else if (payload.result?.confidence < LOW_CONFIDENCE_THRESHOLD) {
        setWarning('The model is not very confident. Treat this as a starting point and compare alternatives.');
      }
    } catch (err) {
      const message =
        err.message === 'Failed to fetch'
          ? 'API route unavailable. Run the app with npx vercel dev so /api/identify-plant is served.'
          : err.message || 'Something went wrong while identifying the plant.';
      setError(message);
      setDebugStatus((current) => ({ ...current, requestStatus: 'error', errorMessage: message }));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl('');
    setImageFile(null);
    setPlantResult(null);
    setError('');
    setWarning('');
    setDebugStatus(initialDebugStatus);
  };

  const loadGarden = async () => {
    setGardenLoading(true);
    setGardenError('');
    try {
      const response = await fetch('/api/garden-plants');
      const payload = await readJsonResponse(response, 'Unable to load My Garden.');
      setGardenPlants(payload.plants || []);
      setGardenUnlocked(true);
    } catch (err) {
      if (err.message.includes('Unlock')) {
        setGardenUnlocked(false);
        setUnlockOpen(true);
      } else {
        setGardenError(err.message || 'Unable to load My Garden.');
      }
    } finally {
      setGardenLoading(false);
    }
  };

  const openGarden = async () => {
    if (!gardenUnlocked) {
      setPendingAfterUnlock({ type: 'garden' });
      setUnlockOpen(true);
      return;
    }
    setView('garden');
    await loadGarden();
  };

  const startGrow = async (source = 'manual') => {
    const nextDraft = source === 'identification' && pendingIdentificationDraft ? pendingIdentificationDraft : emptyDraft;
    const photoDataUrl = source === 'identification' && imageFile ? await fileToDataUrl(imageFile) : '';
    setDraft({ ...nextDraft, photoDataUrl });
    setSelectedPlant(null);
    setGardenError('');
    setView('grow');
  };

  const handleDraftPhotoSelected = async (file) => {
    const validationError = validatePlantImage(file);
    if (validationError) {
      setGardenError(validationError);
      return;
    }
    try {
      const photoDataUrl = await fileToDataUrl(file);
      setDraft((current) => ({ ...current, photoDataUrl }));
      setGardenError('');
    } catch (err) {
      setGardenError(err.message || 'Unable to read the selected photo.');
    }
  };

  const handleSelectedPlantPhotoSelected = async (file) => {
    const validationError = validatePlantImage(file);
    if (validationError) {
      setGardenError(validationError);
      return;
    }
    try {
      const photoDataUrl = await fileToDataUrl(file);
      setSelectedPlant((current) => (current ? { ...current, photoDataUrl } : current));
      setGardenError('');
    } catch (err) {
      setGardenError(err.message || 'Unable to read the selected photo.');
    }
  };

  const openGrow = async (source = 'manual') => {
    if (!gardenUnlocked) {
      setPendingAfterUnlock({ type: 'grow', source });
      setUnlockOpen(true);
      return;
    }
    await startGrow(source);
  };

  const handleUnlocked = async () => {
    setGardenUnlocked(true);
    setUnlockOpen(false);
    const action = pendingAfterUnlock || { type: 'garden' };
    setPendingAfterUnlock(null);
    if (action.type === 'grow') {
      await startGrow(action.source);
    } else {
      setView('garden');
      await loadGarden();
    }
  };

  const saveDraft = async () => {
    setSavingPlant(true);
    setGardenError('');
    try {
      const response = await fetch('/api/garden-plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantName: draft.plantName,
          location: draft.location,
          plantType: draft.plantType,
          identitySource: draft.aiAssessmentState === 'ai_guess' ? 'ai_initial' : 'manual',
          aiAssessment: {
            state: draft.aiAssessmentState,
            commonName: draft.aiCommonName,
            scientificName: draft.aiScientificName,
            confidence: draft.aiConfidence,
            raw: draft.aiRaw,
          },
          photo: draft.photoDataUrl ? { dataUrl: draft.photoDataUrl, altText: draft.plantName } : null,
        }),
      });
      const payload = await readJsonResponse(response, 'Unable to save this plant.');
      await loadGarden();
      setSelectedPlant(payload.plant);
      setView('plant');
    } catch (err) {
      setGardenError(err.message || 'Unable to save this plant.');
    } finally {
      setSavingPlant(false);
    }
  };

  const updateSelectedPlant = async () => {
    if (!selectedPlant) return;
    setSavingPlant(true);
    setGardenError('');
    try {
      const response = await fetch(`/api/garden-plants/${selectedPlant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantName: selectedPlant.plantName,
          location: selectedPlant.location,
          plantType: selectedPlant.plantType,
          photo: selectedPlant.photoDataUrl ? { dataUrl: selectedPlant.photoDataUrl, altText: selectedPlant.plantName } : null,
        }),
      });
      const payload = await readJsonResponse(response, 'Unable to update this plant.');
      setSelectedPlant(payload.plant);
      await loadGarden();
    } catch (err) {
      setGardenError(err.message || 'Unable to update this plant.');
    } finally {
      setSavingPlant(false);
    }
  };

  const deleteSelectedPlant = async () => {
    if (!selectedPlant) return;
    const confirmed = window.confirm(`Delete ${displayPlantName(selectedPlant) || 'this plant'} from My Garden?`);
    if (!confirmed) return;

    setDeletingPlant(true);
    setGardenError('');
    try {
      const response = await fetch(`/api/garden-plants/${selectedPlant.id}`, { method: 'DELETE' });
      await readJsonResponse(response, 'Unable to delete this plant.');
      setSelectedPlant(null);
      setView('garden');
      await loadGarden();
    } catch (err) {
      setGardenError(err.message || 'Unable to delete this plant.');
    } finally {
      setDeletingPlant(false);
    }
  };

  const openPlant = async (plant) => {
    setSelectedPlant(plant);
    setView('plant');
    try {
      const response = await fetch(`/api/garden-plants/${plant.id}`);
      const payload = await readJsonResponse(response, 'Unable to open this plant.');
      setSelectedPlant(payload.plant);
    } catch (err) {
      setGardenError(err.message || 'Unable to open this plant.');
    }
  };

  return (
    <div className="app-shell min-h-screen px-4 py-5 text-[var(--app-text)] sm:py-7">
      <div className="mx-auto max-w-7xl">
        {view === 'identify' && (
          <IdentifyView
            imageUrl={imageUrl}
            imageFile={imageFile}
            loading={loading}
            plantResult={plantResult}
            error={error}
            warning={warning}
            showDebugPanel={showDebugPanel}
            debugStatus={debugStatus}
            onFileSelected={handleFileSelected}
            onIdentify={handleIdentifyPlant}
            onClear={handleClear}
            onAddToGarden={() => openGrow('identification')}
            modeControl={<ModeButton mode="garden" onGarden={openGarden} onIdentify={() => setView('identify')} />}
          />
        )}
        {view === 'garden' && <GardenView plants={gardenPlants} loading={gardenLoading} error={gardenError} onGrow={() => openGrow('manual')} onOpenPlant={openPlant} modeControl={<ModeButton mode="identify" onGarden={openGarden} onIdentify={() => setView('identify')} />} />}
        {view === 'grow' && <GrowView draft={draft} error={gardenError} saving={savingPlant} onChange={setDraft} onPhotoSelected={handleDraftPhotoSelected} onSave={saveDraft} onCancel={() => setView('garden')} modeControl={<ModeButton mode="identify" onGarden={openGarden} onIdentify={() => setView('identify')} />} />}
        {view === 'plant' && selectedPlant && <PlantView plant={selectedPlant} error={gardenError} saving={savingPlant} deleting={deletingPlant} onChange={setSelectedPlant} onPhotoSelected={handleSelectedPlantPhotoSelected} onSave={updateSelectedPlant} onDelete={deleteSelectedPlant} onBack={() => setView('garden')} modeControl={<ModeButton mode="identify" onGarden={openGarden} onIdentify={() => setView('identify')} />} />}
      </div>
      {unlockOpen && <UnlockDialog onUnlocked={handleUnlocked} onCancel={() => setUnlockOpen(false)} />}
    </div>
  );
}

function ModeButton({ mode, onGarden, onIdentify }) {
  const isGarden = mode === 'garden';
  return (
    <button
      type="button"
      onClick={isGarden ? onGarden : onIdentify}
      className="mode-button"
      aria-label={isGarden ? 'Open My Garden' : 'Identify a plant'}
      title={isGarden ? 'My Garden' : 'Identify Plant'}
    >
      {isGarden ? <CordylineIcon /> : <CameraIcon />}
    </button>
  );
}

function IdentifyView(props) {
  return (
    <>
      <header className="mb-6 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10 sm:p-7">
        <div className="mt-4 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <TitleGroup title="Plants & Care" action={props.modeControl} size="large" />
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--app-text-muted)]">
              Identify a plant from one photo, then keep it temporary or save it as an individual plant in My Garden.
            </p>
          </div>
          <HeaderGuidance />
        </div>
      </header>
      {props.warning && <div className="mb-5 rounded-[12px] border border-[var(--app-gold)] bg-[var(--app-gold-soft)] p-4 text-sm font-semibold leading-relaxed text-[var(--app-ink)]">{props.warning}</div>}
      <main className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <UploadPanel imageUrl={props.imageUrl} fileName={props.imageFile?.name} loading={props.loading} onFileSelected={props.onFileSelected} onIdentify={props.onIdentify} onClear={props.onClear} error={props.error} />
        <div className="grid gap-4">
          {props.showDebugPanel && <DebugPanel fileName={props.imageFile?.name} debugStatus={props.debugStatus} />}
          {props.plantResult?.sections?.funFact && <SpotlightCard result={props.plantResult} />}
          <ResultPanel result={props.plantResult} loading={props.loading} onAddToGarden={props.onAddToGarden} />
        </div>
      </main>
    </>
  );
}

function GardenView({ plants, loading, error, onGrow, onOpenPlant, modeControl }) {
  return (
    <main>
      <section className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <TitleGroup title="My Garden" action={modeControl} />
          <button className="garden-button garden-button-primary" onClick={onGrow}>Grow</button>
        </div>
      </section>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {loading && <p className="mt-6 text-[var(--app-text-muted)]">Opening My Garden...</p>}
      {!loading && plants.length === 0 && (
        <section className="mt-6 rounded-[16px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-card)] p-8 text-center text-[var(--app-text-muted)]">
          <p className="text-lg font-black text-[var(--app-text)]">No saved plants yet</p>
          <p className="mt-2">Use Grow to create one manually, or identify a plant and add it from the result.</p>
        </section>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {plants.map((plant) => (
          <button key={plant.id} className="garden-tile text-left" onClick={() => onOpenPlant(plant)}>
            <PhotoFrame plant={plant} />
            <div className="mt-4">
              <h2 className="text-xl font-black text-[var(--app-text)]">{displayPlantName(plant)}</h2>
              {plant.location && <p className="mt-1 text-sm text-[var(--app-text-muted)]">{plant.location}</p>}
              <p className="mt-3 text-sm font-bold text-[var(--app-leaf)]">{plant.plantType || 'Plant Type not set'}</p>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function GrowView({ draft, error, saving, onChange, onPhotoSelected, onSave, onCancel, modeControl }) {
  return (
    <main className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10">
      <TitleGroup title="Save a garden plant" action={modeControl} />
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-[var(--app-ink)]">
          <PhotoPicker photoDataUrl={draft.photoDataUrl} onPhotoSelected={onPhotoSelected} />
          <IdentityReadout draft={draft} />
        </div>
        <PlantForm value={draft} onChange={onChange} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="garden-button garden-button-primary" disabled={saving} onClick={onSave}>{saving ? 'Saving...' : 'Save plant'}</button>
        <button className="garden-button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </main>
  );
}

function PlantView({ plant, error, saving, deleting, onChange, onPhotoSelected, onSave, onDelete, onBack, modeControl }) {
  return (
    <main className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10">
      <TitleGroup title={displayPlantName(plant)} action={modeControl} />
      <button className="mt-3 text-sm font-black text-[var(--app-leaf)]" onClick={onBack}>Back to My Garden</button>
      <div className="mt-5 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <PhotoPicker
            inputId="plant-photo-input"
            photoDataUrl={plant.photoDataUrl || plant.photoUrl}
            emptyLabel="Add Photo"
            onPhotoSelected={onPhotoSelected}
          />
          <div className="mt-4 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-[var(--app-ink)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--app-moss-dark)]">AI ID</p>
            <p className="mt-2 font-black">{aiLabel(plant)}</p>
          </div>
        </div>
        <div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="mt-6"><PlantForm value={plant} onChange={onChange} /></div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="garden-button garden-button-primary" disabled={saving || deleting} onClick={onSave}>{saving ? 'Saving...' : 'Save edits'}</button>
            <button className="garden-button garden-button-danger" disabled={saving || deleting} onClick={onDelete}>{deleting ? 'Deleting...' : 'Delete plant'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlantForm({ value, onChange }) {
  const update = (field, nextValue) => onChange({ ...value, [field]: nextValue });
  return (
    <div className="grid gap-4">
      <label className="grid gap-2"><span className="form-label">Plant Name</span><input className="garden-input" value={value.plantName || ''} onChange={(event) => update('plantName', event.target.value)} /></label>
      <label className="grid gap-2"><span className="form-label">Location</span><input className="garden-input" value={value.location || ''} onChange={(event) => update('location', event.target.value)} placeholder="on the patio" /></label>
      <label className="grid gap-2"><span className="form-label">Plant Type</span><input className="garden-input" value={value.plantType || ''} onChange={(event) => update('plantType', event.target.value)} /></label>
      <div className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4 text-[var(--app-ink)]">
        <p className="form-label text-[var(--app-moss-dark)]">AI ID</p>
        <p className="mt-2 font-black">{value.aiAssessmentState === 'ai_guess' ? value.aiScientificName || value.aiCommonName || 'AI guess' : value.aiScientificName || value.aiCommonName || 'No guess'}</p>
      </div>
    </div>
  );
}

function IdentityReadout({ draft }) {
  return (
    <div className="mt-4 grid gap-3 text-sm">
      <p><span className="font-black">AI ID:</span> {draft.aiAssessmentState === 'ai_guess' ? draft.aiScientificName || draft.aiCommonName : 'No guess'}</p>
      <p><span className="font-black">Plant Type:</span> {draft.plantType || 'Not set'}</p>
    </div>
  );
}

function PhotoPicker({ photoDataUrl, onPhotoSelected, inputId = 'grow-photo-input', emptyLabel = 'Add Photo' }) {
  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (file) onPhotoSelected(file);
    event.target.value = '';
  };

  return (
    <div>
      <label htmlFor={inputId} className="photo-picker">
        {photoDataUrl ? <img src={photoDataUrl} alt="" className="aspect-[4/3] w-full rounded-[12px] object-cover" /> : <span>{emptyLabel}</span>}
      </label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleChange} />
      <button type="button" className="garden-button mt-3 w-full" onClick={() => document.getElementById(inputId)?.click()}>
        {photoDataUrl ? 'Change photo' : 'Browse photo'}
      </button>
    </div>
  );
}

function TitleGroup({ title, action, size = 'normal' }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      {action}
      <h1 className={`${size === 'large' ? 'text-5xl' : 'text-4xl'} max-w-3xl font-black tracking-tight text-[var(--app-text)]`}>{title}</h1>
    </div>
  );
}

function PhotoFrame({ plant, large = false }) {
  const className = large ? 'aspect-[4/3] w-full rounded-[14px] object-cover' : 'aspect-[4/3] w-full rounded-[12px] object-cover';
  if (plant.photoUrl) return <img src={plant.photoUrl} alt="" className={className} />;
  return <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[12px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-bramble-soft)] text-sm font-bold text-[var(--app-text-muted)]">No photo</div>;
}

function UnlockDialog({ onUnlocked, onCancel }) {
  const [ownerKey, setOwnerKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/garden-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerKey }) });
      await readJsonResponse(response, 'Unable to unlock My Garden.');
      onUnlocked();
    } catch (err) {
      setError(err.message || 'Unable to unlock My Garden.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-2xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--app-moss)]">Owner key</p>
        <h2 className="mt-2 text-3xl font-black text-[var(--app-text)]">Unlock My Garden</h2>
        <input autoFocus type="password" className="garden-input mt-5" value={ownerKey} onChange={(event) => setOwnerKey(event.target.value)} placeholder="Owner key" />
        {error && <p className="mt-3 text-sm font-bold text-[var(--app-danger)]">{error}</p>}
        <div className="mt-5 flex gap-3"><button className="garden-button garden-button-primary" disabled={loading}>{loading ? 'Unlocking...' : 'Unlock'}</button><button type="button" className="garden-button" onClick={onCancel}>Cancel</button></div>
      </form>
    </div>
  );
}

function SpotlightCard({ result }) {
  return <aside className="rounded-[14px] border border-[var(--app-gold)] bg-[var(--app-gold-soft)] p-5 text-[var(--app-ink)] shadow-sm"><p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--app-moss-dark)]">Fun fact</p><p className="mt-3 text-base leading-relaxed">{result.sections.funFact}</p></aside>;
}

function HeaderGuidance() {
  return (
    <div className="grid gap-4 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bark)] p-4 text-sm leading-relaxed text-[var(--app-text-muted)] sm:grid-cols-2">
      <div><p className="font-black uppercase tracking-[0.14em] text-[var(--app-leaf)]">Best photo tips</p><div className="mt-2 grid gap-1.5"><p>Use bright, natural light.</p><p>Include flowers or fruit when present.</p><p>Show leaf shape and stem texture.</p><p>Add a whole-plant view if you can.</p></div></div>
      <div className="border-t border-[var(--app-border)] pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><p className="font-black uppercase tracking-[0.14em] text-[var(--app-leaf)]">What you’ll get</p><div className="mt-2 grid gap-1.5"><p>Likely plant name and confidence.</p><p>Care traits for light, water, and soil.</p><p>A private Grow path when you want to save it.</p><p>A safety reminder for uncertain plants.</p></div></div>
    </div>
  );
}

function DebugPanel({ fileName, debugStatus }) {
  return <aside className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm shadow-lg shadow-black/15"><p className="font-black uppercase tracking-[0.14em] text-[var(--app-moss)]">Developer status</p><div className="mt-3 grid gap-2 text-[var(--app-text-muted)] sm:grid-cols-2"><p><span className="font-bold text-[var(--app-text)]">Selected file:</span> {fileName || 'None'}</p><p><span className="font-bold text-[var(--app-text)]">API request:</span> {debugStatus.requestStatus}</p><p><span className="font-bold text-[var(--app-text)]">HTTP status:</span> {debugStatus.httpStatus || 'None'}</p><p><span className="font-bold text-[var(--app-text)]">Error:</span> {debugStatus.errorMessage || 'None'}</p></div></aside>;
}

function ErrorBanner({ children }) {
  return <div className="mt-5 rounded-[12px] border border-rose-300/50 bg-rose-100/85 p-4 text-sm font-bold text-rose-950">{children}</div>;
}

function CordylineIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21V9" strokeLinecap="round" /><path d="M12 10C8 7 5 6 2.5 6.5 5 10 8 12 12 10Z" /><path d="M12 10c4-4 7-5.5 9.5-5-1.4 4-4.5 6.5-9.5 5Z" /><path d="M12 14c-3.5-1.5-6.2-1.4-8 .2 2.4 2.3 5.2 2.8 8-.2Z" /><path d="M12 14c3.4-2.2 6.2-2.8 8.5-1.4-1.8 2.8-4.6 3.6-8.5 1.4Z" /></svg>;
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.5-2h4l1.5 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" /><circle cx="12" cy="12.5" r="3.5" /></svg>;
}

export default App;
