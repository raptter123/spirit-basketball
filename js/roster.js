// 2026년 상반기(1~6월) 팀 기록지 기반 선수 평균 스탯. 출처: 팀 제공 기록 엑셀 '팀 요약' 시트.
// position 정보는 원본 자료에 없어 비워둠.
// topg(턴오버)/ts(TS%)는 팀 편성 미리보기 등에서 필요할 때만 선택적으로 쓴다 — 기본 카드 UI에는 노출하지 않는다.
// 기록지에 아직 없는 선수는 name만 넣어두면 된다 — 로스터/팀 편성 목록에는 나오고, 스탯 계산에서는 자동으로 빠진다.
//
// number(등번호)는 팀 기록 엑셀 66개 시트(2024-04 ~ 2026-06, 경기별 기록 1,681건)에서 뽑았다.
// 한 사람이 여러 번호로 적힌 경우가 두 건 있었는데 둘 다 옮겨 적을 때의 오타로 보여 많이 쓰인 쪽을 골랐다.
//   - 배준혁: 10번 67회 / 14번 3회 (14번은 홍재현)
//   - 손걸:   42번 65회 / 41번 7회 (41번은 황재웅, 게스트)
// 용원식(77)은 경기 기록지에 등장한 적이 없어 팀에서 직접 알려준 번호다.
// 아직 등번호를 모르는 선수는 number를 비워둔다 — 화면에는 번호 없는 유니폼으로 나온다.
// 심인보는 실제로 0번이다. 0은 거짓 값이라 `p.number ? ...`로 판단하면 사라지니, 반드시
// `typeof p.number === "number"`로 확인해야 한다.
export const ROSTER = [
  { name: "고성익", number: 26, games: 41, winRate: 0.463, ppg: 8.927, rpg: 2.585, apg: 1.585, spg: 0.61, fgPct: 0.4, topg: 1.439, ts: 0.409 },
  { name: "권혁남" },
  { name: "김도여", number: 24, games: 30, winRate: 0.367, ppg: 2.933, rpg: 2.533, apg: 2.8, spg: 0.433, fgPct: 0.192, topg: 1.5, ts: 0.234 },
  { name: "김동현", number: 47, games: 3, winRate: 0.333, ppg: 6.333, rpg: 1.667, apg: 1.667, spg: 0.667, fgPct: 0.45, topg: 2, ts: 0.475 },
  { name: "김산", number: 4, games: 16, winRate: 0.438, ppg: 3.125, rpg: 1.562, apg: 2.938, spg: 0.625, fgPct: 0.288, topg: 2, ts: 0.364 },
  { name: "김성훈", number: 7, games: 37, winRate: 0.676, ppg: 4.189, rpg: 5.189, apg: 2.405, spg: 0.595, fgPct: 0.308, topg: 0.432, ts: 0.373, captain: true },
  { name: "김웅기", number: 2, games: 38, winRate: 0.368, ppg: 6.921, rpg: 3.184, apg: 2.237, spg: 0.526, fgPct: 0.338, topg: 1.421, ts: 0.384 },
  { name: "김준석", number: 23, games: 34, winRate: 0.529, ppg: 8.176, rpg: 4.735, apg: 1.971, spg: 0.176, fgPct: 0.391, topg: 1.324, ts: 0.42 },
  { name: "김창범", number: 1, games: 39, winRate: 0.59, ppg: 2.667, rpg: 5.436, apg: 3.795, spg: 1.205, fgPct: 0.251, topg: 1.615, ts: 0.309 },
  { name: "김현민", number: 11, games: 39, winRate: 0.436, ppg: 2.769, rpg: 4.692, apg: 1.231, spg: 0.949, fgPct: 0.386, topg: 0.872, ts: 0.386 },
  { name: "문대주", number: 6, games: 2, winRate: 0, ppg: 5.5, rpg: 5, apg: 3, spg: 1.5, fgPct: 0.333, topg: 1.5, ts: 0.367 },
  { name: "박윤호", number: 21, games: 34, winRate: 0.5, ppg: 5.853, rpg: 5.853, apg: 2, spg: 1.441, fgPct: 0.281, topg: 1.235, ts: 0.325 },
  { name: "박준수", number: 3, games: 9, winRate: 0.333, ppg: 5.889, rpg: 2.667, apg: 0.778, spg: 0.667, fgPct: 0.227, topg: 0.556, ts: 0.295 },
  { name: "배준영", number: 8, games: 11, winRate: 0.364, ppg: 7.545, rpg: 2.909, apg: 1.636, spg: 1.182, fgPct: 0.287, topg: 0.818, ts: 0.375 },
  { name: "배준혁", number: 10, games: 48, winRate: 0.583, ppg: 8.583, rpg: 1.375, apg: 1.833, spg: 1.438, fgPct: 0.405, topg: 1.875, ts: 0.459 },
  { name: "손걸", number: 42, games: 46, winRate: 0.435, ppg: 5.37, rpg: 5.087, apg: 1.413, spg: 0.522, fgPct: 0.43, topg: 0.935, ts: 0.468 },
  { name: "송수빈", number: 74, games: 15, winRate: 0.333, ppg: 3.467, rpg: 1.733, apg: 0.733, spg: 0.667, fgPct: 0.282, topg: 1.933, ts: 0.3 },
  { name: "수잔", number: 32, games: 24, winRate: 0.375, ppg: 4.625, rpg: 3.083, apg: 1.792, spg: 0.583, fgPct: 0.378, topg: 1.5, ts: 0.401 },
  { name: "신윤호", number: 5, games: 32, winRate: 0.5, ppg: 6.656, rpg: 6.75, apg: 1.438, spg: 0.531, fgPct: 0.321, topg: 1, ts: 0.36 },
  { name: "신호철", number: 19, games: 7, winRate: 0.571, ppg: 4, rpg: 2.571, apg: 1.143, spg: 1, fgPct: 0.56, topg: 0.143, ts: 0.532 },
  { name: "심인보", number: 0, games: 4, winRate: 0.5, ppg: 4.75, rpg: 0.75, apg: 1, spg: 0, fgPct: 0.286, topg: 0.5, ts: 0.339 },
  { name: "용원식", number: 77, games: 16, winRate: 0.438, ppg: 7, rpg: 5.188, apg: 1.5, spg: 0.875, fgPct: 0.46, topg: 1.312, ts: 0.447 },
  { name: "유우진", number: 27, games: 24, winRate: 0.667, ppg: 7.417, rpg: 5.333, apg: 2.417, spg: 0.5, fgPct: 0.466, topg: 0.958, ts: 0.498 },
  { name: "유지원", number: 30, games: 24, winRate: 0.375, ppg: 3, rpg: 4.917, apg: 0.458, spg: 0.708, fgPct: 0.228, topg: 0.958, ts: 0.242 },
  { name: "이남희", number: 54, games: 26, winRate: 0.462, ppg: 6.885, rpg: 3.038, apg: 1.769, spg: 0.846, fgPct: 0.346, topg: 1.231, ts: 0.388 },
  { name: "이찬희", number: 15, games: 33, winRate: 0.424, ppg: 5.121, rpg: 4.212, apg: 2.091, spg: 1.061, fgPct: 0.352, topg: 1.273, ts: 0.359 },
  { name: "정성호", number: 17, games: 9, winRate: 0.444, ppg: 6.333, rpg: 4.444, apg: 0.889, spg: 0.222, fgPct: 0.366, topg: 1.222, ts: 0.369 },
  { name: "정우중", number: 12, games: 40, winRate: 0.525, ppg: 9.325, rpg: 6.9, apg: 1.2, spg: 1.825, fgPct: 0.397, topg: 1.225, ts: 0.423 },
  { name: "조기현", number: 18, games: 23, winRate: 0.435, ppg: 10.478, rpg: 6.609, apg: 2, spg: 1.13, fgPct: 0.451, topg: 1.348, ts: 0.492 },
  { name: "조보규", number: 55, games: 37, winRate: 0.432, ppg: 9.108, rpg: 2.351, apg: 2.459, spg: 0.73, fgPct: 0.337, topg: 1.324, ts: 0.42 },
  { name: "조연우", number: 34, games: 12, winRate: 0.5, ppg: 5, rpg: 4.25, apg: 0.417, spg: 0.667, fgPct: 0.353, topg: 1.167, ts: 0.378 },
  { name: "조우진", number: 69, games: 29, winRate: 0.414, ppg: 6.759, rpg: 2.517, apg: 2.034, spg: 0.586, fgPct: 0.345, topg: 2.069, ts: 0.398 },
  { name: "최용훈", number: 31, games: 30, winRate: 0.667, ppg: 9.367, rpg: 4.833, apg: 1.933, spg: 1, fgPct: 0.489, topg: 1.633, ts: 0.51 },
  { name: "홍광식", number: 9, games: 2, winRate: 0.5, ppg: 1.5, rpg: 6, apg: 0.5, spg: 0.5, fgPct: 0.167, topg: 0, ts: 0.25 },
  { name: "홍재현", number: 14, games: 33, winRate: 0.576, ppg: 8.212, rpg: 3.485, apg: 3.879, spg: 1.091, fgPct: 0.289, topg: 1.242, ts: 0.37 },
  { name: "황규철", number: 35, games: 43, winRate: 0.465, ppg: 10.14, rpg: 8.047, apg: 0.953, spg: 0.605, fgPct: 0.406, topg: 2.023, ts: 0.437 },
];
