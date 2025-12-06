# 🍓 AssistBerry AI (Data Architect Assistant)

**AssistBerry AI**는 데이터 엔지니어링 및 비즈니스 업무 효율화를 위해 개발된 **사내 전용 올인원 AI 플랫폼**입니다.
Google Gemini Pro/Flash 및 Imagen 3(또는 DALL-E 3)를 기반으로 하며, 사내 인프라(SCP, Spark, Airflow) 트러블슈팅 지원 및 표준 보고서 작성 자동화 기능을 제공합니다.

![License](https://img.shields.io/badge/License-Private-red)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-green)
![Status](https://img.shields.io/badge/Status-Production-blue)

---

## ✨ 핵심 기능 (Key Features)

### 1. 🎭 멀티 페르소나 (Multi-Persona Modes)
- **General Mode**: 일상 대화 및 정보 검색.
- **Tech Mode**: SCP, Spark, Airflow, Iceberg 등 사내 데이터 플랫폼 기술 지원 (On-call 엔지니어 페르소나).
- **Biz Mode**: 삼성웰스토리 표준 문서 양식(개조식, 두괄식)에 맞춘 문서 초안 작성.

### 2. 🎨 NanoBanana Pro (Image Generation)
- **AI 이미지 생성**: 채팅창 입력란 상단의 **바나나(🍌) 버튼** 클릭 시 활성화.
- **고품질 모델**: Google Imagen 3 또는 OpenAI DALL-E 3 연동 지원.
- **기능**: 생성된 이미지 즉시 미리보기 및 원본 다운로드 지원.

### 3. 📝 업무 자동화 (Productivity)
- **Word(.docx) 레포트 생성**: AI 답변의 **[W]** 버튼 클릭 시, 사내 서식(맑은고딕 14pt, 표 스타일 등)이 적용된 워드 파일 자동 생성.
- **Slash Commands (`/`)**: 
  - `/sql`: 쿼리 튜닝 및 실행 계획 분석.
  - `/log`: 에러 로그 원인 및 해결책 분석.
  - `/report`: 주간 업무 보고서용 초안 작성.
  - `/fix`: 코드 버그 수정 및 리팩토링.
- **Streaming Response**: 타자 치듯 끊김 없는 실시간 답변 출력.

### 4. 🔐 관리 및 보안 (Admin & Security)
- **Admin Dashboard**: 서버 리소스(CPU, RAM, Disk) 모니터링, 사용자 승인/관리, 시스템 종료.
- **RAG (지식 주입)**: 관리자 패널을 통해 사내 기술 문서(Knowledge Base) 업로드 및 검색 증강 생성 적용.

---

## 🛠 기술 스택 (Tech Stack)

| 영역 | 기술 스택 |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism), Vanilla JS |
| **Backend** | Node.js, Express.js |
| **Database** | SQLite3 (FTS5 검색 엔진 포함) |
| **AI Models** | Gemini 2.5 Flash, Gemini 3 Pro, Imagen 3 / DALL-E 3 |
| **Infra** | Nginx (Reverse Proxy), PM2 (Process Manager), Let's Encrypt (SSL) |

---

## 🚀 로컬 설치 및 실행 (Local Installation)

### 1. 프로젝트 설정
```bash
# 저장소 복제 (생략 가능)
git clone <repository-url>

# 패키지 설치
npm install

2. 환경 변수 설정 (.env)
프로젝트 루트에 .env 파일을 생성하고 아래 내용을 입력하세요.

Ini, TOML

# [필수] Google Gemini API Key
GEMINI_API_KEY=your_google_api_key_here

# [선택] OpenAI Key (DALL-E 3 사용 시)
OPENAI_API_KEY=your_openai_key_here

# 세션 암호화 키
SESSION_SECRET=your_secret_key_1234
3. 개발 서버 실행
Bash

node server.js
# 접속 주소: http://localhost:3000 (또는 설정된 포트)
🌐 서버 배포 가이드 (Deployment Guide)
운영 환경(Ubuntu/Linux/Raspberry Pi)에서 **Nginx(리버스 프록시) + SSL(HTTPS) + PM2(무중단)**를 구성하는 표준 절차입니다.

1. Node.js 포트 변경 및 PM2 실행
Nginx가 80번 포트를 사용해야 하므로, Node.js 앱 포트를 3000번으로 변경합니다. (server.js 상단: const PORT = 3000;)

PM2 설치 및 앱 실행:

Bash

sudo npm install -g pm2
pm2 start server.js --name "assistberry"
pm2 startup
pm2 save
2. Nginx 설치 및 설정
외부 요청(80/443)을 내부의 Node.js(3000번)로 전달합니다.

Nginx 설치:

Bash

sudo apt update && sudo apt install nginx -y
설정 파일 생성:

Bash

sudo nano /etc/nginx/sites-available/assistberry
설정 내용 입력: (도메인이 없다면 server_name에 서버 IP를 입력하세요)

Nginx

server {
    listen 80;
    server_name chat.yourcompany.com;  # 도메인 또는 IP 입력

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # [중요] AI 답변 스트리밍을 위해 버퍼링 해제
        proxy_buffering off;

        # [중요] 이미지 생성 대기 시간(타임아웃) 5분으로 연장
        proxy_read_timeout 300s;

        # 파일 업로드 제한 해제 (50MB)
        client_max_body_size 50M;
    }
}
설정 적용:

Bash

sudo ln -s /etc/nginx/sites-available/assistberry /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t   # 문법 검사
sudo systemctl restart nginx
3. SSL 인증서 적용 (HTTPS)
Let's Encrypt를 사용하여 무료로 HTTPS를 적용합니다.

Bash

# Certbot 설치
sudo apt install certbot python3-certbot-nginx -y

# 인증서 발급 (Nginx 설정 자동 업데이트)
sudo certbot --nginx -d chat.yourcompany.com
설치 중 Redirect 옵션 질문 시 2 (Redirect) 선택 권장.

📖 사용 가이드 (User Manual)
🍌 NanoBanana (이미지 생성)
채팅 입력창 상단의 **바나나 아이콘(🍌)**을 클릭합니다.

입력창 테두리가 노란색으로 변하면 이미지 프롬프트를 입력합니다. (예: "미래지향적인 데이터 센터 그려줘")

생성된 이미지는 클릭하여 크게 보거나 다운로드할 수 있습니다.

📄 보고서 모드 (Biz Mode)
입력창 상단의 Mode Select를 Business로 변경합니다.

/report 명령어를 입력하거나 보고서 주제를 입력합니다.

답변 생성이 완료되면 말풍선 우측 상단의 [W] 아이콘을 클릭하여 .docx 파일로 다운로드합니다.

🛡 관리자 모드 (Admin)
shoo.kim (슈퍼 관리자) 계정으로 로그인합니다.

사이드바 하단의 Admin Dashboard 버튼을 클릭합니다.

기능:

서버 상태 확인 (CPU, Memory, Disk)

사용자 가입 승인/거절 및 Pro/Banana 권한 부여

RAG 지식 데이터(Knowledge Base) 주입 및 관리

서버 긴급 종료