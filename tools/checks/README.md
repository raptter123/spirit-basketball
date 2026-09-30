# 시험 · 점검 도구

사이트를 실제 브라우저(Playwright · Chromium)로 열어 누르고 잰다.
"눈으로 봤더니 괜찮다" 는 근거가 아니다 — 그래서 여기 있는 것은 전부 숫자를 낸다.

## 돌리는 법

```
node tools/checks/run.mjs            # 회귀 시험 전부 (15분쯤)
node tools/checks/run.mjs --fast     # 빠른 묶음 — PR 자동 검사가 이걸 돈다
node tools/checks/run.mjs rec tri    # 이름을 준 것만
node tools/checks/audit.mjs          # 주간 점검 도구 (판정 없이 재서 보고)
```

사이트는 실행기가 빈 포트에 스스로 띄운다. 이미 띄워 둔 서버를 쓰려면
`CHECK_URL=http://127.0.0.1:8911` 을 준다. 받은 엑셀 · 이미지 · 스크린샷은
`CHECK_OUT`(없으면 `<임시폴더>/spirit-checks`) 아래에 쌓인다.

## 필요한 것

| 무엇 | 왜 | 이 작업 환경 |
|---|---|---|
| node 20 이상 | 실행 | `/opt/node22/bin/node` |
| playwright | 브라우저 | `node_modules` → `/opt/node22/lib/node_modules` 심볼릭 링크 (`.gitignore` 에 있음) |
| python3 + openpyxl | 받은 엑셀을 열어 숫자 확인 | 있음 |
| Pillow | `img` — 밴드 이미지의 픽셀을 잰다 | 있음 |
| LibreOffice (`soffice`) | `xlsimg` 하나 — 엑셀이 실제로 열리나 | `libreoffice-calc` 설치 필요할 수 있음 |

## 판정

실행기는 **종료 코드 0** 과 **끝줄("전부 통과")** 을 둘 다 본다. ❌ 만 찾으면 안 된다 —
시험이 예외로 죽으면 ❌ 가 한 줄도 안 찍혀 "통과" 로 읽힌다. 실제로 그렇게 깨진
시험 네 벌이 통과로 보고된 적이 있다.

## 시험을 고칠 때

- **기대값을 고쳐 시험을 통과시키지 않는다.** 시험이 깨지면 먼저 고치기 전 코드
  (`git stash`)에서 돌려, 원래부터 깨지던 것인지 이번 변경이 깬 것인지 가른다.
- 새 기능에는 새 시험을 `suites/` 에 넣고 `run.mjs` 의 목록에 한 줄 설명과 함께 적는다.
  시험이 정말로 잡는지 보려고, 고치기 전 코드에서 한 번 깨지는 것까지 확인한다.
- 좌표 · 잘라내기 같은 값은 화면에서 읽는다(예: 코트 `viewBox`). 박아 두면
  화면이 바뀔 때 시험이 조용히 엉뚱한 자리를 누른다.
- `tools/real-photo-check.mjs` 의 기대값은 사람이 종이를 보고 확인한 값이다. 고치지 않는다.
