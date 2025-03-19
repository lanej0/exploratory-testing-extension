/**
 * @jest-environment jsdom
 */

describe("Popup Script", () => {
  let popup;

  beforeEach(() => {
    // Set up document body
    document.body.innerHTML = `
      <button id="startSession">Start Session</button>
      <button id="endSession">End Session</button>
      <button id="addObservation">Add Observation</button>
      <div id="observationForm" class="hidden">
        <textarea id="notes"></textarea>
        <div class="screenshot-preview"></div>
        <button id="saveObservation">Save</button>
        <button id="cancelObservation">Cancel</button>
      </div>
      <div id="sessionStatus">No active session</div>
      <div id="observationsList"></div>
    `;

    // Import mock popup script
    popup = require("./popup.mock.js");
    // Initialize UI state
    popup.init();
  });

  describe("Session Management UI", () => {
    it("should initialize UI with no active session", () => {
      const startBtn = document.getElementById("startSession");
      const endBtn = document.getElementById("endSession");
      const addBtn = document.getElementById("addObservation");

      expect(startBtn.disabled).toBe(false);
      expect(endBtn.disabled).toBe(true);
      expect(addBtn.disabled).toBe(true);
    });

    it("should update UI when session starts", async () => {
      const mockSession = {
        id: 123,
        observations: [],
      };

      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        session: mockSession,
      });

      await popup.handleStartSession();

      const startBtn = document.getElementById("startSession");
      const endBtn = document.getElementById("endSession");
      const addBtn = document.getElementById("addObservation");
      const status = document.getElementById("sessionStatus");

      expect(startBtn.disabled).toBe(true);
      expect(endBtn.disabled).toBe(false);
      expect(addBtn.disabled).toBe(false);
      expect(status.textContent).toBe("Observations: 0");
    });
  });

  describe("Observation Form", () => {
    it("should show observation form with screenshot preview", async () => {
      const form = document.getElementById("observationForm");
      const notes = document.getElementById("notes");

      chrome.tabs.query.mockResolvedValueOnce([
        {
          id: 1,
          url: "https://example.com",
        },
      ]);

      await popup.showObservationForm();

      expect(form.classList.contains("hidden")).toBe(false);
      expect(notes.value).toBe("");
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
    });

    it("should handle observation submission", async () => {
      const mockSession = {
        id: 123,
        observations: [],
      };

      popup.activeSession = mockSession;

      const notes = document.getElementById("notes");
      notes.value = "Test observation";

      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        session: {
          ...mockSession,
          observations: [
            {
              id: 1,
              notes: "Test observation",
            },
          ],
        },
      });

      await popup.handleAddObservation();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: "addObservation",
        session: mockSession,
        notes: "Test observation",
        annotatedScreenshot: null,
      });

      const form = document.getElementById("observationForm");
      expect(form.classList.contains("hidden")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle session start failure", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: false,
        error: "Failed to start session",
      });

      await popup.handleStartSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to start session:",
        "Failed to start session"
      );

      consoleSpy.mockRestore();
    });

    it("should validate observation notes before submission", async () => {
      const mockSession = {
        id: 123,
        observations: [],
      };

      popup.activeSession = mockSession;

      const notes = document.getElementById("notes");
      notes.value = "";

      const alertMock = jest.spyOn(window, "alert").mockImplementation();

      await popup.handleAddObservation();

      expect(alertMock).toHaveBeenCalledWith("Please enter observation notes");
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

      alertMock.mockRestore();
    });
  });
});
