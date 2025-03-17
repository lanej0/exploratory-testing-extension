import { AnnotationTool } from "./utils/annotationTool.js";

const startSessionBtn = document.getElementById("startSession");
const endSessionBtn = document.getElementById("endSession");
const addObservationBtn = document.getElementById("addObservation");
const observationForm = document.getElementById("observationForm");
const cancelObservationBtn = document.getElementById("cancelObservation");
const saveObservationBtn = document.getElementById("saveObservation");
const notesInput = document.getElementById("notes");
const sessionStatus = document.getElementById("sessionStatus");
const observationsList = document.getElementById("observationsList");
const observationsContainer = document.querySelector(".observations-container");

let annotationTool = null;
let activeSession = null;

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  // Check for active session
  const result = await chrome.storage.local.get("activeSession");
  if (result.activeSession) {
    activeSession = result.activeSession;
    updateUIForActiveSession();
  }

  // Set up event listeners
  startSessionBtn.addEventListener("click", handleStartSession);
  endSessionBtn.addEventListener("click", handleEndSession);
  addObservationBtn.addEventListener("click", showObservationForm);
  cancelObservationBtn.addEventListener("click", hideObservationForm);
  saveObservationBtn.addEventListener("click", handleAddObservation);
});

function updateUIForActiveSession() {
  startSessionBtn.disabled = true;
  endSessionBtn.disabled = false;
  addObservationBtn.disabled = false;
  const count = activeSession.observations.length;
  sessionStatus.textContent = `Observations: ${count}`;
}

async function handleStartSession() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "startSession",
    });
    if (response.success) {
      activeSession = response.session;
      updateUIForActiveSession();
    } else {
      console.error("Failed to start session:", response.error);
    }
  } catch (error) {
    console.error("Error starting session:", error);
  }
}

async function handleEndSession() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "endSession",
      session: activeSession,
    });

    if (response.success) {
      activeSession = null;
      startSessionBtn.disabled = false;
      endSessionBtn.disabled = true;
      addObservationBtn.disabled = true;
      sessionStatus.textContent = "No active session";
      hideObservationForm();
    } else {
      console.error("Failed to end session:", response.error);
    }
  } catch (error) {
    console.error("Error ending session:", error);
  }
}

function showObservationForm() {
  observationForm.classList.remove("hidden");
  notesInput.value = "";
  notesInput.focus();
  captureAndPreviewScreenshot();
}

function hideObservationForm() {
  observationForm.classList.add("hidden");
  notesInput.value = "";
  if (annotationTool) {
    annotationTool.clear();
  }
}

async function captureAndPreviewScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    const screenshot = await chrome.tabs.captureVisibleTab();
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = screenshot;
    });

    if (!annotationTool) {
      annotationTool = new AnnotationTool(".screenshot-preview");
    }
    await annotationTool.loadImage(img);
  } catch (error) {
    console.error("Error capturing screenshot:", error);
  }
}

async function handleAddObservation() {
  if (!activeSession) return;

  const notes = notesInput.value.trim();
  if (!notes) {
    alert("Please enter observation notes");
    return;
  }

  try {
    let annotatedScreenshot = null;
    if (annotationTool) {
      annotatedScreenshot = annotationTool.getAnnotatedImage();
    }

    const response = await chrome.runtime.sendMessage({
      action: "addObservation",
      session: activeSession,
      notes,
      annotatedScreenshot,
    });

    if (response.success) {
      activeSession = response.session;
      updateUIForActiveSession();
      hideObservationForm();
    } else {
      console.error("Failed to add observation:", response.error);
    }
  } catch (error) {
    console.error("Error adding observation:", error);
  }
}
