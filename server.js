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
    'gemini-3-pro': 'gemini-3-pro-preview'            // Expert (최신 Pro)
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
당신은 삼성웰스토리의 'SCP(Samsung Cloud Platform) 기반 데이터레이크 구축 프로젝트'를 총괄하는 수석 데이터 엔지니어입니다. 당신은 대용량 데이터 처리, 파이프라인 최적화, 그리고 데이터 거버넌스에 대해 탁월한 문제 해결 능력을 갖추고 있습니다. it나 보안은 기본으로 전문지식 갖고 있어요.

### Project Context & Architecture
현재 당신이 운영 중인 시스템의 아키텍처와 환경은 다음과 같습니다:

1. **인프라 환경**: SCP(Samsung Cloud Platform) 기반의 클라우드 환경이며, 보안을 위해 인터넷이 차단된 폐쇄망(Private Network)에서 운영됩니다.
2. **데이터 파이프라인 단계**:
   - **Source**: SAP ECC, 웰스토리몰(Oracle/MySQL), 유전체 데이터(NGS), 레거시 시스템 등 다양한 원천 데이터.
   - **Landing Zone**: 원천 데이터를 수집하여 Object Storage에 적재 (Hive 메타스토어 연동).
   - **L0 (정제)**: Iceberg 포맷으로 저장되며, 기본적인 파싱 및 정제가 완료된 데이터.
   - **L1 (가공)**: 비즈니스 로직에 따라 결합 및 가공된 데이터 (Iceberg 포맷).
   - **L2 (마트)**: 최종 분석 및 서비스 제공을 위한 요약 데이터 (PostgreSQL 및 고성능 쿼리 엔진 활용).
3. **핵심 기술 스택**:
   - **수집/처리**: Apache Spark (PySpark), Airflow (워크플로우 오케스트레이션).
   - **저장소**: SCP Object Storage, HDFS.
   - **쿼리 엔진**: Spark SQL, Kyuubi.
   - **거버넌스 및 보안**: Apache Ranger (접근 제어), Apache Atlas (데이터 카탈로그/리니지), Data Service Console.
   - **시각화/분석**: Tableau, Jupyter Notebook, Hue.

### Operational Scope
- **데이터 규모**: 약 86억 건 이상의 데이터를 마이그레이션 및 적재하여 관리 중입니다.
- **주요 목표**: 사일로(Silo)화된 데이터 통합, 수작업 리포트의 자동화(예: 전사 손익 현황, 웰스토리몰 KPI), 그리고 유전체 기반 맞춤형 건강 정보 서비스 지원.

### Instructions for Response
사용자의 질문에 답할 때는 다음 원칙을 엄격히 준수하십시오:

1. **기술적 정확성**: 질문이 들어오면 위 아키텍처(Airflow -> Spark -> Iceberg -> Postgre) 흐름에 맞춰 답변하십시오. 특히 Spark 최적화나 Iceberg 테이블 관리(Compaction, Snapshot)에 대한 질문에는 구체적인 코드 예시나 설정값을 포함해야 합니다.
2. **보안 의식**: 폐쇄망 환경임을 고려하여, 외부 라이브러리 설치가 제한적인 상황을 가정한 해결책(예: 로컬 whl 파일 활용, 내장 함수 최적화 등)을 우선적으로 제시하십시오.
3. **문제 해결 중심**: 단순한 설명보다는 트러블슈팅, 로그 분석 방법, 성능 튜닝(메모리 관리, 파티셔닝 전략) 등 실무적인 해결책을 제시하십시오.
4. **답변 스타일**: 논리적이고 간결하며, 전문 용어를 정확하게 구사하십시오.
`;

// 3. Business Mode (사무 보조)
const SYSTEM_INSTRUCTION_BUSINESS = `
### Role Definition
당신은 삼성웰스토리의 'SCP 기반 데이터레이크 구축 프로젝트'를 이끄는 수석 데이터 엔지니어이자, 완벽한 비즈니스 커뮤니케이션 능력을 갖춘 기획 전문가입니다. 당신은 기술적 난제(Spark, Iceberg, Airflow 등)를 해결하는 능력뿐만 아니라, 이를 경영진과 유관부서에 명확하고 세련된 비즈니스 언어로 전달하는 데 탁월합니다.

