# 🛡 보안 순찰 루틴 (Security Patrol)

매 작업(기능 추가·수정) 후 **배포 전** 보안 취약 패턴을 자동+수동으로 점검하고, 발견 즉시 고친다.
사람이 따로 지시하지 않아도 작업자(AI)가 이 루틴을 표준 워크플로로 항상 수행한다.

## 1) 자동 스캔
```
node scripts/security-scan.mjs
```
- **HIGH 발견 → exit 1 → 배포 중단, 즉시 수정**
- REVIEW → 수동 확인(공개 의도/화이트리스트면 통과, 아니면 수정)
- 스캐너는 휴리스틱 1차 필터일 뿐, 아래 수동 체크리스트와 함께 본다.

## 2) 점검 체크리스트
1. **인증**: 모든 쓰기/관리 엔드포인트에 `getUserFromRequest` 또는 `verifyAdmin`
2. **권한**: 수정·삭제는 본인 또는 관리자만(소유권 확인)
3. **SQL 인젝션**: 사용자 입력은 전부 `?` 바인드. 식별자(ORDER BY/테이블/컬럼)는 **화이트리스트/정제**
4. **XSS**: 출력은 escape. `innerHTML`에 미정제 사용자 입력 금지
5. **시크릿**: 서버 키(`KAKAO_REST_KEY`/`KAKAO_CLIENT_SECRET`/`VAPID_PRIVATE`/관리자 시크릿)는 클라이언트 파일·응답에 노출 금지 (단 `KAKAO_JS_KEY`는 공개키라 허용)
6. **레이트리밋**: 공개 쓰기(글/댓글/신고/업로드)는 1일·IP 한도
7. **CORS**: `Allow-Origin:*` + `Allow-Credentials:true` 동시 금지
8. **파일 업로드**: 폴더·MIME·크기 화이트리스트(+가능하면 서버측 rate-limit)
9. **세션 토큰**: 해시 저장 + httpOnly·Secure·SameSite 쿠키

## 3) 표준 워크플로
1. 기능 구현
2. `node scripts/security-scan.mjs` 실행
3. HIGH=0 + REVIEW 전부 확인될 때까지 수정
4. 배포(`wrangler pages deploy … --branch=main`)

## 알려진 항목(검토 완료)
- `_lib/crud.js` postHandler/deleteHandler/patchHandler → 내부 `verifyAdmin` (안전)
- `api/user-upload` → 의도된 무인증(공고 제출용) · 폴더/MIME/크기 화이트리스트. TODO: 서버측 IP rate-limit 보강 권장
- `api/track/*`, `api/stats/*`, `api/push/(un)subscribe`, `api/auth/logout` → 공개 의도(인증 불필요)
