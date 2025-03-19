// Global error handler
window.onerror = function (msg, url, line, col, error) {
  console.error("Global error:", { msg, url, line, col, error });
  const status = document.getElementById("status");
  if (status) {
    status.textContent = `Error: ${msg}`;
    status.className = "error";
  }
  return false;
};

// Handle unhandled promise rejections
window.onunhandledrejection = function (event) {
  console.error("Unhandled promise rejection:", event.reason);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = `Unhandled Promise Error: ${event.reason}`;
    status.className = "error";
  }
};

// Function to update status
function updateStatus(message, isError = false) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
    status.className = isError ? "error" : "ready";
  }
  console.log(isError ? `Error: ${message}` : message);
}

// Function to check if a script is loaded
function isScriptLoaded(src) {
  return document.querySelector(`script[src="${src}"]`)?.complete;
}

// Function to handle script load error
function handleScriptError(scriptName) {
  updateStatus(`Failed to load ${scriptName}`, true);
}

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
  try {
    // Check if libraries are loaded
    if (typeof marked === "undefined") {
      handleScriptError("marked library");
      return;
    }
    if (typeof html2pdf === "undefined") {
      handleScriptError("html2pdf library");
      return;
    }

    // Check if our scripts are loaded
    if (!isScriptLoaded("utils/pdfGenerator.js")) {
      handleScriptError("PDF generator");
      return;
    }

    updateStatus("PDF Generator Ready");
    console.log("Offscreen document initialized and ready");
  } catch (error) {
    console.error("Initialization error:", error);
    updateStatus(error.message, true);
  }
});
