import { useEffect, useRef, useState } from "react";
import { ErrorBanner, TitleGroup } from "../../components/AppChrome";
import { ResultPanel } from "../../components/ResultPanel";
import { UploadPanel } from "../../components/UploadPanel";
import { readJsonResponse } from "../../lib/api";
import {
  makePhotoPreview,
  revokePreviews,
  validateFiles,
} from "../../lib/photos";
import {
  LOW_CONFIDENCE_THRESHOLD,
  MAX_IDENTIFICATION_IMAGES,
} from "../../lib/plantSchema";

const initialDebugStatus = {
  requestStatus: "idle",
  httpStatus: "",
  errorMessage: "",
};

function showDebugPanel() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1"
  );
}

export function IdentifyExperience({ modeControl, onAddToGarden }) {
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef([]);
  const requestRef = useRef({ sequence: 0, controller: null });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [assessmentMeta, setAssessmentMeta] = useState(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [debugStatus, setDebugStatus] = useState(initialDebugStatus);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      requestRef.current.controller?.abort();
      revokePreviews(photosRef.current);
    },
    [],
  );

  const chooseFiles = (files) => {
    const additions = Array.from(files || []).map(makePhotoPreview);
    const next = [...photos, ...additions];
    const validationError =
      next.length > MAX_IDENTIFICATION_IMAGES
        ? `Choose no more than ${MAX_IDENTIFICATION_IMAGES} photos for one identification.`
        : validateFiles(next);
    if (validationError) {
      revokePreviews(additions);
      setError(validationError);
      return;
    }
    setPhotos(next);
    setResult(null);
    setAssessmentMeta(null);
    setWarning("");
    setError("");
    setDebugStatus({
      requestStatus: "photos selected",
      httpStatus: "",
      errorMessage: "",
    });
  };

  const removePhoto = (id) => {
    const removed = photos.find((photo) => photo.id === id);
    if (removed) revokePreviews([removed]);
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setResult(null);
    setAssessmentMeta(null);
  };

  const identify = async () => {
    if (!photos.length) {
      setError("Choose at least one plant photo first.");
      return;
    }
    const sequence = requestRef.current.sequence + 1;
    requestRef.current.controller?.abort();
    const controller = new AbortController();
    requestRef.current = { sequence, controller };
    setLoading(true);
    setError("");
    setWarning("");
    setDebugStatus({
      requestStatus: "starting request",
      httpStatus: "",
      errorMessage: "",
    });
    const formData = new FormData();
    photos.forEach((photo) => formData.append("images", photo.file));

    try {
      const response = await fetch("/api/identify-plant", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (sequence !== requestRef.current.sequence) return;
      setDebugStatus((current) => ({
        ...current,
        requestStatus: "response received",
        httpStatus: response.status,
      }));
      const payload = await readJsonResponse(
        response,
        "The plant identification service is unavailable.",
      );
      if (!payload.result)
        throw new Error("The response did not include a plant result.");
      setResult(payload.result);
      setAssessmentMeta(payload.assessmentMeta || null);
      setWarning(
        payload.warning ||
          (payload.result.confidence < LOW_CONFIDENCE_THRESHOLD
            ? "The model is not very confident. Treat this as a starting point and compare alternatives."
            : ""),
      );
      setDebugStatus((current) => ({
        ...current,
        requestStatus: "success",
        errorMessage: "",
      }));
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      const message =
        requestError.message ||
        "Something went wrong while identifying the plant.";
      setError(message);
      setDebugStatus((current) => ({
        ...current,
        requestStatus: "error",
        errorMessage: message,
      }));
    } finally {
      if (sequence === requestRef.current.sequence) setLoading(false);
    }
  };

  const clear = () => {
    requestRef.current.controller?.abort();
    revokePreviews(photos);
    setPhotos([]);
    setResult(null);
    setAssessmentMeta(null);
    setError("");
    setWarning("");
    setDebugStatus(initialDebugStatus);
  };

  return (
    <>
      <header className="mb-6 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl shadow-black/10 sm:p-7">
        <div className="mt-4 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <TitleGroup
              title="Plants & Care"
              action={modeControl}
              size="large"
            />
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--app-text-muted)]">
              Identify a plant from up to five reference photos, then save it to
              My Garden.
            </p>
          </div>
          <HeaderGuidance />
        </div>
      </header>
      {warning && (
        <div className="mb-5 rounded-[12px] border border-[var(--app-gold)] bg-[var(--app-gold-soft)] p-4 text-sm font-semibold leading-relaxed text-[var(--app-ink)]">
          {warning}
        </div>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <main className="mt-5 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <UploadPanel
          photos={photos}
          loading={loading}
          onFilesSelected={chooseFiles}
          onRemovePhoto={removePhoto}
          onIdentify={identify}
          onClear={clear}
          error=""
        />
        <div className="grid gap-4">
          {showDebugPanel() && (
            <DebugPanel
              fileName={photos.map((photo) => photo.file.name).join(", ")}
              debugStatus={debugStatus}
            />
          )}
          {result?.sections?.funFact && <SpotlightCard result={result} />}
          <ResultPanel
            result={result}
            loading={loading}
            onAddToGarden={() =>
              onAddToGarden({
                result,
                assessmentMeta,
                files: photos.map((photo) => photo.file),
              })
            }
          />
        </div>
      </main>
    </>
  );
}

