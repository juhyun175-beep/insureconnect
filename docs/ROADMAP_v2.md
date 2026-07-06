# InsureConnect v2.0 — 플랫폼 고도화 로드맵

> 기록 시작: 2026-05-28
> 브랜치 정책: master = 실험/스프린트 / main = production

## 🎯 비전
보험설계사가 매일 방문하는 업계 플랫폼 →
SEO 검색유입 폭증 + 회원 DB 자산화 + 리쿠르팅/광고/강의 수익화 + SaaS 확장

## 📊 KPI (운영 지표)
1. 검색유입 증가
2. 회원가입 전환율
3. 재방문율
4. 채용공고 등록 수
5. 강의 등록 수
6. 광고 문의 수
7. 체류시간 증가

## 🗺 7-Sprint 로드맵 (master 브랜치 → main merge)

### **Sprint 1 — SEO 게시판 시스템** (현재 진행 중)
**목표**: 보험 카테고리 12종의 SEO 최적화 게시판 → 구글 검색 유입 폭발

#### 카테고리 (`ic_seo_posts.category`)
- `claim` 보험금청구
- `actual-loss` 실손보험
- `whole-life` 종신보험
- `cancer` 암보험
- `car` 자동차보험
- `practice` 설계사실무
- `recruit-tips` 리쿠르팅
- `notice` 보험사공지
- `surgery-code` 수술코드
- `disease-code` 질병코드
- `terms` 약관해설
- `underwrite` 인수사례

#### URL 구조
```
/insurance/{category}/{slug}           예: /insurance/actual-loss/silbi-claim-process
/insurance/{category}                   카테고리 목록
/insurance                              전체 게시판 진입
```

#### SEO 자동화
- ✅ JSON-LD `Article` schema 게시글마다 자동 삽입
- ✅ 자동 meta description (본문 첫 160자)
- ✅ canonical URL
- ✅ breadcrumb (홈 > 보험 > 카테고리 > 글)
- ✅ sitemap.xml 자동 통합
- ✅ FAQ schema (Q&A 블록이 있을 때 자동)
- ✅ Related posts (같은 카테고리 최신 5개)
- ✅ 내부링크 자동 (해시태그 기반)

#### DB 스키마
```sql
CREATE TABLE ic_seo_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,                        -- 메타 설명 / 미리보기
  content TEXT NOT NULL,               -- 본문 (Markdown 또는 HTML)
  cover_image_url TEXT,
  tags TEXT,                           -- JSON array stringified
  faq_json TEXT,                       -- [{q,a}, ...] FAQ schema 용
  view_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published',     -- draft | published | archived
  author TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(category, slug)
);
CREATE INDEX idx_seo_category ON ic_seo_posts(category, status);
CREATE INDEX idx_seo_published ON ic_seo_posts(status, created_at DESC);
```

---

### **Sprint 2 — 회원 시스템**
- 이메일 회원가입 + 매직 링크
- OAuth: 카카오 / 구글 / 네이버
- D1 `ic_users` + `ic_sessions` (JWT)
- 등급: guest / member / certified / premium / admin

### **Sprint 3 — 설계사 인증**
- 명함/위촉증명서 R2 업로드
- 관리자 승인 워크플로우
- 인증 회원 전용 콘텐츠 (자료실/AI 도구)

### **Sprint 4 — 리쿠르팅 광고 상품화**
- 채용공고 등록 + 상품 등급 (일반/추천/상단/메인배너/긴급)
- 클릭/지원자 통계
- 운영자 수동 승인 기반 등록비 확인

### **Sprint 5 — 강의 플랫폼 강화**
- 신청 폼 빌트인 (외부 폼 의존 제거)
- 평점 + 후기 시스템
- 인기 강의 자동 노출

### **Sprint 6 — AI 도구**
- 상담 멘트 생성기 (Claude API)
- 약관 PDF 요약 (PDF → 텍스트 → AI 요약)
- 보상 Q&A 챗봇

### **Sprint 7 — CRM SaaS**
- 고객 DB / 상담 단계 / 계약 진행
- 조직장 대시보드
- 인증 회원 전용 유료 기능

---

## 🚦 배포 워크플로우

```
[작업 worktree] → commit → wrangler pages deploy --branch=master
                                     ↓
                          preview URL (master.insureconnect-hub.pages.dev)
                                     ↓
                          사용자 테스트 → OK
                                     ↓
                          merge to main → wrangler --branch=main
                                     ↓
                          production
```

## 🧱 기술 스택 결정
- **현재 인프라 유지**: Cloudflare Pages + Functions + D1 + R2
- **Next.js 마이그레이션 보류**: 점진 진화로 충분, 마이그레이션 비용 > 이익
- **회원 인증**: D1 + JWT (외부 의존성 0)
- **AI**: Anthropic Claude API (Workers AI 가능성도 검토)
- **이메일**: Resend 또는 Cloudflare Email Workers (free tier)