### 1. Work Context & Technical Scope
- **프로젝트**: SCP(Samsung Cloud Platform) 기반 데이터레이크 구축 (폐쇄망 환경).
- **데이터 흐름**: Source -> Landing -> L0(Iceberg) -> L1 -> L2(Mart/Postgre).
- **핵심 기술**: Airflow, Spark(PySpark), Kyuubi, Ranger, Atlas.
- **업무 목표**: 사일로 데이터 통합, 86억 건 데이터 처리 최적화, 수작업 리포트 자동화.

### 2. Business Communication Standards (Strict Adherence)
당신이 작성하는 모든 문서(보고서, 기획안)와 커뮤니케이션(이메일, 메신저)은 아래의 **'삼성웰스토리 표준 문서 작성 규칙'**을 엄격히 따릅니다.

#### A. 보고서/기획안 작성 원칙 (Word Report Standard)
1. **개조식 서술 구조 (Hierarchy)**:
   - **□ (큰 제목/핵심 요약)**: 문단은 반드시 네모(□)로 시작. 내용은 1~2줄 내외의 핵심 메시지로 요약하여 서술형으로 작성. (3줄 초과 금지)
   - **- (부연 설명)**: 네모 아래에는 바(-)를 사용하여 2~3줄 정도의 상세 내용을 서술. 들여쓰기는 위 텍스트 라인에 맞춤.
   - **· (추가 정보)**: 필요 시 점(·)을 사용하여 세부 근거 제시.
2. **텍스트 및 포맷 규칙**:
   - **폰트**: 제목 20pt, 본문 14pt, 표 12pt, 주석 9pt (기본 맑은고딕/바탕체 계열 준수).
   - **강조**: 괄호는 【 】(두꺼운 괄호)를 사용하며, 왼쪽 들여쓰기 -0.5글자로 라인을 맞춤.
   - **자동 고침 금지**: 둥근 따옴표(‘’) 대신 곧은 따옴표('') 사용. 한글/영문/숫자 간 자동 간격 조정을 하지 않음.
3. **표(Table) 작성 가이드**:
   - **위치**: '□' 항목 바로 아래에 근거 데이터 제시용으로 배치.
   - **스타일**: 너비 16.5cm, 왼쪽 들여쓰기 0.5cm. 셀 여백 0cm.
   - **선**: 위/아래는 굵은 줄(1.5pt), 중간은 일반 줄(0.5pt), 좌우 선 없음.
   - **내용 정렬**: 텍스트는 줄 간격 1줄, 문단 앞/뒤 간격 0pt로 하여 셀 위아래 쏠림 방지. 숫자는 우측 정렬 후 들여쓰기.

#### B. 이메일 및 메신저 소통 원칙
1. **이메일 (Formal)**:
   - **구조**: [인사] -> [결론(BLUF, 두괄식)] -> [상세 배경 및 데이터 근거] -> [향후 계획/요청사항] -> [맺음말].
   - **톤앤매너**: 정중하되 군더더기 없는 문체. 기술 용어는 비전공자도 이해 가능한 비즈니스 용어로 순화하거나 괄호로 설명.
2. **메신저 (Agile)**:
   - **스타일**: 핵심만 간결하게 전달. 긴 내용은 요약 후 "상세 내용은 메일로 송부드렸습니다"로 처리.
   - **대응**: 트러블슈팅 상황 보고 시 "현재 현황 -> 원인(추정) -> 조치 계획 -> 예상 완료 시간" 순으로 즉시 보고.

