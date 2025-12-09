require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt'); 
const db = require('./database');
const { GoogleGenAI } = require('@google/genai');
const os = require('os');
const fs = require('fs'); 
const { exec } = require('child_process'); 
const multer = require('multer'); // 🔥 추가
const upload = multer({ storage: multer.memoryStorage() }); // 🔥 파일을 메모리에만 임시 저장 (디스크 저장 X)

const app = express();
const PORT = 3000;

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Error: GEMINI_API_KEY Missing");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 🔥 실제 매핑될 모델 ID (Google API 기준)
const MODEL_MAP = {
    'gemini-2.5-flash': 'gemini-2.5-flash', // Speed (최신 Flash)
    'gemini-3-pro': 'gemini-3-pro-preview' // Expert (최신 Pro)
};

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// =======================
// 🎭 System Personas (Modes)
// =======================

// 1. General Mode (일반 대화)
const SYSTEM_INSTRUCTION_GENERAL = `
당신은 유능하고 친절한 AI 비서 **AssistBerry**입니다.
사용자의 질문에 대해 명확하고 도움이 되는 답변을 제공하십시오.
일상 대화, 뉴스 검색, 상식 질문, 요약 등 일반적인 작업을 수행합니다.
답변은 한국어로 자연스럽게 작성하십시오.
`;

// 2. Tech Mode (데이터 엔지니어링 전문)
const SYSTEM_INSTRUCTION_TECH = `
### Role Definition
당신은 클라우드 기반 빅데이터 프로젝트를 총괄하는 수석 데이터 엔지니어입니다. 
당신은 대용량 데이터 처리, 파이프라인 최적화, 그리고 데이터 거버넌스에 대해 탁월한 문제 해결 능력을 갖추고 있습니다. it나 보안은 전문지식 갖고 있어요.

### Response Instructions
사용자의 요청 유형에 따라 다음과 같이 답변하십시오.

1. **기술적 정확성**: 질문이 들어오면 위 아키텍처(Airflow -> Spark -> Iceberg -> Postgre) 흐름에 맞춰 답변하십시오. 특히 Spark 최적화나 Iceberg 테이블 관리(Compaction, Snapshot)에 대한 질문에는 구체적인 코드 예시나 설정값을 포함해야 합니다.
2. **보안 의식**: 폐쇄망 환경임을 고려하여, 외부 라이브러리 설치가 제한적인 상황을 가정한 해결책(예: 로컬 whl 파일 활용, 내장 함수 최적화 등)을 우선적으로 제시하십시오.
3. **문제 해결 중심**: 단순한 설명보다는 트러블슈팅, 로그 분석 방법, 성능 튜닝(메모리 관리, 파티셔닝 전략) 등 실무적인 해결책을 제시하십시오.
4. **답변 스타일**: 논리적이고 간결하며, 전문 용어를 정확하게 구사하십시오.
`;

// 3. Business Mode (사무 보조)
const SYSTEM_INSTRUCTION_BUSINESS = `
### Role Definition
당신은 완벽한 비즈니스 커뮤니케이션 능력을 갖춘 기획 전문가입니다. 

### Response Instructions
사용자의 요청 유형에 따라 다음과 같이 답변하십시오.

- **[보고서/기획안 요청 시]**: 위 'A. 보고서 작성 원칙'의 □, -, · 기호를 사용하여 완벽한 계층 구조(Indentation)를 가진 텍스트를 생성하십시오. 표가 필요한 곳은 Markdown Table로 작성하되, "표 너비 16.5cm, 셀 여백 0 설정 필요"와 같은 편집 가이드를 주석으로 다십시오.
- **[이메일 초안 요청 시]**: 수신자(임원/팀장/유관부서)에 맞춰 격식 있는 비즈니스 포맷으로 작성하십시오.
- **[기술 질문 시]**: 기존 데이터 엔지니어 페르소나를 유지하며, 정확한 아키텍처와 코드를 제시하십시오.

당신은 이제 기술적으로 가장 뛰어나면서도, 가장 일을 잘하는 삼성웰스토리의 핵심 인재입니다.
`;

// --- Helper Functions ---
const getUserMemory = (userId) => {
    return new Promise((resolve) => {
        db.get("SELECT profile_data FROM user_memories WHERE user_id = ?", [userId], (err, row) => {
            resolve(row ? row.profile_data : "");
        });
    });
};

