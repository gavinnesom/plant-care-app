import { useState } from "react";
import { readJsonResponse } from "../lib/api";

export function ModeButton({ mode, onGarden, onIdentify }) {
  const isGarden = mode === "garden";
  return (
    <button
      type="button"
      onClick={isGarden ? onGarden : onIdentify}
      className="mode-button"
      aria-label={isGarden ? "Open My Garden" : "Identify a plant"}
      title={isGarden ? "My Garden" : "Identify Plant"}
    >
      {isGarden ? <CordylineIcon /> : <CameraIcon />}
    </button>
  );
}

export function TitleGroup({ title, action, size = "normal" }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      {action}
      <h1
        className={`${size === "large" ? "text-5xl" : "text-4xl"} max-w-3xl font-black tracking-tight text-[var(--app-text)]`}
      >
        {title}
      </h1>
    </div>
  );
}

export function ErrorBanner({ children }) {
  return (
    <div className="mt-5 rounded-[12px] border border-rose-300/50 bg-rose-100/85 p-4 text-sm font-bold text-rose-950">
      {children}
    </div>
  );
}

export function UnlockDialog({ onUnlocked, onCancel }) {
  const [ownerKey, setOwnerKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/garden-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerKey }),
      });
      await readJsonResponse(response, "Unable to unlock My Garden.");
      onUnlocked();
    } catch (requestError) {
      setError(requestError.message || "Unable to unlock My Garden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-2xl"
      >
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--app-moss)]">
          Owner key
        </p>
        <h2 className="mt-2 text-3xl font-black text-[var(--app-text)]">
          Unlock My Garden
        </h2>
        <input
          autoFocus
          type="password"
          className="garden-input mt-5"
          value={ownerKey}
          onChange={(event) => setOwnerKey(event.target.value)}
          placeholder="Owner key"
        />
        {error && (
          <p className="mt-3 text-sm font-bold text-[var(--app-danger)]">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            className="garden-button garden-button-primary"
            disabled={loading}
          >
            {loading ? "Unlocking..." : "Unlock"}
          </button>
          <button type="button" className="garden-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function CordylineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 21V9" strokeLinecap="round" />
      <path d="M12 10C8 7 5 6 2.5 6.5 5 10 8 12 12 10Z" />
      <path d="M12 10c4-4 7-5.5 9.5-5-1.4 4-4.5 6.5-9.5 5Z" />
      <path d="M12 14c-3.5-1.5-6.2-1.4-8 .2 2.4 2.3 5.2 2.8 8-.2Z" />
      <path d="M12 14c3.4-2.2 6.2-2.8 8.5-1.4-1.8 2.8-4.6 3.6-8.5 1.4Z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.5-2h4l1.5 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}
