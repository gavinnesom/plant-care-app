import { useCallback, useEffect, useState } from "react";
import { ModeButton, UnlockDialog } from "./components/AppChrome";
import { GardenExperience } from "./features/garden/GardenExperience";
import { IdentifyExperience } from "./features/identify/IdentifyExperience";

function App() {
  const [view, setView] = useState("identify");
  const [gardenUnlocked, setGardenUnlocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [gardenSeed, setGardenSeed] = useState(null);

  useEffect(() => {
    fetch("/api/garden-session")
      .then((response) => response.json())
      .then((payload) => setGardenUnlocked(Boolean(payload.unlocked)))
      .catch(() => setGardenUnlocked(false));
  }, []);

  const enterGarden = (seed = null) => {
    if (!gardenUnlocked) {
      setPendingAction({ seed });
      setUnlockOpen(true);
      return;
    }
    setGardenSeed(seed);
    setView("garden");
  };

  const handleUnlocked = () => {
    setGardenUnlocked(true);
    setUnlockOpen(false);
    setGardenSeed(pendingAction?.seed || null);
    setPendingAction(null);
    setView("garden");
  };

  const clearGardenSeed = useCallback(() => setGardenSeed(null), []);
  const identifyModeControl = (
    <ModeButton
      mode="garden"
      onGarden={() => enterGarden()}
      onIdentify={() => setView("identify")}
    />
  );
  const gardenModeControl = (
    <ModeButton
      mode="identify"
      onGarden={() => enterGarden()}
      onIdentify={() => setView("identify")}
    />
  );

  return (
    <div className="app-shell min-h-screen px-4 py-5 text-[var(--app-text)] sm:py-7">
      <div className="mx-auto max-w-7xl">
        {view === "identify" ? (
          <IdentifyExperience
            modeControl={identifyModeControl}
            onAddToGarden={(seed) => enterGarden(seed)}
          />
        ) : (
          <GardenExperience
            modeControl={gardenModeControl}
            seed={gardenSeed}
            onSeedConsumed={clearGardenSeed}
          />
        )}
      </div>
      {unlockOpen && (
        <UnlockDialog
          onUnlocked={handleUnlocked}
          onCancel={() => {
            setUnlockOpen(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