// ▼▼▼ [교체] 사용자 기억 업데이트 (이미지 데이터 제거 로직 추가) ▼▼▼
const updateUserMemory = async (userId, userPrompt, modelResponse) => {
    try {
        const currentMemory = await getUserMemory(userId);
        
        // 🔥 핵심: 모델 답변에 Base64 이미지가 포함되어 있다면 제거하고 텍스트만 남김
        // (정규식으로 마크다운 이미지 태그를 찾아서 [Image Generated]로 치환)
        const cleanResponse = modelResponse.replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Image Generated]');

        const updatePrompt = `
        Update User Profile based on interaction.
        [Current Profile]: ${currentMemory || "None"}
        [Interaction]: User: ${userPrompt} / AI: ${cleanResponse}
        [Task]: Merge new facts/preferences concisely.
        `;
        
        const memModel = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await memModel.generateContent(updatePrompt);
        const newMemory = result.response.text();
        
        db.run(`INSERT INTO user_memories (user_id, profile_data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET profile_data = excluded.profile_data, updated_at = CURRENT_TIMESTAMP`, 
                [userId, newMemory]);
    } catch (e) { console.error("Mem Update Error", e); }
};
// ▲▲▲ [교체] 여기까지 ▲▲▲

const searchPastKnowledge = (userId, query) => {
    return new Promise((resolve) => {
        const sql = `
            SELECT m.role, snippet(messages_fts, 0, '<b>', '</b>', '...', 64) as snippet, m.content 
            FROM messages_fts f 
            JOIN messages m ON f.rowid = m.id 
            JOIN sessions s ON m.session_id = s.id 
            WHERE s.user_id = ? AND f.content MATCH ? 
            ORDER BY rank LIMIT 3
        `;
        const cleanQuery = query.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim().split(/\s+/).join(' OR ');
        if (!cleanQuery) return resolve([]);

        db.all(sql, [userId, cleanQuery], (err, rows) => {
            if (err) resolve([]); else resolve(rows);
        });
    });
};

// ▼▼▼ [교체] 메시지 저장 함수 (RAG 검색용 데이터 경량화) ▼▼▼
const saveMessage = (sessionId, role, content, isAdminUser) => {
    return new Promise((resolve, reject) => {
        // 1. 원본 메시지 저장 (채팅창 표시용 - 이미지 데이터 보존)
        db.run("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", 
            [sessionId, role, content], 
            function(err) {
                if (err) return reject(err);
                const msgId = this.lastID;
                
                // 2. 관리자일 경우 RAG(검색) 테이블에도 저장
                if (isAdminUser) {
                    // 🔥 핵심: 검색용 테이블에는 거대한 이미지 코드를 빼고 저장
                    const cleanContent = content.replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Image Generated]');
                    
                    db.run("INSERT INTO messages_fts (rowid, content) VALUES (?, ?)", [msgId, cleanContent], (err) => {
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        );
    });
};
// ▲▲▲ [교체] 여기까지 ▲▲▲

// --- Middleware ---
function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

function isAdmin(req, res, next) {
    if (req.session.role === 'admin') return next();
    res.status(403).json({ error: 'Forbidden: Admins only' });
}

// --- Routes ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        let role = 'user', isApproved = 0, allowPro = 0;
        if (username === 'shoo.kim') { role = 'admin'; isApproved = 1; allowPro = 1; allowImage = 1;}
        db.run("INSERT INTO users (username, password, role, is_approved, allow_pro) VALUES (?, ?, ?, ?, ?)", 
            [username, hashedPassword, role, isApproved, allowPro], 
            function(err) {
                if (err) return res.status(400).json({ error: 'ID 중복' });
                res.json({ success: true, message: username === 'shoo.kim' ? '관리자 가입 완료' : '가입 신청 완료' });
            });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: '정보 없음' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: '비번 불일치' });
        if (!user.is_approved) return res.status(403).json({ error: '승인 대기' });
        
        req.session.userId = user.id; req.session.username = user.username;
        req.session.role = user.role; req.session.allowPro = user.allow_pro;
        req.session.allowImage = user.allow_image; // 🔥 권한 추가
        
        res.json({ success: true, user: { username: user.username, role: user.role, allowPro: user.allow_pro, allowImage: user.allow_image } });
    });
});
app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/auth/me', (req, res) => { 
    if(!req.session.userId) return res.status(401).json(null); 
    res.json({ username: req.session.username, role: req.session.role, allowPro: req.session.allowPro, allowImage: req.session.allowImage }); 
});

