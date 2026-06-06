import { useEffect, useState } from 'react';
import { ResultPanel } from './components/ResultPanel';
import { UploadPanel, validatePlantImage } from './components/UploadPanel';
import { LOW_CONFIDENCE_THRESHOLD } from './lib/plantSchema';

const initialDebugStatus = {
  requestStatus: 'idle',
  httpStatus: '',
  errorMessage: '',
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

function App() {
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plantResult, setPlantResult] = useState(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [debugStatus, setDebugStatus] = useState(initialDebugStatus);
  const [showDebugPanel] = useState(shouldShowDebugPanel);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

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
    setDebugStatus({
      requestStatus: 'image selected',
      httpStatus: '',
      errorMessage: '',
    });
  };

  const handleIdentifyPlant = async () => {
    if (import.meta.env.DEV) {
      console.log('[Plant ID] Identify clicked', {
        fileName: imageFile?.name,
        fileType: imageFile?.type,
        fileSize: imageFile?.size,
      });
    }

    const validationError = validatePlantImage(imageFile);
    if (validationError) {
      setError(validationError);
      setDebugStatus({
        requestStatus: 'validation error',
        httpStatus: '',
        errorMessage: validationError,
      });
      return;
    }

    setLoading(true);
    setError('');
    setWarning('');
    setPlantResult(null);
    setDebugStatus({
      requestStatus: 'starting request',
      httpStatus: '',
      errorMessage: '',
    });

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      if (import.meta.env.DEV) {
        console.log('[Plant ID] Request starting', {
          endpoint: '/api/identify-plant',
          formDataHasImage: formData.has('image'),
        });
      }

      const response = await fetch('/api/identify-plant', {
        method: 'POST',
        body: formData,
      });

      if (import.meta.env.DEV) {
        console.log('[Plant ID] Response status received', response.status);
      }

      setDebugStatus((current) => ({
        ...current,
        requestStatus: 'response received',
        httpStatus: response.status,
      }));

      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
        if (import.meta.env.DEV) {
          console.log('[Plant ID] JSON parsed', payload);
        }
      } catch {
        const message =
          response.status === 404
            ? 'API route unavailable. Run the app with npx vercel dev so /api/identify-plant is served.'
            : 'API returned a non-JSON response. Check the serverless function logs.';
        throw new Error(message);
      }

      if (!response.ok) {
        const message =
          response.status === 404
            ? 'API route unavailable. Run the app with npx vercel dev so /api/identify-plant is served.'
            : apiErrorMessage(payload, 'The plant identification service is unavailable.');
        throw new Error(message);
      }

      if (!payload.result) {
        throw new Error('API response did not include a plant result.');
      }

      setPlantResult(payload.result);
      setDebugStatus((current) => ({
        ...current,
        requestStatus: 'success',
        errorMessage: '',
      }));
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
      setDebugStatus((current) => ({
        ...current,
        requestStatus: 'error',
        errorMessage: message,
      }));
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

  return (
    <div className="min-h-screen bg-[var(--app-page)] px-4 py-6 text-[var(--app-text)] sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[18px] border border-[var(--app-border)] bg-[var(--app-shell)] p-3 shadow-2xl shadow-black/20 sm:p-4">
          <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-lg shadow-black/15 sm:p-7">
            <p className="inline-flex rounded-full bg-emerald-300/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200 ring-1 ring-emerald-300/25">
              AI-assisted plant care
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
              <div>
                <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-[var(--app-text)]">
                  Plants & Care
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--app-text-muted)]">
                  Upload a clear plant photo and get a practical, structured care card with sunlight, water, soil,
                  safety notes, and likely alternatives.
                </p>
              </div>
              <HeaderGuidance />
            </div>
          </div>
        </header>

        {warning && (
          <div className="mb-5 rounded-[12px] border border-amber-200/40 bg-amber-200/15 p-4 text-sm font-semibold leading-relaxed text-amber-100">
            {warning}
          </div>
        )}

        <main className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <UploadPanel
            imageUrl={imageUrl}
            fileName={imageFile?.name}
            loading={loading}
            onFileSelected={handleFileSelected}
            onIdentify={handleIdentifyPlant}
            onClear={handleClear}
            error={error}
          />
          <div className="grid gap-4">
            {showDebugPanel && <DebugPanel fileName={imageFile?.name} debugStatus={debugStatus} />}
            {plantResult?.sections?.funFact && <SpotlightCard result={plantResult} placement="result-column" />}
            <ResultPanel result={plantResult} loading={loading} />
          </div>
        </main>
      </div>
    </div>
  );
}

