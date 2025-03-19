module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  moduleNameMapper: {
    "^chrome$": "<rootDir>/tests/mocks/chrome.js",
  },
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