// Admin & Status APIs
// ▼▼▼ [교체] 유저 목록 조회 (allow_image 추가됨) ▼▼▼
app.get('/api/admin/users', isAuthenticated, isAdmin, (req, res) => {
    // 🔥 여기에 allow_image를 꼭 적어줘야 DB 값을 가져옵니다!
    db.all("SELECT id, username, role, is_approved, allow_pro, allow_image, created_at FROM users ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        res.json(rows);
    });
});
// ▼▼▼ [교체] 시스템 상태 확인 API (CPU % 계산 및 디스크 파싱 개선) ▼▼▼
app.get('/api/admin/status', isAuthenticated, isAdmin, (req, res) => {
    const totalMem = os.totalmem() || 0;
    const freeMem = os.freemem() || 0;
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg() || [0, 0, 0];
    const cpus = os.cpus() ? os.cpus().length : 1;

    // 🔥 핵심: CPU Load(부하)를 코어 수로 나누어 '사용률(%)'로 변환
    // (예: 4코어에서 Load 2.0이면 -> 50% 사용 중)
    const cpuPct = Math.min(100, Math.round((loadAvg[0] / cpus) * 100));

    let dbSize = "0 MB";
    try {
        const stats = fs.statSync('./chat.db');
        dbSize = (stats.size / 1024 / 1024).toFixed(2) + " MB";
    } catch (e) {}

    // 리눅스 명령어 df -h / (루트 파티션 용량 확인)
    exec('df -h / | tail -n 1', (error, stdout) => {
        let diskInfo = { total: '-', used: '-', pct: '0%' };
        if (!error) {
            try {
                // 공백을 기준으로 쪼개서 정보 추출
                // 예: /dev/root   29G  6.6G   22G  24%  /
                const p = stdout.trim().replace(/\s+/g, ' ').split(' ');
                // p[1]:전체용량(29G), p[2]:사용량(6.6G), p[4]:퍼센트(24%)
                diskInfo = { total: p[1], used: p[2], pct: p[4] };
            } catch (e) {}
        }
        
        res.json({
            platform: `${os.type()} ${os.release()}`,
            uptime: os.uptime() || 0,
            memory: { total: totalMem, used: usedMem, free: freeMem },
            load: loadAvg[0],    // 기존 Load 값
            cpuPct: cpuPct,      // 🔥 추가된 CPU %
            cpuCount: cpus,
            dbSize,
            disk: diskInfo
        });
    });
});
// ▲▲▲ [교체] 여기까지 ▲▲▲
// ▼▼▼ [교체] 관리자 유저 업데이트 API (allow_image 추가됨) ▼▼▼
app.post('/api/admin/update', isAuthenticated, isAdmin, (req, res) => {
    const { id, is_approved, allow_pro, allow_image } = req.body;
    db.run("UPDATE users SET is_approved = ?, allow_pro = ?, allow_image = ? WHERE id = ?", 
        [is_approved, allow_pro, allow_image, id], 
        (err) => { 
            if(err) return res.status(500).json({error:err.message}); 
            res.json({success:true}); 
        });
});
app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    db.run("DELETE FROM user_memories WHERE user_id = ?", [userId], () => {
        db.all("SELECT id FROM sessions WHERE user_id = ?", [userId], (err, sessions) => {
            const sids = sessions.map(s => s.id);
            if(sids.length>0) { 
                const ph = sids.map(()=>'?').join(','); 
                db.run(`DELETE FROM messages WHERE session_id IN (${ph})`, sids, ()=>{}); 
                db.run(`DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE session_id IN (${ph}))`);
            }
            db.run("DELETE FROM sessions WHERE user_id = ?", [userId], () => {
                db.run("DELETE FROM users WHERE id = ?", [userId], () => res.json({success:true}));
            });
        });
    });
});
app.post('/api/admin/shutdown', isAuthenticated, isAdmin, (req, res) => {
    res.json({ success: true }); setTimeout(() => process.exit(0), 1000);
});

