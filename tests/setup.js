// Mock the global chrome object
global.chrome = require("./mocks/chrome");

// Mock canvas and image functionality
global.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      drawImage: jest.fn(),
    };
  }

  convertToBlob() {
    return Promise.resolve(new Blob());
  }
};

global.createImageBitmap = jest.fn().mockResolvedValue({
  width: 1920,
  height: 1080,
});

// Mock FileReader
global.FileReader = class FileReader {
  constructor() {
    this.result = "data:image/jpeg;base64,mockbase64data";
  }

  readAsDataURL() {
    setTimeout(() => this.onloadend(), 0);
  }
};

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
