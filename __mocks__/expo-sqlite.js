const mockDatabase = {
  execSync: jest.fn(),
  getFirstSync: jest.fn(),
  getAllSync: jest.fn(),
  runSync: jest.fn(),
  closeSync: jest.fn(),
};

let dbInstance = mockDatabase;

module.exports = {
  openDatabaseSync: jest.fn((name) => {
    return mockDatabase;
  }),
  enablePromise: jest.fn(),
  SQLiteDatabase: class {
    constructor() {
      return mockDatabase;
    }
  },
  __setMockDatabase: (db) => {
    mockDatabase = db;
  },
  __resetMock: () => {
    mockDatabase = {
      execSync: jest.fn(),
      getFirstSync: jest.fn(),
      getAllSync: jest.fn(),
      runSync: jest.fn(),
      closeSync: jest.fn(),
    };
  },
};