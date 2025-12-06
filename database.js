const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath);

// 성능 최적화
db.run("PRAGMA auto_vacuum = FULL;");
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");

db.serialize(() => {
    // 1. 사용자
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        is_approved INTEGER DEFAULT 0,
        allow_pro INTEGER DEFAULT 0,
        allow_image INTEGER DEFAULT 0,  -- 여기 나노바나나 추가!
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. 세션
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT DEFAULT 'New Analysis',
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // 3. 메시지
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`);

    // 4. FTS 검색 테이블 (호환성 높은 일반 모드로 변경)
    // content='messages' 옵션을 제거하여 안정성 확보
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content)`);
    
    // 5. 사용자 메모리
    db.run(`CREATE TABLE IF NOT EXISTS user_memories (
        user_id INTEGER PRIMARY KEY,
        profile_data TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
});

module.exports = db;