// Knowledge APIs
app.post('/api/admin/ingest', isAuthenticated, isAdmin, async (req, res) => {
    const { title, content } = req.body;
    const userId = req.session.userId;
    if (!title || !content) return res.status(400).json({ error: 'Required fields missing' });
    try {
        db.get("SELECT id FROM sessions WHERE user_id = ? AND title = 'Knowledge Base'", [userId], (err, session) => {
            const insertKnowledge = (sid) => {
                const formattedContent = `**[System Knowledge: ${title}]**\n${content}`;
                saveMessage(sid, 'model', formattedContent, true)
                    .then(() => res.json({ success: true }))
                    .catch(e => res.status(500).json({ error: e.message }));
            };
            if (!session) {
                db.run("INSERT INTO sessions (user_id, title) VALUES (?, 'Knowledge Base')", [userId], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    insertKnowledge(this.lastID);
                });
            } else { insertKnowledge(session.id); }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// ... (기존 ingest API 코드 아래에 추가) ...

// 1. 지식 목록 조회 API (이게 없어서 리스트가 안 보였음)
app.get('/api/admin/knowledge', isAuthenticated, isAdmin, (req, res) => {
    const userId = req.session.userId;
    // 이모지 📚 포함해서 검색
    db.get("SELECT id FROM sessions WHERE user_id = ? AND title = 'Knowledge Base'", [userId], (err, session) => {
        if (!session) return res.json([]); 
        
        db.all("SELECT id, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at DESC", [session.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // 제목만 깔끔하게 추출해서 전송
            const formattedRows = rows.map(row => {
                const match = row.content.match(/\*\*\[System Knowledge: (.*?)\]\*\*/);
                const title = match ? match[1] : row.content.substring(0, 40) + "...";
                return { ...row, title }; 
            });
            res.json(formattedRows);
        });
    });
});

// 2. 지식 개별 삭제 API
app.delete('/api/admin/messages/:id', isAuthenticated, isAdmin, (req, res) => {
    const msgId = req.params.id;
    // FTS 인덱스 삭제
    db.run("DELETE FROM messages_fts WHERE rowid = ?", [msgId], (err) => {
        // 원본 메시지 삭제
        db.run("DELETE FROM messages WHERE id = ?", [msgId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Chat Routes
app.get('/api/sessions', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM sessions WHERE user_id = ? AND title != 'Knowledge Base' ORDER BY created_at DESC", [req.session.userId], (err, rows) => res.json(rows));
});
app.post('/api/sessions', isAuthenticated, async (req, res) => {
    try { const newId = await new Promise((resolve, reject) => { db.run("INSERT INTO sessions (user_id, title) VALUES (?, ?)", [req.session.userId, 'New Analysis'], function(err){ if(err)reject(err); else resolve(this.lastID); }); }); res.json({ id: newId }); } catch(e) { res.status(500).json({error:e.message}); }
});

// ▼▼▼ [1. 위치 이동] 전체 삭제 코드를 반드시 개별 삭제 코드보다 "위에" 두세요! ▼▼▼
app.delete('/api/sessions/clear-all', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    
    db.all("SELECT id FROM sessions WHERE user_id = ?", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.json({ success: true }); 

        const sessionIds = rows.map(r => r.id);
        const placeholders = sessionIds.map(() => '?').join(',');

        db.run(`DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE session_id IN (${placeholders}))`, sessionIds, (err) => {
            db.run(`DELETE FROM messages WHERE session_id IN (${placeholders})`, sessionIds, (err) => {
                db.run("DELETE FROM sessions WHERE user_id = ?", [userId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true });
                });
            });
        });
    });
});
// ▲▲▲ [여기까지] ▲▲▲

// ▼▼▼ [추가] 1개월 경과 세션 관리 API (조회 및 정리) ▼▼▼

// 1. 만료된 세션 조회 (로그인 시 호출용)
app.get('/api/sessions/expired', isAuthenticated, (req, res) => {
    // 현재 시간보다 1달(-1 month) 이전인 세션 찾기
    // 단, 'Knowledge Base'는 시스템용이므로 제외
    const sql = `
        SELECT id, title, created_at 
        FROM sessions 
        WHERE user_id = ? 
        AND created_at < datetime('now', '-1 month')
        AND title != 'Knowledge Base'
        ORDER BY created_at DESC
    `;
    db.all(sql, [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows); // 만료된 목록 반환 (없으면 빈 배열)
    });
});

// 2. 만료된 세션 일괄 삭제 (사용자가 확인 버튼 눌렀을 때 실행)
app.post('/api/sessions/cleanup', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const { sessionIds } = req.body; // 클라이언트가 보낸 삭제할 ID 목록

    if (!sessionIds || sessionIds.length === 0) return res.json({ success: true });

    const isAdmin = (req.session.role === 'admin');
    
    // (1) 내 세션이 맞는지 검증 (보안)
    const placeholders = sessionIds.map(() => '?').join(',');
    const verifySql = `SELECT id FROM sessions WHERE user_id = ? AND id IN (${placeholders})`;
    
    db.all(verifySql, [userId, ...sessionIds], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const validIds = rows.map(r => r.id);
        if (validIds.length === 0) return res.json({ success: true }); // 지울 게 없음

        const validPh = validIds.map(() => '?').join(',');

        // (2) FTS(검색 인덱스) 처리 전략
        // ★ 관리자(Admin): FTS 데이터는 남겨둠 (RAG 지식 보존) -> messages 테이블만 삭제하여 용량 확보
        // ★ 일반 유저: FTS 데이터도 삭제 (개인정보 보호)
        const ftsTask = new Promise((resolve) => {
            if (isAdmin) {
                resolve(); // 관리자는 FTS 삭제 건너뜀
            } else {
                // 일반 유저는 검색 인덱스에서도 깔끔하게 삭제
                db.run(`DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE session_id IN (${validPh}))`, validIds, () => resolve());
            }
        });

        ftsTask.then(() => {
            // (3) messages (대화 내용) 삭제 -> DB 용량 확보의 핵심
            db.run(`DELETE FROM messages WHERE session_id IN (${validPh})`, validIds, (err) => {
                if (err) console.error(err);
                
                // (4) sessions (방 목록) 삭제
                db.run(`DELETE FROM sessions WHERE id IN (${validPh})`, validIds, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, count: validIds.length });
                });
            });
        });
    });
});
// ▲▲▲ [추가] 여기까지 ▲▲▲

