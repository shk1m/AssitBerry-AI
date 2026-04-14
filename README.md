# AssistBerry AI (Data Architect Assistant)

**AssistBerry AI**는 데이터 엔지니어링 및 비즈니스 업무 효율화를 위해 개발된 **고성능 하이브리드 AI 플랫폼**입니다.
Google Gemini의 멀티모달 능력과 DeepSeek R1의 강력한 논리 추론 능력을 결합하여, 인프라(SCP, Spark, Airflow) 트러블슈팅 및 초저비용 고성능 코딩 환경을 제공합니다.

![License](https://img.shields.io/badge/License-Private-red)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-green)
![Status](https://img.shields.io/badge/Status-Production-blue)

---

## 🚀 주요 업데이트 (2026.04)
- **DeepSeek R1 UI/UX Enhancement**: 딥시크 모델 전용 사이버펑크 스타일의 추론 로딩 애니메이션을 적용하고, 긴 출력 대기 시간 동안의 사용자 경험 및 출력 안정성(버그 픽스)을 대폭 개선했습니다.
- **NanoBanana Prompt Chaining**: 단순히 1회성 이미지를 생성하는 것을 넘어, Flash-Lite 모델이 이전 대화 문맥을 분석하여 프롬프트를 재구성합니다. 이를 통해 "방금 그린 이미지 배경을 밤으로 바꿔줘"와 같은 연속적인 대화형 이미지 에디팅이 가능해졌습니다.
- **DeepSeek R1 Integration**: 기존 Gemini Pro 엔진을 초가성비/고지능 모델인 `deepseek-reasoner`로 전격 교체. 데이터 파이프라인 설계 및 코드 작성 비용을 **기존 대비 1/15 수준**으로 절감.
- **Context Summarization (10-Turn Logic)**: 대화가 10턴을 초과할 경우 `Flash-Lite` 모델이 과거 대화를 자동으로 요약하여 문맥을 유지하고 DB 용량과 토큰 비용을 최적화합니다.
- **Thinking UI**: DeepSeek R1의 깊은 사고 과정을 실시간으로 확인할 수 있는 전용 추론 레이아웃을 도입했습니다.


## 핵심 기능 (Key Features)

### 1. 멀티 페르소나 (Multi-Persona Modes)
- **General Mode**: 일상 대화 및 정보 검색.
- **Tech Mode**: SCP, Spark, Airflow, Iceberg 등 데이터 플랫폼 기술 지원 (On-call 엔지니어 페르소나).
- **Biz Mode**: 표준 문서 양식(개조식, 두괄식)에 맞춘 문서 초안 작성.
- **Custom Mode**: 사용자가 채팅방의 첫 메시지로 역할을 부여하면, 해당 세션 내내 AI가 그 역할을 영구적으로 수행합니다. (예: `/` 슬래시 커맨드를 활용한 역할 템플릿 자동완성)

### 2. NanoBanana Pro (Image Generation)
- **AI 이미지 생성**: 채팅창 상단 바나나(🍌) 버튼 클릭 시 활성화 (입력창 포커스 시 전용 골드 이펙트 및 UI 최적화 적용).
- **최신 모델 탑재**: `gemini-3-pro-image-preview` 모델을 적용하여 고품질 이미지 생성.
- **대화형 문맥 이해 (Prompt Chaining)**: Flash-Lite 모델이 이전 대화의 맥락을 읽고 프롬프트를 자동으로 재구성하여, 챗봇과 대화하듯 이미지를 점진적으로 수정해 나갈 수 있습니다.
- **Smart Memory (Zero-Bloat)**: 생성된 무거운 Base64 이미지 데이터는 DB 용량 최적화를 위해 **생성 12시간 후 자동으로 텍스트로 치환**되어 서버의 영구적인 부하를 방지합니다.

### 3. 파일 자동 생성 (Productivity)
- **Word(.docx) 레포트 생성**: AI 답변의 **[W]** 버튼 클릭 시, 맑은고딕 14pt, 표 스타일 등이 적용된 워드 파일 자동 생성.

### 4. 관리 및 보안 (Admin & Security)
- **Admin Dashboard**: 서버 리소스(CPU, RAM, Disk) 모니터링, 사용자 승인/관리, 시스템 종료.
- **실시간 비용 모니터링 [NEW]**: 관리자 패널에서 모든 사용자의 월별 및 누적 API 발생 비용($)을 한눈에 파악할 수 있습니다.
- **RAG (지식 주입)**: 관리자 패널을 통해 수동으로 사내 지식을 주입하여 검색 증강 생성(FTS5 기반) 적용.

### 5. 멀티모달 분석 (Multi-modal Support)
- **파일 첨부 지원**: 입력창 좌측의 클립(📎) 버튼을 통해 이미지 및 파일을 첨부하여 AI에게 분석 요청.
- **실시간 미리보기**: 첨부된 파일은 입력창 상단에 미니 썸네일로 즉시 확인 가능.
- **Zero-Storage Security**: 업로드된 파일은 서버 디스크나 데이터베이스에 절대 저장되지 않습니다. 오직 메모리(RAM)에서 일회성으로 처리된 후 즉시 소멸되어, 보안을 철저히 준수합니다.

### 6. 스마트 UX (Smart Experience)
- **실시간 API 비용 트래킹 [NEW]**: 대화 시 소모되는 입/출력 토큰을 계산하여, 사용자 화면 우측 상단에 이번 달 및 누적 달러($) 비용을 유쾌한 문구와 함께 실시간으로 보여줍니다.
- **프롬프트 레이아웃 & 퀵 이동 [NEW]**: 아무리 긴 에러 로그나 코드를 붙여넣어도 화면이 깨지지 않고 말풍선 내부에 자체 스크롤이 생성되며, 위로 스크롤 시 나타나는 우측 하단 **[⬇️] 버튼**으로 최신 대화로 즉시 이동할 수 있습니다.
- **테마 전환 (Green Mode) [NEW]**: 차세대 `Gemini 3 Flash Preview` 모델 선택 시, 화면 전체가 초록빛으로 물드는 전용 테마를 제공합니다.
- **Smart Session Renaming**: 첫 대화 내용을 AI가 분석하여 채팅방 제목을 자동으로 요약/갱신합니다.
- **Auto-Cleanup**: 1개월 이상 지난 오래된 대화 내역을 로그인 시 감지하여, 팝업을 통해 정리를 유도합니다. (DB 용량 최적화)
- **Mobile-Ready**: 고해상도 스마트폰 사진(50MB+) 업로드를 완벽 지원하며, 모바일 환경에 최적화된 반응형 UI를 제공.

---

## 기술 스택 (Tech Stack)

| 영역 | 기술 스택 |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism), Vanilla JS |
| **Backend** | Node.js, Express.js, Multer (In-Memory File Processing) |
| **Database** | SQLite3 (FTS5 검색 엔진 및 요금 집계 포함) |
| **AI Models** | Gemini 3.1 Flash Lite, Gemini 3.1 Pro, Gemini 3 Flash Preview, gemini-3-pro-image-preview |
| **Infra** | Nginx (Reverse Proxy), PM2 (Process Manager), Let's Encrypt (SSL) |

---

## 로컬 설치 및 실행 (Local Installation)

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

# 세션 암호화 키
SESSION_SECRET=your_secret_key_1234
DEEPSEEK_API_KEY=your_deepseek_api_key


Gemini의 응답
올려주신 기존 README.md 파일의 뼈대와 내용을 그대로 유지하면서, 이번에 업데이트된 Gemini 3 Flash Preview, 실시간 API 비용 트래킹, UI/UX 개선(프롬프트 스크롤, 퀵 이동 버튼) 내용을 자연스럽게 녹여냈습니다.

아래 마크다운 전체를 복사해서 기존 README.md에 덮어씌워 주시면 됩니다!

Markdown
# AssistBerry AI (Data Architect Assistant)

**AssistBerry AI**는 데이터 엔지니어링 및 비즈니스 업무 효율화를 위해 개발된 **올인원 AI 플랫폼**입니다.
Google Gemini의 최신 모델 라인업(Pro/Flash/Image)을 기반으로 하며, 사내 인프라(SCP, Spark, Airflow) 트러블슈팅 지원, 실시간 API 비용 트래킹, 그리고 표준 보고서 작성 자동화 기능을 제공합니다.

![License](https://img.shields.io/badge/License-Private-red)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-green)
![Status](https://img.shields.io/badge/Status-Production-blue)

---

## 핵심 기능 (Key Features)

### 1. 멀티 페르소나 (Multi-Persona Modes)
- **General Mode**: 일상 대화 및 정보 검색.
- **Tech Mode**: SCP, Spark, Airflow, Iceberg 등 데이터 플랫폼 기술 지원 (On-call 엔지니어 페르소나).
- **Biz Mode**: 표준 문서 양식(개조식, 두괄식)에 맞춘 문서 초안 작성.
- **Custom Mode**: 사용자가 채팅방의 첫 메시지로 역할을 부여하면, 해당 세션 내내 AI가 그 역할을 영구적으로 수행합니다. (예: `/` 슬래시 커맨드를 활용한 역할 템플릿 자동완성)

### 2. NanoBanana Pro (Image Generation)
- **AI 이미지 생성**: 채팅창 상단 바나나(🍌) 버튼 클릭 시 활성화 (입력창 테두리가 금색으로 빛남).
- **최신 모델 탑재**: `gemini-3-pro-image-preview` 모델을 적용하여 고품질 이미지 생성.
- **Image-to-Image**: 텍스트뿐만 아니라 참조할 이미지(파일)를 첨부하여 "이 스케치 느낌으로 로고 만들어줘"와 같은 고난도 작업 지원.

### 3. 파일 자동 생성 (Productivity)
- **Word(.docx) 레포트 생성**: AI 답변의 **[W]** 버튼 클릭 시, 맑은고딕 14pt, 표 스타일 등이 적용된 워드 파일 자동 생성.

### 4. 관리 및 보안 (Admin & Security)
- **Admin Dashboard**: 서버 리소스(CPU, RAM, Disk) 모니터링, 사용자 승인/관리, 시스템 종료.
- **실시간 비용 모니터링 [NEW]**: 관리자 패널에서 모든 사용자의 월별 및 누적 API 발생 비용($)을 한눈에 파악할 수 있습니다.
- **RAG (지식 주입)**: 관리자 패널을 통해 수동으로 사내 지식을 주입하여 검색 증강 생성(FTS5 기반) 적용.

### 5. 멀티모달 분석 (Multi-modal Support)
- **파일 첨부 지원**: 입력창 좌측의 클립(📎) 버튼을 통해 이미지 및 파일을 첨부하여 AI에게 분석 요청.
- **실시간 미리보기**: 첨부된 파일은 입력창 상단에 미니 썸네일로 즉시 확인 가능.
- **Zero-Storage Security**: 업로드된 파일은 서버 디스크나 데이터베이스에 절대 저장되지 않습니다. 오직 메모리(RAM)에서 일회성으로 처리된 후 즉시 소멸되어, 보안을 철저히 준수합니다.

### 6. 스마트 UX (Smart Experience)
- **실시간 API 비용 트래킹 [NEW]**: 대화 시 소모되는 입/출력 토큰을 계산하여, 사용자 화면 우측 상단에 이번 달 및 누적 달러($) 비용을 유쾌한 문구와 함께 실시간으로 보여줍니다.
- **프롬프트 레이아웃 & 퀵 이동 [NEW]**: 아무리 긴 에러 로그나 코드를 붙여넣어도 화면이 깨지지 않고 말풍선 내부에 자체 스크롤이 생성되며, 위로 스크롤 시 나타나는 우측 하단 **[⬇️] 버튼**으로 최신 대화로 즉시 이동할 수 있습니다.
- **테마 전환 (Green Mode) [NEW]**: 차세대 `Gemini 3 Flash Preview` 모델 선택 시, 화면 전체가 초록빛으로 물드는 전용 테마를 제공합니다.
- **Smart Session Renaming**: 첫 대화 내용을 AI가 분석하여 채팅방 제목을 자동으로 요약/갱신합니다.
- **Auto-Cleanup**: 1개월 이상 지난 오래된 대화 내역을 로그인 시 감지하여, 팝업을 통해 정리를 유도합니다. (DB 용량 최적화)
- **Mobile-Ready**: 고해상도 스마트폰 사진(50MB+) 업로드를 완벽 지원하며, 모바일 환경에 최적화된 반응형 UI를 제공.

---

## 기술 스택 (Tech Stack)

| 영역 | 기술 스택 |
|---|---|
| **Frontend** | HTML5, CSS3 (Glassmorphism), Vanilla JS |
| **Backend** | Node.js, Express.js, Multer (In-Memory File Processing) |
| **Database** | SQLite3 (FTS5 검색 엔진 및 요금 집계 포함) |
| **AI Models** | Gemini 3.1 Flash Lite, Gemini 3.1 Pro, Gemini 3 Flash Preview, gemini-3-pro-image-preview |
| **Infra** | Nginx (Reverse Proxy), PM2 (Process Manager), Let's Encrypt (SSL) |

---

## 로컬 설치 및 실행 (Local Installation)


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

# 세션 암호화 키
SESSION_SECRET=your_secret_key_1234
3. 개발 서버 실행
Bash
node server.js
# 접속 주소: http://localhost:3000 (또는 설정된 포트)
서버 배포 가이드 (Deployment Guide)
운영 환경(Ubuntu/Linux/Raspberry Pi)에서 **Nginx(리버스 프록시) + SSL(HTTPS) + PM2(무중단)**를 구성하는 표준 절차입니다.

1. Node.js 포트 변경 및 PM2 실행
Nginx가 80번 포트를 사용해야 하므로, Node.js 앱 포트를 3000번으로 변경합니다. (server.js 상단: const PORT = 3000;)

Bash
sudo npm install -g pm2
pm2 start server.js --name "assistberry"
pm2 startup
pm2 save
2. Nginx 설치 및 설정
외부 요청(80/443)을 내부의 Node.js(3000번)로 전달합니다.

Bash
sudo apt update && sudo apt install nginx -y
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
        proxy_set_header Connection upgrade;
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
Lets Encrypt를 사용하여 무료로 HTTPS를 적용합니다.

Bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx -y

# 인증서 발급 (Nginx 설정 자동 업데이트)
sudo certbot --nginx -d chat.yourcompany.com
# 설치 중 Redirect 옵션 질문 시 2 (Redirect) 선택 권장.

사용 가이드 (User Manual)
🍌 NanoBanana (이미지 생성): 채팅 입력창 상단의 바나나 아이콘을 클릭 후 상상하는 이미지를 묘사하세요.

📎 파일 분석 (Multi-modal): 입력창 왼쪽 클립 아이콘으로 아키텍처나 에러 로그 이미지를 첨부하고 질문하세요. 바나나 모드와 결합하여 Image-to-Image 작업도 가능합니다.

비즈니스 모드 (Biz Mode): 상단의 모드를 Business로 변경하고 문서 작성을 지시한 뒤, 답변 말풍선 우측 상단의 [W] 아이콘을 눌러 .docx 파일로 다운로드하세요.

관리자 모드 (Admin): admin 계정으로 로그인하여 하단 대시보드에서 유저별 API 발생 요금, 서버 상태 확인, 권한(Pro/Flash/Image) 부여 등을 수행하세요.

