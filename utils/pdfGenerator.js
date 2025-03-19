// Log initialization
console.log("PDF Generator loading...");

// Update status in the UI
function updateStatus(message, isError = false) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
    status.className = isError ? "error" : "ready";
  }
  console.log(isError ? `Error: ${message}` : message);
}

// Check if required libraries are loaded
function checkDependencies() {
  try {
    if (typeof marked === "undefined") {
      throw new Error("marked library not found");
    }
    if (typeof html2pdf === "undefined") {
      throw new Error("html2pdf library not found");
    }
    updateStatus("Dependencies loaded successfully");
    return true;
  } catch (error) {
    updateStatus(error.message, true);
    return false;
  }
}

// Function to generate PDF from markdown
async function generatePDF(markdown, screenshots) {
  try {
    updateStatus("Starting PDF generation process");
    console.time("pdfGeneration");

    // Convert markdown to HTML
    updateStatus("Converting markdown to HTML");
    console.time("markdownConversion");
    let html = marked.parse(markdown);
    console.timeEnd("markdownConversion");
    console.log("HTML conversion complete, length:", html.length);

    // Process screenshots in batches to manage memory
    updateStatus("Processing screenshots");
    console.time("screenshotProcessing");
    const BATCH_SIZE = 2; // Process 2 screenshots at a time
    for (let i = 0; i < screenshots.length; i += BATCH_SIZE) {
      const batch = screenshots.slice(i, i + BATCH_SIZE);
      for (const screenshot of batch) {
        const placeholder = `screenshots/${screenshot.key}.png`;
        // Compress the data URL further if it's too large
        let processedDataUrl = screenshot.dataUrl;
        if (screenshot.dataUrl.length > 200000) {
          // If larger than ~200KB
          processedDataUrl = await compressDataUrl(screenshot.dataUrl);
        }
        html = html.replace(placeholder, processedDataUrl);
        console.log(`Processed screenshot: ${screenshot.key}`);
      }
      // Small delay between batches to allow garbage collection
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.timeEnd("screenshotProcessing");
    console.log("Screenshot processing complete");

    // Create container for the HTML
    updateStatus("Creating HTML container");
    const container = document.createElement("div");
    container.innerHTML = html;

    // Add container to the content div instead of body
    const content = document.getElementById("content");
    content.innerHTML = ""; // Clear any previous content
    content.appendChild(container);
    console.log("HTML container created and added to document");

    // Configure PDF options with more aggressive optimization
    const options = {
      margin: 10,
      filename: "report.pdf",
      image: { type: "jpeg", quality: 0.75 }, // Further reduced quality
      html2canvas: {
        scale: 1.5,
        logging: true,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 30000,
        backgroundColor: null, // Transparent background
        removeContainer: true, // Clean up after rendering
        onclone: function (doc) {
          console.log("html2canvas cloned document");
          // Add all required stylesheets
          const stylesheets = ["styles/pdf.css", "styles/html2pdf-iframe.css"];
          stylesheets.forEach((stylesheet) => {
            const link = doc.createElement("link");
            link.rel = "stylesheet";
            link.href = chrome.runtime.getURL(stylesheet);
            doc.head.appendChild(link);
          });
        },
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
        optimization: {
          compress: true,
          maxResolution: 150, // Lower resolution for images
        },
      },
    };

    updateStatus("Generating PDF...");
    console.time("pdfConversion");
    const pdfBlob = await html2pdf()
      .set(options)
      .from(container)
      .outputPdf("blob");
    console.timeEnd("pdfConversion");
    console.log("PDF blob size:", pdfBlob.size);

    // Convert blob to base64
    updateStatus("Converting PDF to base64");
    console.time("base64Conversion");
    const reader = new FileReader();
    const pdfData = await new Promise((resolve, reject) => {
      reader.onloadend = () => {
        console.timeEnd("base64Conversion");
        console.log("Base64 conversion complete");
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = (error) => {
        console.error("Error converting to base64:", error);
        reject(error);
      };
      reader.readAsDataURL(pdfBlob);
    });

    // Clean up
    content.innerHTML = ""; // Clear the content
    console.timeEnd("pdfGeneration");
    updateStatus("PDF generation complete");
    return { success: true, pdfData };
  } catch (error) {
    console.error("Error generating PDF:", error);
    console.error("Error stack:", error.stack);
    updateStatus(`PDF generation failed: ${error.message}`, true);
    return { success: false, error: error.message };
  }
}

// Helper function to compress data URLs
async function compressDataUrl(dataUrl) {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create ImageBitmap
    const imageBitmap = await createImageBitmap(blob);

    // Calculate new dimensions (max width 1024px)
    const maxWidth = 1024;
    let width = imageBitmap.width;
    let height = imageBitmap.height;

    if (width > maxWidth) {
      height = Math.floor(height * (maxWidth / width));
      width = maxWidth;
    }

    // Create canvas and compress
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // Convert to blob with lower quality
    const compressedBlob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.6,
    });

    // Convert back to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error("Error compressing data URL:", error);
    return dataUrl; // Return original if compression fails
  }
}

// Handle PDF generation request
async function handlePDFGeneration(message) {
  console.log("Establishing connection to background script...");
  const port = chrome.runtime.connect({ name: "pdf-generator" });

  try {
    updateStatus("Checking dependencies...");
    if (!checkDependencies()) {
      const error = "Required libraries not loaded";
      updateStatus(error, true);
      port.postMessage({
        type: "pdfGenerationComplete",
        success: false,
        error,
      });
      return;
    }

    updateStatus("Starting PDF generation");
    console.log("Starting PDF generation with data:", {
      markdownLength: message.markdown?.length,
      screenshotsCount: message.screenshots?.length,
    });

    const result = await generatePDF(message.markdown, message.screenshots);
    console.log("PDF generation completed with result:", {
      success: result.success,
      pdfDataLength: result.pdfData?.length,
    });

    port.postMessage({
      type: "pdfGenerationComplete",
      ...result,
    });
    updateStatus(
      result.success ? "PDF generation complete" : "PDF generation failed",
      !result.success
    );
  } catch (error) {
    console.error("Error in PDF generation process:", error);
    console.error("Error stack:", error.stack);
    updateStatus(`PDF generation error: ${error.message}`, true);
    port.postMessage({
      type: "pdfGenerationComplete",
      success: false,
      error: error.message,
    });
  } finally {
    try {
      console.log("Disconnecting port...");
      port.disconnect();
      console.log("Port disconnected");
    } catch (error) {
      console.error("Error disconnecting port:", error);
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("PDF Generator received message:", message);

  if (message.type === "generatePDF") {
    // Handle the PDF generation request asynchronously
    handlePDFGeneration(message).catch((error) => {
      console.error("Error in handlePDFGeneration:", error);
      updateStatus(`Unhandled error: ${error.message}`, true);
    });
  }

  // Return false since we're handling the response asynchronously
  return false;
});

// Log when the script is fully loaded
updateStatus("PDF Generator loaded and ready");