function SpotlightCard({ result, placement }) {
  const isHeader = placement === 'header';

  if (result?.sections?.funFact && !isHeader) {
    return (
      <aside className="rounded-[14px] border border-amber-200/35 bg-amber-200/12 p-5 text-amber-100 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-200">Fun fact</p>
        <p className="mt-3 text-base leading-relaxed text-[var(--app-text)]">{result.sections.funFact}</p>
      </aside>
    );
  }

  if (result && isHeader) {
    return (
      <aside className="h-full rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-5 text-[var(--app-ink)] shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Care card ready</p>
        <p className="mt-3 text-base font-black text-[var(--app-ink)]">{result.commonName}</p>
        <p className="mt-1 text-sm italic text-[var(--app-ink-muted)]">{result.scientificName}</p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--app-ink-muted)]">
          Review the confidence, compare alternatives, then use the care notes as a practical starting point.
        </p>
      </aside>
    );
  }

  if (!isHeader) {
    return null;
  }

  return (
    <aside className="h-full rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-5 text-[var(--app-ink)] shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">How to get the best ID</p>
      <div className="mt-4 grid gap-4 text-sm leading-relaxed text-[var(--app-ink-muted)]">
        <div>
          <p className="font-black text-[var(--app-ink)]">Best photo tips</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <p>Use bright, natural light.</p>
            <p>Include flowers or fruit when present.</p>
            <p>Show leaf shape and stem texture.</p>
            <p>Add a whole-plant view if you can.</p>
          </div>
        </div>
        <div className="border-t border-slate-300 pt-4">
          <p className="font-black text-[var(--app-ink)]">What you’ll get</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <p>Likely plant name and confidence.</p>
            <p>Care traits for light, water, and soil.</p>
            <p>California and pet-safety notes.</p>
            <p>A fun fact once the plant is identified.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function HeaderGuidance() {
  return (
    <div className="grid gap-4 rounded-[12px] border border-[var(--app-border)] bg-[#2d353b] p-4 text-sm leading-relaxed text-[var(--app-text-muted)] sm:grid-cols-2">
      <div>
        <p className="font-black uppercase tracking-[0.14em] text-emerald-200">Best photo tips</p>
        <div className="mt-2 grid gap-1.5">
          <p>Use bright, natural light.</p>
          <p>Include flowers or fruit when present.</p>
          <p>Show leaf shape and stem texture.</p>
          <p>Add a whole-plant view if you can.</p>
        </div>
      </div>
      <div className="border-t border-[var(--app-border)] pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="font-black uppercase tracking-[0.14em] text-emerald-200">What you’ll get</p>
        <div className="mt-2 grid gap-1.5">
          <p>Likely plant name and confidence.</p>
          <p>Care traits for light, water, and soil.</p>
          <p>California and pet-safety notes.</p>
          <p>A fun fact once the plant is identified.</p>
        </div>
      </div>
    </div>
  );
}

function DebugPanel({ fileName, debugStatus }) {
  return (
    <aside className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm shadow-lg shadow-black/15">
      <p className="font-black uppercase tracking-[0.14em] text-emerald-200">Developer status</p>
      <div className="mt-3 grid gap-2 text-[var(--app-text-muted)] sm:grid-cols-2">
        <p>
          <span className="font-bold text-[var(--app-text)]">Selected file:</span> {fileName || 'None'}
        </p>
        <p>
          <span className="font-bold text-[var(--app-text)]">API request:</span> {debugStatus.requestStatus}
        </p>
        <p>
          <span className="font-bold text-[var(--app-text)]">HTTP status:</span> {debugStatus.httpStatus || 'None'}
        </p>
        <p>
          <span className="font-bold text-[var(--app-text)]">Error:</span> {debugStatus.errorMessage || 'None'}
        </p>
      </div>
    </aside>
  );
}

export default App;
