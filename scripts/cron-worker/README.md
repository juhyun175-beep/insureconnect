# InsureConnect cron Worker

Pages엔 네이티브 cron이 없어, 이 별도 Cloudflare Worker가 스케줄에 맞춰 Pages의
`/api/cron/*` 엔드포인트를 호출합니다.

- **매일 07:00 KST** → `/api/cron/daily-brief` (일간 모닝 브리핑 + 만기 푸시)
- **매주 월 08:00 KST** → `/api/cron/weekly-digest` (주간 다이제스트)

## 배포 (이 폴더에서)

```bash
cd scripts/cron-worker
npx wrangler deploy
npx wrangler secret put CRON_SECRET   # Pages의 CRON_SECRET과 "동일한 값" 입력
```

## Pages 쪽 설정 (한 번)

```bash
# 1) Pages에도 같은 시크릿
npx wrangler pages secret put CRON_SECRET --project-name insureconnect-hub

# 2) DRY로 미리보기 검증 (발송 안 함 — 대상/만기 건수만 확인)
curl -X POST -H "x-cron-secret: <같은_값>" https://insureconnect-hub.pages.dev/api/cron/daily-brief

# 3) 검증 끝나면 실제 발송 ON (Pages 환경변수)
#    DAILY_BRIEF_ENABLED = 1   (일간 브리핑)
#    DIGEST_SEND_ENABLED = 1   (주간 다이제스트, 선택)
```

> 안전장치: 시크릿/플래그 설정 전엔 워커가 호출해도 Pages가 401 또는 DRY로 응답 → **아무도 발송 안 됨**.
> 시간 조정은 `wrangler.toml`의 `crons` 수정 후 재배포.
