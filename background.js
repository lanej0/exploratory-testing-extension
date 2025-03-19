// Import dependencies using importScripts
importScripts("lib/jszip.min.js", "utils/markdown.js");

// Handle creating/removing of offscreen document
async function setupOffscreenDocument() {
  try {
    // Check if offscreen document is already created
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });

    if (existingContexts.length > 0) {
      console.log("Offscreen document already exists");
      // Instead of recreating, just return if it exists
      return;
    }

    console.log("Creating new offscreen document...");
    // Create an offscreen document if it doesn't exist
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["DOM_PARSER"],
      justification: "Generate PDF reports with embedded images",
    });

    // Wait a moment for the document to fully initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify the document was created
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });

    if (contexts.length === 0) {
      throw new Error("Failed to create offscreen document");
    }

    console.log("Offscreen document created and initialized");
  } catch (error) {
    console.error("Error setting up offscreen document:", error);
    throw error;
  }
}

// Update extension icon based on theme
function updateIcon(isDark) {
  const iconPath = {
    16: `icons/${isDark ? "dark" : "light"}/icon16.png`,
    48: `icons/${isDark ? "dark" : "light"}/icon48.png`,
    128: `icons/${isDark ? "dark" : "light"}/icon128.png`,
  };

  chrome.action.setIcon({ path: iconPath });
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Exploratory Testing Assistant installed");
  setupOffscreenDocument().catch(console.error);
});

// Listen for theme changes from offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "themeChanged") {
    updateIcon(message.isDark);
  }
  return false;
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
    console.log("Starting session end process...");

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
    console.log("Retrieving screenshots...");
    const screenshots = await Promise.all(screenshotPromises);
    console.log(`Retrieved ${screenshots.length} screenshots`);

    // Now create the markdown and download all content
    console.log("Generating markdown report...");
    const markdown = MarkdownGenerator.generateFullReport(session);

    // Ensure offscreen document is ready
    console.log("Setting up offscreen document...");
    await setupOffscreenDocument();
    console.log("Offscreen document ready");

    // Generate PDF using offscreen document with timeout
    console.log("Starting PDF generation...");
    const pdfResponse = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.log("PDF generation timed out");
        chrome.runtime.onConnect.removeListener(connectionListener);
        reject(
          new Error(
            "PDF generation timed out - The process took longer than 120 seconds. Try reducing the number of screenshots or splitting the session into smaller parts."
          )
        );
      }, 120000); // Increased to 120 seconds

      // Listen for connection from offscreen document
      const connectionListener = (p) => {
        if (p.name === "pdf-generator") {
          console.log("Received connection from PDF generator");
          const port = p;

          port.onDisconnect.addListener(() => {
            console.log("PDF generator disconnected");
            chrome.runtime.onConnect.removeListener(connectionListener);
            clearTimeout(timeoutId);
            reject(
              new Error(
                "PDF generator disconnected before completion - This may indicate a memory issue. Try reducing the number of screenshots."
              )
            );
          });

          port.onMessage.addListener((message) => {
            console.log("Received message in background:", message);
            if (message.type === "pdfGenerationComplete") {
              console.log("PDF generation complete message received");
              clearTimeout(timeoutId);
              chrome.runtime.onConnect.removeListener(connectionListener);
              if (message.success) {
                console.log(
                  "PDF generation successful, data length:",
                  message.pdfData?.length
                );
                resolve(message);
              } else {
                console.error("PDF generation failed:", message.error);
                reject(
                  new Error(
                    message.error ||
                      "PDF generation failed - Check the console for more details."
                  )
                );
              }
            }
          });

          // Send the generatePDF message through the port
          const stats = {
            markdownLength: markdown?.length || 0,
            screenshotsCount: screenshots?.length || 0,
            totalScreenshotSize: screenshots.reduce(
              (total, s) => total + (s.dataUrl?.length || 0),
              0
            ),
          };
          console.log("Sending generatePDF message through port...", stats);
          port.postMessage({
            type: "generatePDF",
            markdown,
            screenshots,
          });
        }
      };

      // Add connection listener before sending initial message
      chrome.runtime.onConnect.addListener(connectionListener);

      // Send initial message to trigger connection
      console.log("Sending initial message to offscreen document...");
      chrome.runtime
        .sendMessage({
          type: "generatePDF",
          markdown,
          screenshots,
        })
        .catch((error) => {
          console.error("Error sending initial message:", error);
          // Don't reject here, as this error is expected
        });
    });

    console.log("PDF response received:", pdfResponse);
    if (!pdfResponse.success) {
      throw new Error(pdfResponse.error || "Failed to generate PDF");
    }

    const pdfData = pdfResponse.pdfData;
    console.log("PDF data received, creating zip file...");

    // Format date for filename
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "-");
    const baseFilename = `exploratory-testing-${dateStr}-${timeStr}`;

    // Create a zip file containing markdown, PDF and screenshots
    const zip = new JSZip();

    // Add markdown file
    zip.file(`${baseFilename}.md`, markdown);

    // Add PDF file
    zip.file(`${baseFilename}.pdf`, pdfData, { binary: true });

    // Add all screenshots to the zip
    screenshots.forEach((screenshot) => {
      // Convert base64 data URL to binary
      const imageData = screenshot.dataUrl.split(",")[1];
      zip.file(`screenshots/${screenshot.key}.png`, imageData, {
        base64: true,
      });
    });

    // Generate zip file as base64 data URL
    console.log("Generating zip file...");
    const zipBlob = await zip.generateAsync({ type: "base64" });
    const dataUrl = "data:application/zip;base64," + zipBlob;

    // Download the zip file with a user-friendly name
    console.log("Initiating download...");
    const downloadResult = await chrome.downloads.download({
      url: dataUrl,
      filename: `${baseFilename}.zip`,
      saveAs: true,
    });

    // Clean up screenshots from storage
    console.log("Cleaning up storage...");
    const keysToRemove = screenshots.map((s) => s.key);
    await chrome.storage.local.remove(keysToRemove);
    await chrome.storage.local.remove("activeSession");

    console.log("Session end process complete!");
    return { success: true };
  } catch (error) {
    console.error("Error ending session:", error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message in background:", request);

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
      console.log("Handling endSession request...");
      endSession(request.session)
        .then(() => {
          console.log("Session ended successfully");
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Error in endSession:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
  }
});
