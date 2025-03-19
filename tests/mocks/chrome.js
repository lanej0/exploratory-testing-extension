const chrome = {
  runtime: {
    getContexts: jest.fn(),
    onInstalled: {
      addListener: jest.fn(),
    },
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onConnect: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  offscreen: {
    createDocument: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    captureVisibleTab: jest.fn(),
  },
  action: {
    setIcon: jest.fn(),
  },
};

module.exports = chrome;
