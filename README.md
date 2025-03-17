# Exploratory Testing Assistant

A Chrome extension that helps you conduct and document exploratory testing sessions. Capture screenshots, add annotations, and generate comprehensive markdown reports of your testing sessions.

## Features

- Start and manage exploratory testing sessions
- Capture screenshots of the current page
- Add annotations (arrows) to highlight specific areas
- Add notes to each observation
- Generate a comprehensive markdown report
- Export all observations and screenshots in a zip file

## Installation

### From Chrome Web Store

_(Coming soon)_

### Manual Installation

1. Download the latest release zip file
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the unzipped extension folder

## Usage

1. Click the extension icon to open the popup
2. Click "Start New Session" to begin a testing session
3. Navigate to the page you want to test
4. Click "Add Observation" to:
   - Capture a screenshot
   - Add annotations using the arrow tool
   - Add notes about what you observed
5. Repeat step 4 for each observation
6. Click "End Session" to:
   - Generate a markdown report
   - Download a zip file containing:
     - The markdown report
     - All annotated screenshots
     - Timeline of pages explored

## Development

### Project Structure

- `manifest.json` - Extension configuration
- `popup.html` - Main extension popup interface
- `popup.js` - Popup functionality
- `background.js` - Service worker for background tasks
- `styles.css` - Main styles
- `utils/` - Utility functions and classes
  - `annotationTool.js` - Screenshot annotation functionality
  - `markdown.js` - Report generation
- `lib/` - Third-party libraries
- `icons/` - Extension icons

### Building

1. Clone the repository
2. Make any desired modifications
3. Test using "Load unpacked" in Chrome
4. Create a zip file containing all necessary files for distribution

## License

MIT License - Feel free to modify and distribute as needed.
