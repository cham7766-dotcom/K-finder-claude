# K-finder-claude 개발 지침서 (Shopee Edition)

## 1. 프로젝트 개요

- **프로젝트명**: K-finder-claude
- **현재 버전**: 2.0 (AI 분석 통합 개발 중)
- **목적**: 쿠팡, 네이버 스마트스토어/브랜드스토어에서 상품 정보를 추출하고, **Google Gemini AI**를 통해 분석/번역하여 **Shopee 글로벌 판매**에 적합한 데이터로 가공한다.
- **타겟 플랫폼**: Shopee (싱가포르, 베트남, 태국 등 글로벌 마켓)
- **※ 주의**: 기존 S2B(학교장터) 관련 기능은 폐기됨.

## 2. 개발 단계 로드맵

### ✅ 1단계: 상품 추출 (완료)
- **지원 마켓**: 쿠팡, 네이버 스마트스토어, 네이버 브랜드스토어
- **핵심 기능**:
  - Shopee 필수 데이터(무게, 브랜드, 고화질 이미지) 추출
  - 옵션(Variation) 정보의 Raw Data 수집
  - `chrome.storage`를 활용한 데이터 저장 및 관리
  - 불필요한 도매 사이트 및 S2B 로직 제거

### 🚀 2단계: AI 상품 분석 (현재 진행 중)
- **핵심 기술**: Google Gemini API (Flash-1.5 / Pro-1.5)
- **주요 기능**:
  - **자동 번역**: 한글 상품명/상세설명을 현지화된 영어로 번역
  - **무게 보정**: 텍스트 분석을 통해 누락되거나 부정확한 무게(kg) 추정
  - **옵션 구조화**: 텍스트 형태의 옵션을 Shopee 업로드용 JSON 구조(Tier 1/2)로 변환
  - **마케팅 태그 생성**: 검색 노출을 위한 해시태그 및 소구점 추출
  - **리스크 필터링**: 금지 품목(액체류, 배터리 등) 경고

### 3단계: Shopee 업로드 (향후 예정)
- Shopee Open API 연동
- 분석된 데이터를 바탕으로 원클릭 상품 등록 구현

## 3. 기술 스택 및 구조

- **Core**: Chrome Extension Manifest V3, JavaScript (ES6+)
- **AI**: Google Gemini API
- **Storage**: Chrome Storage API (Local)

### 파일 구조
```text
K-finder-claude/
├── manifest.json          # 확장 프로그램 설정 (CSP: Gemini API 허용 필수)
├── background.js          # 1단계: 상품 추출 엔진 (DOM 파싱, 무게/브랜드 추출)
├── popup.js               # UI 이벤트 핸들러 (추출 및 AI 분석 요청)
├── sidepanel.html         # 메인 UI (추출 버튼, AI 분석 버튼, 결과창)
├── storage.js             # 데이터 저장/불러오기/관리 (Shopee 필드 적용)
├── gemini.js              # 2단계: AI 통신 및 프롬프트 엔지니어링 모듈
└── icons/                 # 아이콘 리소스

## 4. Git 버전 관리

### 저장소 정보
- **GitHub**: https://github.com/cham7766-dotcom/K-finder-claude
- **Branch**: main
- **작성자**: chosun (cham7746@gmail.com)

### 기본 워크플로우

```bash
# 작업 디렉토리로 이동
cd "c:\Users\chosun\Desktop\단계별\단계별_claude\1_상품추출\K-finder-claude"

# 1. 현재 상태 확인
git status

# 2. 변경된 파일 스테이징
git add .                    # 모든 변경사항
git add gemini.js           # 특정 파일만

# 3. 커밋 (변경 내용 설명)
git commit -m "Fix: Gemini API fallback 처리 개선"

# 4. GitHub에 푸시
git push

# 5. 최신 코드 가져오기 (다른 곳에서 작업했을 때)
git pull
```

### 커밋 메시지 규칙

- **Feat**: 새로운 기능 추가
- **Fix**: 버그 수정
- **Refactor**: 코드 리팩토링
- **Docs**: 문서 수정
- **Style**: 코드 포맷팅
- **Test**: 테스트 추가/수정

예시:
```
Feat: Gemini API 무게 보정 기능 추가
Fix: extractGeminiText 에러 처리 개선
Docs: GUIDELINES.md에 Git 사용법 추가
```

### 주요 명령어

```bash
# 커밋 히스토리 확인
git log --oneline

# 특정 파일 변경 내역
git log -p gemini.js

# 마지막 커밋 취소 (커밋만 취소, 파일은 유지)
git reset --soft HEAD~1

# 특정 파일만 이전 버전으로 되돌리기
git checkout HEAD -- gemini.js
```

### .gitignore 설정

API 키와 민감한 정보는 절대 커밋하지 않도록 `.gitignore`에 등록:
```
*.key
.env
config.js
```