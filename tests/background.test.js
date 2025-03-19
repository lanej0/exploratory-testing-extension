const { describe, it, expect } = require("@jest/globals");

describe("Background Script", () => {
  // Import the mock functions to test
  const background = require("./background.mock.js");

  describe("setupOffscreenDocument", () => {
    it("should create offscreen document if it does not exist", async () => {
      // First call returns empty array (no existing document)
      chrome.runtime.getContexts.mockResolvedValueOnce([]);
      // Second call returns array with one document (document was created)
      chrome.runtime.getContexts.mockResolvedValueOnce([
        { type: "OFFSCREEN_DOCUMENT" },
      ]);

      await background.setupOffscreenDocument();

      expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: "offscreen.html",
        reasons: ["DOM_PARSER"],
        justification: "Generate PDF reports with embedded images",
      });
    });

    it("should not create offscreen document if it already exists", async () => {
      chrome.runtime.getContexts.mockResolvedValueOnce([
        { type: "OFFSCREEN_DOCUMENT" },
      ]);
      await background.setupOffscreenDocument();

      expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    });
  });

  describe("Session Management", () => {
    it("should start a new session with correct structure", async () => {
      const session = await background.startNewSession();

      expect(session).toEqual({
        id: expect.any(Number),
        startTime: expect.any(String),
        observations: [],
        filename: expect.stringMatching(/^exploratory-session-\d+\.md$/),
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activeSession: session,
      });
    });

    it("should add observation with screenshot", async () => {
      const mockSession = {
        id: 123,
        observations: [],
      };

      const mockTab = {
        id: 1,
        url: "https://example.com",
        title: "Test Page",
      };

      chrome.tabs.query.mockResolvedValueOnce([mockTab]);

      const result = await background.addObservation(
        mockSession,
        "Test observation"
      );

      expect(result.success).toBe(true);
      expect(result.session.observations).toHaveLength(1);
      expect(result.session.observations[0]).toEqual({
        id: expect.any(Number),
        timestamp: expect.any(String),
        url: mockTab.url,
        title: mockTab.title,
        notes: "Test observation",
        screenshotKey: expect.stringMatching(/^screenshot-123-\d+$/),
      });
    });
  });

  describe("Theme Management", () => {
    it("should update icon based on theme", () => {
      background.updateIcon(true);

      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: "icons/dark/icon16.png",
          48: "icons/dark/icon48.png",
          128: "icons/dark/icon128.png",
        },
      });

      background.updateIcon(false);

      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: "icons/light/icon16.png",
          48: "icons/light/icon48.png",
          128: "icons/light/icon128.png",
        },
      });
    });
  });
});
