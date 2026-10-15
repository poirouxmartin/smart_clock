// Test double for expo-sqlite backed by a real in-memory SQLite (node:sqlite, Node >= 22.13).
// The previous stub returned undefined for every read, so write-then-read tests could never pass.
const { DatabaseSync } = require('node:sqlite');

// expo-sqlite binds undefined as NULL; node:sqlite rejects undefined.
const bind = (params = []) => params.map((p) => (p === undefined ? null : p));

class MockSQLiteDatabase {
  constructor(name) {
    this.name = name;
    this.native = new DatabaseSync(':memory:');
  }
  execSync(sql) {
    this.native.exec(sql);
  }
  runSync(sql, params) {
    return this.native.prepare(sql).run(...bind(params));
  }
  getFirstSync(sql, params) {
    return this.native.prepare(sql).get(...bind(params)) ?? null;
  }
  getAllSync(sql, params) {
    return this.native.prepare(sql).all(...bind(params));
  }
  closeSync() {
    this.native.close();
  }
}

module.exports = {
  openDatabaseSync: jest.fn((name) => new MockSQLiteDatabase(name)),
  enablePromise: jest.fn(),
  SQLiteDatabase: MockSQLiteDatabase,
};