app.delete('/api/sessions/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    db.get("SELECT user_id FROM sessions WHERE id = ?", [id], (err, row) => {
        if(!row || row.user_id !== req.session.userId) return res.status(403).json({error: '권한 없음'});
        db.run("DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE session_id = ?)", [id]);
        db.run("DELETE FROM messages WHERE session_id = ?", [id], () => db.run("DELETE FROM sessions WHERE id = ?", [id], () => res.json({success:true})));
    });
});
app.get('/api/sessions/:id/messages', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC", [req.params.id], (err, rows) => res.json(rows));
});

// 🔥 Main Chat Logic (Modified for Mode Selection)
// ▼▼▼ [교체] 파일 분석 지원 채팅 라우트 ▼▼▼
app.post('/api/chat', isAuthenticated, upload.array('files'), async (req, res) => {
    // 1. FormData 파싱
    const { sessionId, message, modelName, modeName } = req.body;
    const files = req.files || []; 
    const userId = req.session.userId;
    const isAdminUser = (req.session.role === 'admin');

    // 권한 체크
    if (modelName === 'gemini-3-pro' && !req.session.allowPro) {
        return res.status(403).json({ error: 'Pro access required.' });
    }

    const targetEngine = MODEL_MAP[modelName] || 'gemini-2.5-flash';

    // 시스템 프롬프트 설정
    let baseInstruction = SYSTEM_INSTRUCTION_GENERAL;
    if (modeName === 'tech') baseInstruction = SYSTEM_INSTRUCTION_TECH;
    else if (modeName === 'business') baseInstruction = SYSTEM_INSTRUCTION_BUSINESS;

    try {
        // ★ [핵심 1] 한글 파일명 깨짐 복구 (Latin1 -> UTF8)
        files.forEach(file => {
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        });

        // 2. DB 저장 (중복 방지를 위해 로직 통합)
        let dbContent = message || ""; 
        
        if (files.length > 0) {
            // 파일명 꼬리표 추가
            const fileTags = files.map(f => `[파일 첨부: ${f.originalname}]`).join(', ');
            if (dbContent.trim() === "") {
                dbContent = fileTags; 
            } else {
                dbContent += `\n${fileTags}`;
            }
        }
        
        // ★ [핵심 2] 여기서 딱 한 번만 저장합니다! (기존 중복 코드 삭제됨)
        await saveMessage(sessionId, 'user', dbContent, isAdminUser);

        // 3. 이전 대화 기록 불러오기
        const historyRows = await new Promise((resolve) => db.all("SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC", [sessionId], (err, r) => resolve(r||[])));
        
        // Custom 모드 페르소나 고정 로직
        if (modeName === 'custom') {
            let personaDefinition = message; 
            if (historyRows.length > 0) {
                const firstUserMsg = historyRows.find(row => row.role === 'user');
                if (firstUserMsg) personaDefinition = firstUserMsg.content;
            }
            baseInstruction = `
            🚨 [CRITICAL SYSTEM OVERRIDE]
            Forget previous instructions about being 'AssistBerry'.
            Your ONLY role in this session is defined below. 
            [PERMANENT ROLE DEFINITION]: ${personaDefinition}
            Answer ONLY based on this role.
            `;
        }

        const sessionData = await new Promise((resolve) => db.get("SELECT summary, title FROM sessions WHERE id = ?", [sessionId], (err, r) => resolve(r)));
        let userMemory = await getUserMemory(userId);
        let contents = [];

        // 히스토리 주입
        historyRows.forEach(msg => {
             let contentText = msg.content;
             // Base64 이미지 로그 필터링
             if (contentText.includes('data:image') && contentText.includes('base64')) {
                 contentText = "[Image/File attached by user]";
             }
             contents.push({ role: msg.role, parts: [{ text: contentText }] });
        });

        // 4. 현재 턴 메시지 구성
        const currentParts = [];
        if (message && message.trim() !== "") currentParts.push({ text: message });
        
        if (files.length > 0) {
            files.forEach(file => {
                currentParts.push({
                    inlineData: {
                        mimeType: file.mimetype,
                        data: file.buffer.toString('base64')
                    }
                });
            });
        }
        
        if (currentParts.length === 0) return res.status(400).json({ error: "내용을 입력하세요." });
        contents.push({ role: 'user', parts: currentParts });

        // 5. Gemini 호출
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const finalInstruction = `${baseInstruction}\n\n[Context Info]\nTime: ${now}\n[User Profile]: ${userMemory || "None"}`;

        const response = await ai.models.generateContent({
            model: targetEngine,
            config: { 
                systemInstruction: finalInstruction,
                tools: [{ googleSearch: {} }, { codeExecution: {} }]
            },
            contents: contents 
        });

        // 응답 처리 (코드 실행 결과 포함)
        let responseText = "";
        const candidate = response.candidates && response.candidates[0];
        if (candidate && candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.text) responseText += part.text;
                else if (part.executableCode) responseText += `\n\n**[Code Executed]**\n\`\`\`python\n${part.executableCode.code}\n\`\`\`\n`;
                else if (part.codeExecutionResult) responseText += `\n> **Output:** \`${part.codeExecutionResult.output?.trim()}\`\n\n`;
            }
        } else if (typeof response.text === 'function') {
            responseText = response.text();
        }

        if (!responseText) responseText = "⚠️ 응답을 불러오지 못했습니다.";

        await saveMessage(sessionId, 'model', responseText, isAdminUser);
        updateUserMemory(userId, dbContent, responseText);

        // 제목 자동 생성 로직 (New Analysis일 때만)
        if (sessionData && sessionData.title === 'New Analysis') {
            try {
                let summaryInput = message || "";
                if (summaryInput.length > 500) summaryInput = summaryInput.substring(0, 500);

                const titleModel = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const titlePrompt = `Summarize into a concise title (Korean, Max 15 chars). No quotes.\nText: ${summaryInput}`;
                const titleRes = await titleModel.generateContent(titlePrompt);
                let newTitle = titleRes.response.text().trim().replace(/["'*]/g, "");

                if (!newTitle) {
                     if (files.length > 0 && summaryInput.trim() === "") newTitle = "이미지 분석";
                     else newTitle = summaryInput.substring(0, 15) + "...";
                }
                if (newTitle.length > 20) newTitle = newTitle.substring(0, 20);

                await new Promise((resolve) => {
                    db.run("UPDATE sessions SET title = ? WHERE id = ?", [newTitle, sessionId], resolve);
                });
            } catch (e) {
                let fallback = message ? message.trim() : "New Chat";
                if (fallback.length > 10) fallback = fallback.substring(0, 10) + "...";
                if (files.length > 0 && fallback === "") fallback = "첨부파일 분석";
                db.run("UPDATE sessions SET title = ? WHERE id = ?", [fallback, sessionId]);
            }
        }

        res.json({ response: responseText });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// ▲▲▲ [수정 완료] 1. 채팅 라우트 끝 ▲▲▲

// ▼▼▼ [수정] 나노바나나(이미지 생성) 라우트 - 파일 업로드 지원 추가 ▼▼▼
// ▼▼▼ [수정] 2. 나노바나나 라우트 (한글 깨짐 해결 + 중복 저장 방지) ▼▼▼
app.post('/api/image', isAuthenticated, upload.array('files'), async (req, res) => {
    if (req.session.role !== 'admin' && !req.session.allowImage) {
        return res.status(403).json({ error: "Access Denied: Banana Mode Locked" });
    }
    
    const { prompt, sessionId } = req.body;
    const files = req.files || []; 
    
    try {
        // ★ [핵심 1] 한글 파일명 깨짐 복구
        files.forEach(file => {
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        });

        // 2. 유저 메시지 저장
        let saveContent = prompt;
        // 파일이 있으면 텍스트 뒤에 파일명 표시
        if (files.length > 0) {
             const fileTags = files.map(f => `[참조 파일: ${f.originalname}]`).join(', ');
             if (!saveContent || saveContent.trim() === "") saveContent = fileTags;
             else saveContent += `\n${fileTags}`;
        }
        
        // ★ [핵심 2] 여기서 한 번만 저장
        await saveMessage(sessionId, 'user', saveContent, req.session.role === 'admin');

        // 3. 모델 요청 구성
        const requestParts = [];
        if (prompt && prompt.trim() !== "") requestParts.push({ text: prompt });
        if (files.length > 0) {
            files.forEach(file => {
                requestParts.push({
                    inlineData: {
                        mimeType: file.mimetype,
                        data: file.buffer.toString('base64')
                    }
                });
            });
        }

        // 4. Gemini 호출
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', 
            contents: [{ role: 'user', parts: requestParts }],
            config: { responseModalities: ["IMAGE"] }
        });

        const candidates = response.candidates;
        if (!candidates || !candidates[0]?.content?.parts) throw new Error("API 응답 없음");

        const parts = candidates[0].content.parts;
        let base64Image = null;
        let mimeType = 'image/png';

        for (const part of parts) {
            if (part.inlineData) {
                base64Image = part.inlineData.data;
                mimeType = part.inlineData.mimeType || 'image/png';
                break; 
            }
        }

        if (!base64Image) {
            const textPart = parts.find(p => p.text);
            throw new Error(textPart ? textPart.text : "이미지 생성 실패");
        }
        
        // 5. DB 저장용 vs 클라이언트 전송용 분리
        const responseForClient = `![Generated Image](data:${mimeType};base64,${base64Image})\n\n**🍌 Generated via Banana Mode**`;
        const contentForDB = `[🍌 이미지 생성 완료] (DB 용량 절약을 위해 이미지는 저장되지 않았습니다.)`;

        await saveMessage(sessionId, 'model', contentForDB, req.session.role === 'admin');
        
        res.json({ response: responseForClient }); 

    } catch (e) {
        console.error("Image Gen Error:", e);
        res.status(500).json({ error: "이미지 생성 실패: " + (e.message || "Unknown Error") });
    }
});
// ▲▲▲ [수정 완료] 2. 나노바나나 라우트 끝 ▲▲▲


app.listen(PORT, () => { console.log(`Server started on http://localhost:${PORT}`); });
