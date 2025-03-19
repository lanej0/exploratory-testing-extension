// Mock the AnnotationTool import
class MockAnnotationTool {
  constructor() {
    this.clear = jest.fn();
    this.loadImage = jest.fn();
    this.getAnnotatedImage = jest.fn();
  }
}

let activeSession = null;

module.exports = {
  activeSession: null,

  init: function () {
    // Initialize button states
    document.getElementById("startSession").disabled = false;
    document.getElementById("endSession").disabled = true;
    document.getElementById("addObservation").disabled = true;
    document.getElementById("sessionStatus").textContent = "No active session";
  },

  handleStartSession: async function () {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "startSession",
      });
      if (response.success) {
        this.activeSession = response.session;
        this.updateUIForActiveSession();
      } else {
        console.error("Failed to start session:", response.error);
      }
    } catch (error) {
      console.error("Error starting session:", error);
    }
  },

  handleEndSession: async function () {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "endSession",
        session: this.activeSession,
      });

      if (response.success) {
        this.activeSession = null;
        document.getElementById("startSession").disabled = false;
        document.getElementById("endSession").disabled = true;
        document.getElementById("addObservation").disabled = true;
        document.getElementById("sessionStatus").textContent =
          "No active session";
        this.hideObservationForm();
      } else {
        console.error("Failed to end session:", response.error);
      }
    } catch (error) {
      console.error("Error ending session:", error);
    }
  },

  showObservationForm: async function () {
    const form = document.getElementById("observationForm");
    const notes = document.getElementById("notes");
    form.classList.remove("hidden");
    notes.value = "";
    notes.focus();
    await this.captureAndPreviewScreenshot();
  },

  hideObservationForm: function () {
    const form = document.getElementById("observationForm");
    const notes = document.getElementById("notes");
    form.classList.add("hidden");
    notes.value = "";
  },

  handleAddObservation: async function () {
    if (!this.activeSession) return;

    const notes = document.getElementById("notes").value.trim();
    if (!notes) {
      alert("Please enter observation notes");
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "addObservation",
        session: this.activeSession,
        notes,
        annotatedScreenshot: null,
      });

      if (response.success) {
        this.activeSession = response.session;
        this.updateUIForActiveSession();
        this.hideObservationForm();
      } else {
        console.error("Failed to add observation:", response.error);
      }
    } catch (error) {
      console.error("Error adding observation:", error);
    }
  },

  updateUIForActiveSession: function () {
    document.getElementById("startSession").disabled = true;
    document.getElementById("endSession").disabled = false;
    document.getElementById("addObservation").disabled = false;
    const count = this.activeSession.observations.length;
    document.getElementById(
      "sessionStatus"
    ).textContent = `Observations: ${count}`;
  },

  captureAndPreviewScreenshot: async function () {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return;

      await chrome.tabs.captureVisibleTab();
    } catch (error) {
      console.error("Error capturing screenshot:", error);
    }
  },
};
