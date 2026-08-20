import { useEffect, useState } from "react";
import { apiJson, uploadGardenPhoto } from "../../lib/api";
import {
  makePhotoPreview,
  revokePreviews,
  validateFiles,
} from "../../lib/photos";
import { MAX_IDENTIFICATION_IMAGES } from "../../lib/plantSchema";
import {
  DeletedPlants,
  GardenList,
  GrowPlant,
  PlantDetail,
} from "./GardenViews";

const emptyDraft = {
  plantName: "",
  location: "",
  plantType: "",
  files: [],
  selectedFileIds: [],
  result: null,
  assessmentMeta: null,
};

export function GardenExperience({ modeControl, seed, onSeedConsumed }) {
  const [screen, setScreen] = useState("list");
  const [plants, setPlants] = useState([]);
  const [deletedPlants, setDeletedPlants] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const loadGarden = async () => {
    setLoading(true);
    try {
      const payload = await apiJson(
        "/api/garden-plants",
        {},
        "Unable to load My Garden.",
      );
      setPlants(payload.plants || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGarden();
  }, []);

  useEffect(() => {
    if (!seed) return;
    const files = (seed.files || []).map(makePhotoPreview);
    setDraft({
      plantName: seed.result?.commonName || "",
      location: "",
      plantType: seed.result?.scientificName || seed.result?.commonName || "",
      files,
      selectedFileIds: files
        .map((file) => file.id)
        .slice(0, MAX_IDENTIFICATION_IMAGES),
      result: seed.result || null,
      assessmentMeta: seed.assessmentMeta || null,
    });
    setScreen("grow");
    setError("");
    onSeedConsumed();
  }, [seed, onSeedConsumed]);

  const openPlant = async (plant) => {
    setBusy("open");
    setError("");
    try {
      const payload = await apiJson(
        `/api/garden-plants/${plant.id}`,
        {},
        "Unable to open this plant.",
      );
      setSelectedPlant(withSelections(payload.plant));
      setScreen("plant");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const startGrow = () => {
    revokePreviews(draft.files || []);
    setDraft(emptyDraft);
    setError("");
    setScreen("grow");
  };

  const openDeleted = async () => {
    setScreen("deleted");
    setLoading(true);
    setError("");
    try {
      const payload = await apiJson(
        "/api/garden-plants?view=deleted",
        {},
        "Unable to load recently deleted plants.",
      );
      setDeletedPlants(payload.plants || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const restoreDeletedPlant = async (plant) =>
    runPlantAction("restore-plant", async () => {
      await apiJson(
        `/api/garden-plants/${plant.id}`,
        { method: "POST" },
        "Unable to restore this plant.",
      );
      setDeletedPlants((current) =>
        current.filter((item) => item.id !== plant.id),
      );
      await loadGarden();
    });

  const addDraftFiles = (fileList) => {
    const additions = Array.from(fileList || []).map(makePhotoPreview);
    const validationError = validateFiles(additions);
    if (validationError) {
      revokePreviews(additions);
      setError(validationError);
      return;
    }
    setDraft((current) => ({
      ...current,
      files: [...current.files, ...additions],
      selectedFileIds: [
        ...current.selectedFileIds,
        ...additions.map((file) => file.id),
      ].slice(0, MAX_IDENTIFICATION_IMAGES),
      result: null,
      assessmentMeta: null,
    }));
  };

  const removeDraftFile = (id) => {
    const removed = draft.files.find((file) => file.id === id);
    if (removed) revokePreviews([removed]);
    setDraft((current) => ({
      ...current,
      files: current.files.filter((file) => file.id !== id),
      selectedFileIds: current.selectedFileIds.filter(
        (fileId) => fileId !== id,
      ),
      result: null,
      assessmentMeta: null,
    }));
  };

  const toggleDraftFile = (id) => {
    setDraft((current) => ({
      ...current,
      selectedFileIds: toggleLimited(
        current.selectedFileIds,
        id,
        MAX_IDENTIFICATION_IMAGES,
      ),
    }));
  };

  const identifyDraft = async () => {
    const chosen = draft.files.filter((file) =>
      draft.selectedFileIds.includes(file.id),
    );
    if (!chosen.length) {
      setError("Choose at least one reference photo to identify.");
      return;
    }
    setBusy("identify-draft");
    setError("");
    const formData = new FormData();
    chosen.forEach((photo) => formData.append("images", photo.file));
    try {
      const response = await fetch("/api/identify-plant", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ||
            payload.error ||
            "Unable to identify this plant.",
        );
      setDraft((current) => ({
        ...current,
        result: payload.result,
        assessmentMeta: payload.assessmentMeta,
        plantType:
          current.plantType ||
          payload.result.scientificName ||
          payload.result.commonName,
      }));
      if (payload.warning) setError(payload.warning);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const saveDraft = async () => {
    setBusy("save-draft");
    setError("");
    let createdPlantId = "";
    try {
      let payload = await apiJson(
        "/api/garden-plants",
        {
          method: "POST",
          body: JSON.stringify({
            plantName: draft.plantName,
            location: draft.location,
            plantType: draft.plantType,
            identitySource: draft.result ? "ai_accepted" : "manual",
          }),
        },
        "Unable to save this plant.",
      );
      createdPlantId = payload.plant.id;
      const uploadedIds = [];
      for (const photo of draft.files) {
        payload = await uploadGardenPhoto(
          payload.plant.id,
          photo.file,
          "identity_reference",
        );
        uploadedIds.push(payload.photoId);
      }
      if (draft.result) {
        const selectedIndexes = draft.files
          .map((file, index) =>
            draft.selectedFileIds.includes(file.id) ? index : -1,
          )
          .filter((index) => index >= 0);
        payload = await apiJson(
          `/api/garden-plants/${payload.plant.id}/ai-assessments`,
          {
            method: "POST",
            body: JSON.stringify({
              result: draft.result,
              assessmentMeta: draft.assessmentMeta,
              photoIds: selectedIndexes.map((index) => uploadedIds[index]),
            }),
          },
          "The plant was saved, but its AI assessment could not be attached.",
        );
      }
      revokePreviews(draft.files);
      setDraft(emptyDraft);
      setSelectedPlant(withSelections(payload.plant));
      setScreen("plant");
      await loadGarden();
    } catch (requestError) {
      if (createdPlantId) {
        await apiJson(
          `/api/garden-plants/${createdPlantId}`,
          { method: "DELETE" },
          "Unable to roll back the incomplete plant.",
        ).catch(() => null);
      }
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const updatePlant = async () =>
    runPlantAction("save-plant", async () => {
      const payload = await apiJson(
        `/api/garden-plants/${selectedPlant.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            plantName: selectedPlant.plantName,
            location: selectedPlant.location,
            plantType: selectedPlant.plantType,
            identitySource: selectedPlant.identitySource,
          }),
        },
        "Unable to update this plant.",
      );
      setSelectedPlant(withSelections(payload.plant, selectedPlant));
      await loadGarden();
    });

  const addReferencePhotos = async (fileList) =>
    runPlantAction("upload-reference", async () => {
      const files = Array.from(fileList || []);
      const validationError = validateFiles(files);
      if (validationError) throw new Error(validationError);
      let payload;
      for (const file of files)
        payload = await uploadGardenPhoto(
          selectedPlant.id,
          file,
          "identity_reference",
        );
      setSelectedPlant(withSelections(payload.plant, selectedPlant));
      await loadGarden();
    });

  const deletePhoto = async (photoId) =>
    runPlantAction("delete-photo", async () => {
      const payload = await apiJson(
        `/api/garden-photos/${photoId}`,
        { method: "DELETE" },
        "Unable to remove this photo.",
      );
      setSelectedPlant(withSelections(payload.plant, selectedPlant));
      await loadGarden();
    });

  const identifyPlant = async () =>
    runPlantAction("identify-plant", async () => {
      const photoIds = selectedPlant.selectedReferencePhotoIds || [];
      if (!photoIds.length)
        throw new Error("Choose at least one identity/reference photo.");
      const payload = await apiJson(
        "/api/garden-identify-plant",
        {
          method: "POST",
          body: JSON.stringify({ plantId: selectedPlant.id, photoIds }),
        },
        "Unable to identify this plant.",
      );
      setSelectedPlant(withSelections(payload.plant, selectedPlant));
      if (payload.warning) setError(payload.warning);
      await loadGarden();
    });

  const generateCareGuide = async () =>
    runPlantAction("care-guide", async () => {
      const payload = await apiJson(
        `/api/garden-plants/${selectedPlant.id}/care-guide`,
        {
          method: "POST",
          body: JSON.stringify({
            referencePhotoIds: selectedPlant.selectedReferencePhotoIds || [],
          }),
        },
        "Unable to generate care guidance.",
      );
      setSelectedPlant(withSelections(payload.plant, selectedPlant));
    });

  const saveObservation = async ({ description, files }) =>
    runPlantAction("observation", async () => {
      const validationError = validateFiles(files);
      if (validationError) throw new Error(validationError);
      const photoIds = [];
      try {
        for (const file of files) {
          const payload = await uploadGardenPhoto(
            selectedPlant.id,
            file,
            "observation_problem",
          );
          photoIds.push(payload.photoId);
        }
        const payload = await apiJson(
          `/api/garden-plants/${selectedPlant.id}/observations`,
          {
            method: "POST",
            body: JSON.stringify({ description, photoIds }),
          },
          "Unable to save this observation.",
        );
        setSelectedPlant(withSelections(payload.plant, selectedPlant));
        await loadGarden();
      } catch (requestError) {
        await Promise.allSettled(
          photoIds.map((photoId) =>
            apiJson(
              `/api/garden-photos/${photoId}`,
              { method: "DELETE" },
              "Unable to remove an incomplete observation photo.",
            ),
          ),
        );
        throw requestError;
      }
    });

  const diagnose = async () =>
    runPlantAction("diagnosis", async () => {
      const payload = await apiJson(
        `/api/garden-plants/${selectedPlant.id}/diagnoses`,
        {
          method: "POST",
          body: JSON.stringify({
            observationIds: selectedPlant.selectedObservationIds || [],
            referencePhotoIds: selectedPlant.selectedReferencePhotoIds || [],
          }),
        },
        "Unable to diagnose this problem.",
      );
      setSelectedPlant(withSelections(payload.plant, selectedPlant));
    });

  const deletePlant = async () => {
    if (
      !window.confirm(
        `Move ${selectedPlant.plantName || "this plant"} to Recently deleted? You can restore it later.`,
      )
    )
      return;
    await runPlantAction("delete-plant", async () => {
      await apiJson(
        `/api/garden-plants/${selectedPlant.id}`,
        { method: "DELETE" },
        "Unable to delete this plant.",
      );
      setSelectedPlant(null);
      setScreen("list");
      await loadGarden();
    });
  };

  async function runPlantAction(name, action) {
    setBusy(name);
    setError("");
    try {
      await action();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  if (screen === "grow") {
    return (
      <GrowPlant
        draft={draft}
        onChange={setDraft}
        error={error}
        busy={busy}
        modeControl={modeControl}
        onAddFiles={addDraftFiles}
        onRemoveFile={removeDraftFile}
        onToggleFile={toggleDraftFile}
        onIdentify={identifyDraft}
        onSave={saveDraft}
        onCancel={() => setScreen("list")}
      />
    );
  }
  if (screen === "deleted") {
    return (
      <DeletedPlants
        plants={deletedPlants}
        loading={loading || busy === "restore-plant"}
        error={error}
        onBack={() => setScreen("list")}
        onRestore={restoreDeletedPlant}
      />
    );
  }
  if (screen === "plant" && selectedPlant) {
    return (
      <PlantDetail
        plant={selectedPlant}
        onChange={setSelectedPlant}
        error={error}
        busy={busy}
        modeControl={modeControl}
        onBack={() => setScreen("list")}
        onSave={updatePlant}
        onDelete={deletePlant}
        onAddReferencePhotos={addReferencePhotos}
        onDeletePhoto={deletePhoto}
        onIdentify={identifyPlant}
        onCareGuide={generateCareGuide}
        onSaveObservation={saveObservation}
        onDiagnose={diagnose}
        onPrint={() => window.print()}
      />
    );
  }
  return (
    <GardenList
      plants={plants}
      loading={loading || busy === "open"}
      error={error}
      modeControl={modeControl}
      onGrow={startGrow}
      onDeleted={openDeleted}
      onOpenPlant={openPlant}
    />
  );
}

function toggleLimited(ids, id, max) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  return ids.length < max ? [...ids, id] : ids;
}

function withSelections(plant, previous = null) {
  const referenceIds = (plant.photos || [])
    .filter((photo) => photo.purpose === "identity_reference")
    .map((photo) => photo.id);
  const observationIds = (plant.observations || []).map(
    (observation) => observation.id,
  );
  return {
    ...plant,
    selectedReferencePhotoIds: (
      previous?.selectedReferencePhotoIds || referenceIds
    )
      .filter((id) => referenceIds.includes(id))
      .slice(0, MAX_IDENTIFICATION_IMAGES),
    selectedObservationIds: (
      previous?.selectedObservationIds || observationIds
    ).filter((id) => observationIds.includes(id)),
  };
}
