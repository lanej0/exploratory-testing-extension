// Import dependencies using importScripts
importScripts("lib/jszip.min.js", "utils/markdown.js");

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Exploratory Testing Assistant installed");
});

// Handle session management
async function startNewSession() {
  const session = {
    id: Date.now(),
    startTime: new Date().toISOString(),
    observations: [],
    filename: `exploratory-session-${Date.now()}.md`,
  };

  await chrome.storage.local.set({ activeSession: session });
  return session;
}

async function captureScreenshot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Capture the visible tab
  const screenshot = await chrome.tabs.captureVisibleTab(null, {
    format: "png",
  });

  return {
    dataUrl: screenshot,
    url: tab.url,
    title: tab.title,
  };
}

async function compressImage(dataUrl, maxWidth = 1280) {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create ImageBitmap from blob
    const imageBitmap = await createImageBitmap(blob);

    // Calculate new dimensions
    let width = imageBitmap.width;
    let height = imageBitmap.height;

    if (width > maxWidth) {
      height = Math.floor(height * (maxWidth / width));
      width = maxWidth;
    }

    // Create canvas for compression
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Draw and compress
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
  } catch (error) {
    console.error("Error compressing image:", error);
    throw error;
  }
}

async function saveScreenshot(dataUrl, sessionId, observationId) {
  try {
    // Compress the image
    const blob = await compressImage(dataUrl);

    // Convert compressed blob to data URL
    const compressedDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    // Create a key for the screenshot
    const screenshotKey = `screenshot-${sessionId}-${observationId}`;

    // Store the compressed screenshot data
    await chrome.storage.local.set({
      [screenshotKey]: compressedDataUrl,
    });

    return screenshotKey;
  } catch (error) {
    console.error("Error saving screenshot:", error);
    throw error;
  }
}

async function addObservation(sessionData, notes, annotatedScreenshot = null) {
  try {
    // Get current tab info first
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      throw new Error("No active tab found");
    }

    let screenshotData;
    if (annotatedScreenshot) {
      screenshotData = {
        dataUrl: annotatedScreenshot,
        url: tab.url,
        title: tab.title,
      };
    } else {
      screenshotData = await captureScreenshot();
    }

    const observationId = Date.now();
    const screenshotKey = await saveScreenshot(
      screenshotData.dataUrl,
      sessionData.id,
      observationId
    );

    const observation = {
      id: observationId,
      timestamp: new Date().toISOString(),
      url: tab.url,
      title: tab.title,
      notes,
      screenshotKey: screenshotKey,
    };

    // Update session with new observation
    const updatedSession = {
      ...sessionData,
      observations: [...sessionData.observations, observation],
    };

    await chrome.storage.local.set({ activeSession: updatedSession });
    return { success: true, session: updatedSession };
  } catch (error) {
    console.error("Error adding observation:", error);
    return { success: false, error: error.message };
  }
}

async function endSession(session) {
  try {
    // Create a temporary array to store all promises
    const screenshotPromises = session.observations.map(async (observation) => {
      // Get screenshot data from storage
      const result = await chrome.storage.local.get(observation.screenshotKey);
      return {
        key: observation.screenshotKey,
        dataUrl: result[observation.screenshotKey],
      };
    });

    // Wait for all screenshots to be retrieved
    const screenshots = await Promise.all(screenshotPromises);

    // Now create the markdown and download all content
    const markdown = MarkdownGenerator.generateFullReport(session);

    // Format date for filename
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "-");
    const baseFilename = `exploratory-testing-${dateStr}-${timeStr}`;

    // Create a zip file containing markdown and screenshots
    const zip = new JSZip();

    // Add markdown file
    zip.file(`${baseFilename}.md`, markdown);

    // Add all screenshots to the zip
    screenshots.forEach((screenshot) => {
      // Convert base64 data URL to binary
      const imageData = screenshot.dataUrl.split(",")[1];
      zip.file(`screenshots/${screenshot.key}.png`, imageData, {
        base64: true,
      });
    });

    // Generate zip file as base64 data URL
    const zipBlob = await zip.generateAsync({ type: "base64" });
    const dataUrl = "data:application/zip;base64," + zipBlob;

    // Download the zip file with a user-friendly name
    const downloadResult = await chrome.downloads.download({
      url: dataUrl,
      filename: `${baseFilename}.zip`,
      saveAs: true,
    });

    // Clean up screenshots from storage
    const keysToRemove = screenshots.map((s) => s.key);
    await chrome.storage.local.remove(keysToRemove);
    await chrome.storage.local.remove("activeSession");

    return { success: true };
  } catch (error) {
    console.error("Error ending session:", error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "startSession":
      startNewSession()
        .then((session) => sendResponse({ success: true, session }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Will respond asynchronously

    case "addObservation":
      addObservation(
        request.session,
        request.notes,
        request.annotatedScreenshot
      )
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "endSession":
      endSession(request.session)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Will respond asynchronously
  }
});
