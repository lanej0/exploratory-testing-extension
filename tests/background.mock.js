// Mock importScripts since it's not available in Node.js
global.importScripts = jest.fn();
global.MarkdownGenerator = {
  generateFullReport: jest.fn(),
};

// Export functions for testing
module.exports = {
  setupOffscreenDocument: async function () {
    try {
      const existingContexts =
        (await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
        })) || [];

      if (existingContexts.length > 0) {
        return;
      }

      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["DOM_PARSER"],
        justification: "Generate PDF reports with embedded images",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const contexts =
        (await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT"],
        })) || [];

      if (contexts.length === 0) {
        throw new Error("Failed to create offscreen document");
      }
    } catch (error) {
      throw error;
    }
  },

  updateIcon: function (isDark) {
    const iconPath = {
      16: `icons/${isDark ? "dark" : "light"}/icon16.png`,
      48: `icons/${isDark ? "dark" : "light"}/icon48.png`,
      128: `icons/${isDark ? "dark" : "light"}/icon128.png`,
    };

    chrome.action.setIcon({ path: iconPath });
  },

  startNewSession: async function () {
    const session = {
      id: Date.now(),
      startTime: new Date().toISOString(),
      observations: [],
      filename: `exploratory-session-${Date.now()}.md`,
    };

    await chrome.storage.local.set({ activeSession: session });
    return session;
  },

  addObservation: async function (
    sessionData,
    notes,
    annotatedScreenshot = null
  ) {
    try {
      const [tab] = (await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })) || [null];

      if (!tab?.id) {
        throw new Error("No active tab found");
      }

      const screenshotData = {
        dataUrl: "data:image/png;base64,mock",
        url: tab.url,
        title: tab.title,
      };

      const observationId = Date.now();
      const screenshotKey = `screenshot-${sessionData.id}-${observationId}`;

      const observation = {
        id: observationId,
        timestamp: new Date().toISOString(),
        url: tab.url,
        title: tab.title,
        notes,
        screenshotKey,
      };

      const updatedSession = {
        ...sessionData,
        observations: [...sessionData.observations, observation],
      };

      await chrome.storage.local.set({ activeSession: updatedSession });
      return { success: true, session: updatedSession };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