### 3. Response Instructions
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
    // 1. FormData 파싱 (multer가 처리 후 req.body/req.files에 담음)
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
        // 2. DB 저장 (파일 내용은 저장하지 않음)
        // 텍스트 없이 파일만 보냈을 경우 DB에는 "(파일 첨부)"라고 기록
        let dbContent = message;
        if ((!message || message.trim() === "") && files.length > 0) {
            dbContent = "(파일 첨부)";
        }
        
        await saveMessage(sessionId, 'user', dbContent, isAdminUser);

        // 3. 이전 대화 기록 불러오기 (기존 로직 유지)
        const historyRows = await new Promise((resolve) => db.all("SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC", [sessionId], (err, r) => resolve(r||[])));
        const sessionData = await new Promise((resolve) => db.get("SELECT summary, title FROM sessions WHERE id = ?", [sessionId], (err, r) => resolve(r)));
        let userMemory = await getUserMemory(userId);
        let contents = [];
        let currentSummary = sessionData?.summary || "";

        // ... (기존 요약/히스토리 처리 로직은 그대로 사용) ...
        // 간소화를 위해 핵심인 컨텍스트 조립 부분만 보여드립니다.
        // 기존 코드의 historyRows 처리 부분을 그대로 두셔도 무방합니다.
        
        // 히스토리 주입
        historyRows.forEach(msg => {
             // DB에 저장된 예전 이미지 로그 필터링
             let contentText = msg.content;
             if (contentText.includes('data:image') && contentText.includes('base64')) {
                 contentText = "[Image/File attached by user]";
             }
             contents.push({ role: msg.role, parts: [{ text: contentText }] });
        });

        // 4. [핵심] 현재 턴 메시지 구성 (멀티모달)
        const currentParts = [];
        
        // (A) 텍스트 추가
        if (message && message.trim() !== "") {
            currentParts.push({ text: message });
        }

        // (B) 파일 추가 (Base64 변환)
        if (files.length > 0) {
            files.forEach(file => {
                currentParts.push({
                    inlineData: {
                        mimeType: file.mimetype,
                        data: file.buffer.toString('base64') // 메모리 버퍼 -> Base64
                    }
                });
            });
        }
        
        if (currentParts.length === 0) return res.status(400).json({ error: "내용을 입력하세요." });

        contents.push({ role: 'user', parts: currentParts });

        // ... (위쪽 코드는 유지) ...

        // 5. Gemini 호출
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const finalInstruction = `${baseInstruction}\n\n[Context Info]\nTime: ${now}\n[User Profile]: ${userMemory || "None"}`;

        const response = await ai.models.generateContent({
            model: targetEngine,
            config: { systemInstruction: finalInstruction },
            contents: contents 
        });

        // ▼▼▼ [수정] 응답 텍스트 추출 방식 변경 (오류 해결 핵심) ▼▼▼
        let responseText = "";
        
        // SDK 버전에 따라 응답 구조가 다를 수 있으므로 안전하게 추출
        if (typeof response.text === 'function') {
            responseText = response.text();
        } else if (response.candidates && response.candidates.length > 0) {
            // candidates 배열에서 직접 텍스트 추출
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                responseText = candidate.content.parts.map(part => part.text || "").join("");
            }
        } 
        
        // 만약 텍스트가 여전히 비어있다면 (안전 필터 등으로 인해)
        if (!responseText) {
            responseText = "⚠️ AI가 응답을 생성하지 못했습니다. (보안 정책 또는 이미지 인식 오류)";
            console.log("Raw Response:", JSON.stringify(response, null, 2)); // 디버깅용 로그
        }
        // ▲▲▲ [수정 완료] ▲▲▲

        await saveMessage(sessionId, 'model', responseText, isAdminUser);
        updateUserMemory(userId, dbContent, responseText);

        // ▼▼▼ [수정] 제목 자동 생성 로직 (조건 수정 및 동기화 처리) ▼▼▼
        // historyRows.length === 1 : 방금 저장한 내 메시지 1개만 있다는 뜻 (즉, 첫 대화)
        if (historyRows.length <= 1) {
            try {
                // 1. 제목 생성용 프롬프트 (가벼운 Flash 모델 사용)
                // ★ await를 사용하여 제목이 생성되고 DB에 저장될 때까지 기다립니다.
                const titleModel = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const titlePrompt = `
                Summarize the following text into a concise title for a chat history list.
                Language: Korean.
                Max Length: 15 characters.
                No quotes, no markdown.
                
                Text: ${message}
                `;
                
                const titleRes = await titleModel.generateContent(titlePrompt);
                let newTitle = titleRes.response.text().trim();
                
                // 특수문자 제거 및 길이 제한
                newTitle = newTitle.replace(/["'*]/g, "").substring(0, 20);
                
                // 2. DB 업데이트 (Promise로 감싸서 확실히 끝난 뒤 진행)
                await new Promise((resolve) => {
                    db.run("UPDATE sessions SET title = ? WHERE id = ?", [newTitle, sessionId], (err) => {
                        resolve();
                    });
                });
                
            } catch (e) {
                // 실패 시 fallback 처리
                let fallback = message.trim();
                if (files.length > 0 && fallback === "") fallback = "Image Analysis";
                if (fallback.length > 10) fallback = fallback.substring(0, 10) + "...";
                
                db.run("UPDATE sessions SET title = ? WHERE id = ?", [fallback, sessionId]);
            }
        }
        // ▲▲▲ [수정 완료] ▲▲▲

        res.json({ response: responseText });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// ▲▲▲ [교체 완료] ▲▲▲

// ▼▼▼ [수정] 나노바나나(이미지 생성) 라우트 - 파일 업로드 지원 추가 ▼▼▼
app.post('/api/image', isAuthenticated, upload.array('files'), async (req, res) => {
    // 1. 권한 체크
    if (req.session.role !== 'admin' && !req.session.allowImage) {
        return res.status(403).json({ error: "Access Denied: Banana Mode Locked" });
    }
    
    // FormData로 오기 때문에 req.body에서 텍스트 추출
    const { prompt, sessionId } = req.body;
    const files = req.files || []; // 업로드된 파일들
    
    try {
        // 2. 유저 메시지 저장 (파일이 있으면 '파일+텍스트'로 간주)
        let saveContent = prompt;
        if ((!prompt || prompt.trim() === "") && files.length > 0) {
            saveContent = "(참조 이미지 첨부)";
        }
        await saveMessage(sessionId, 'user', saveContent, req.session.role === 'admin');

        // 3. 모델에 보낼 콘텐츠 구성 (멀티모달)
        const requestParts = [];

        // (A) 텍스트 프롬프트
        if (prompt && prompt.trim() !== "") {
            requestParts.push({ text: prompt });
        }

        // (B) 첨부 파일 (이미지) -> Base64 변환
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

        // 4. Gemini 호출 (이미지 생성 모드)
        // 사용자가 지정한 모델명 사용 (gemini-3-pro-image-preview)
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', 
            contents: [{ 
                role: 'user', 
                parts: requestParts 
            }],
            config: {
                responseModalities: ["IMAGE"], // 이미지로 응답 요청
            }
        });

        // 5. 응답 데이터에서 이미지 추출
        const candidates = response.candidates;
        if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
            throw new Error("API 응답에 내용이 없습니다.");
        }

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
            const errorMsg = textPart ? textPart.text : "이미지 생성 실패 (정책 위반 또는 모델 오류)";
            throw new Error(errorMsg);
        }
        
        const imageMarkdown = `![Generated Image](data:${mimeType};base64,${base64Image})\n\n**🍌 Generated via Banana Mode (Gemini 3 Preview)**`;

        await saveMessage(sessionId, 'model', imageMarkdown, req.session.role === 'admin');
        res.json({ response: imageMarkdown });

    } catch (e) {
        console.error("Image Gen Error:", e);
        res.status(500).json({ error: "이미지 생성 실패: " + (e.message || "Unknown Error") });
    }
});
// ▲▲▲ [수정 완료] ▲▲▲


app.listen(PORT, () => { console.log(`Server started on http://localhost:${PORT}`); });