function HeaderGuidance() {
  return (
    <div className="grid gap-4 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-bark)] p-4 text-sm leading-relaxed text-[var(--app-text-muted)] sm:grid-cols-2">
      <div>
        <p className="font-black uppercase tracking-[0.14em] text-[var(--app-leaf)]">
          Best photo tips
        </p>
        <div className="mt-2 grid gap-1.5">
          <p>Use bright, natural light.</p>
          <p>Include flowers or fruit when present.</p>
          <p>Show leaf shape and stem texture.</p>
          <p>Add a whole-plant view if you can.</p>
        </div>
      </div>
      <div className="border-t border-[var(--app-border)] pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="font-black uppercase tracking-[0.14em] text-[var(--app-leaf)]">
          What you’ll get
        </p>
        <div className="mt-2 grid gap-1.5">
          <p>Likely plant name and confidence.</p>
          <p>Care traits for light, water, and soil.</p>
          <p>A private path to save it.</p>
          <p>A safety reminder for uncertain plants.</p>
        </div>
      </div>
    </div>
  );
}

function SpotlightCard({ result }) {
  return (
    <aside className="rounded-[14px] border border-[var(--app-gold)] bg-[var(--app-gold-soft)] p-5 text-[var(--app-ink)] shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--app-moss-dark)]">
        Fun fact
      </p>
      <p className="mt-3 text-base leading-relaxed">
        {result.sections.funFact}
      </p>
    </aside>
  );
}

function DebugPanel({ fileName, debugStatus }) {
  return (
    <aside className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm shadow-lg shadow-black/15">
      <p className="font-black uppercase tracking-[0.14em] text-[var(--app-moss)]">
        Developer status
      </p>
      <div className="mt-3 grid gap-2 text-[var(--app-text-muted)] sm:grid-cols-2">
        <p>
          <span className="font-bold text-[var(--app-text)]">
            Selected file:
          </span>{" "}
          {fileName || "None"}
        </p>
        <p>
          <span className="font-bold text-[var(--app-text)]">API request:</span>{" "}
          {debugStatus.requestStatus}
        </p>
        <p>
          <span className="font-bold text-[var(--app-text)]">HTTP status:</span>{" "}
          {debugStatus.httpStatus || "None"}
        </p>
        <p>
          <span className="font-bold text-[var(--app-text)]">Error:</span>{" "}
          {debugStatus.errorMessage || "None"}
        </p>
      </div>
    </aside>
  );
}
