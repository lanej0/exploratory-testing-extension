// Listen for theme changes
const darkThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

// Function to send theme updates to the service worker
function sendThemeUpdateToServiceWorker(isDark) {
  chrome.runtime.sendMessage({ type: "themeChanged", isDark });
}

// Set initial theme
sendThemeUpdateToServiceWorker(darkThemeMediaQuery.matches);

// Listen for theme changes
darkThemeMediaQuery.addEventListener("change", (e) => {
  sendThemeUpdateToServiceWorker(e.matches);
});
