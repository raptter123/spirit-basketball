// 전술 데이터. 좌표는 하프코트 SVG 기준 (viewBox 0 0 500 470, 골대는 y=442 근처).
// player.path 는 [x, y] 웨이포인트 배열이며, 애니메이션 시 이 경로를 따라 이동한다.
// 웨이포인트가 1개뿐이면 해당 위치에 고정(움직이지 않음)된 선수를 뜻한다.
// tactic.ball 은 공을 가진 선수가 바뀌는 시점을 [{ holder: 선수번호, at: 0~1 진행률 }] 로 나타낸다.
// 순수 수비 전술처럼 공을 표시할 필요가 없으면 ball 필드를 생략한다.
export const TACTICS = [
  {
    id: "pick-and-roll",
    name: "픽앤롤 (Pick and Roll)",
    category: "오펜스",
    summary: "센터의 스크린을 활용해 가드가 골밑을 파고드는 2대2 기본 전술",
    description:
      "포인트가드(1)가 볼을 몰고 오면 센터(5)가 스크린을 세워 수비를 지연시키고, " +
      "가드는 스크린을 타고 페인트존으로 돌파합니다. 스크린을 세운 센터는 곧바로 골밑으로 롤인하여 " +
      "패스를 받을 준비를 합니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 300], [195, 290], [165, 330], [190, 380], [215, 415]] },
      { number: 5, team: "offense", path: [[170, 300], [170, 300], [210, 400], [275, 420]] },
      { number: 2, team: "offense", path: [[400, 350], [420, 330]] },
      { number: 3, team: "offense", path: [[100, 350], [90, 330]] },
      { number: 4, team: "offense", path: [[350, 260], [330, 240]] },
    ],
    ball: [{ holder: 1, at: 0 }],
  },
  {
    id: "give-and-go",
    name: "기브 앤 고 (Give and Go)",
    category: "오펜스",
    summary: "패스 후 즉시 골밑으로 컷인하는 기본 2인 연계 플레이",
    description:
      "포인트가드(1)가 윙에 있는 슈팅가드(2)에게 패스한 뒤, 수비가 볼에 시선을 빼앗긴 틈을 타 " +
      "곧바로 백도어 컷으로 골밑을 파고듭니다. 패스를 받은 2번은 곧바로 1번에게 리턴 패스를 노립니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 300], [250, 300], [205, 355], [200, 400], [232, 430]] },
      { number: 2, team: "offense", path: [[400, 340], [400, 340]] },
      { number: 3, team: "offense", path: [[100, 350], [95, 340]] },
      { number: 4, team: "offense", path: [[350, 250], [335, 235]] },
      { number: 5, team: "offense", path: [[170, 420], [175, 400]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 2, at: 0.12 },
      { holder: 1, at: 0.55 },
    ],
  },
  {
    id: "zone-shift-23",
    name: "2-3 지역방어 시프트",
    category: "디펜스",
    summary: "볼 사이드로 수비 대형 전체가 이동하는 2-3 지역방어 기본 움직임",
    description:
      "공격이 볼을 오른쪽 윙으로 이동시키면, 2-3 지역방어의 다섯 명이 동시에 볼 사이드로 " +
      "무게중심을 옮깁니다. 앞선 두 명과 뒷선 세 명이 유기적으로 간격을 좁혀 패싱레인을 차단합니다.",
    players: [
      { number: 1, team: "defense", path: [[150, 150], [225, 140]] },
      { number: 2, team: "defense", path: [[350, 150], [385, 165]] },
      { number: 3, team: "defense", path: [[100, 300], [165, 285]] },
      { number: 4, team: "defense", path: [[250, 340], [300, 325]] },
      { number: 5, team: "defense", path: [[400, 300], [425, 325]] },
    ],
  },
  {
    id: "fast-break",
    name: "속공 (Fast Break)",
    category: "오펜스",
    summary: "리바운드 후 3인이 빠르게 골밑으로 전개하는 속공 전술",
    description:
      "리바운드를 잡은 직후, 세 명의 선수가 각자 레인을 나눠 빠르게 전개합니다. " +
      "가운데 볼 핸들러(1)가 속도를 조절하며 좌우 레인의 동료(2, 3)에게 패스 타이밍을 만듭니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 20], [250, 150], [235, 300], [222, 420]] },
      { number: 2, team: "offense", path: [[400, 20], [400, 150], [380, 280], [300, 400]] },
      { number: 3, team: "offense", path: [[100, 20], [100, 150], [120, 280], [200, 400]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 2, at: 0.75 },
    ],
  },
  {
    id: "pistol-21-action",
    name: "2-1 액션 (Pistol Action)",
    category: "오펜스",
    summary: "패스 후 곧바로 핸드오프로 이어지는 얼리 오펜스 기본 액션",
    description:
      "포인트가드(1)가 볼을 몰고 올라오며 윙에 자리잡은 슈팅가드(2)에게 빠르게 패스합니다. " +
      "패스한 1번은 곧바로 패스를 따라가 2번과 드리블 핸드오프를 주고받고, 핸드오프로 볼을 다시 받은 " +
      "1번은 미들로 어택합니다. 하이 포스트의 센터(5)는 스크린과 팝아웃 옵션을 동시에 열어두고, " +
      "나머지 두 명은 반대쪽 코트를 넓게 벌려 공간을 만듭니다.",
    players: [
      { number: 1, team: "offense", path: [[280, 250], [335, 275], [370, 295], [300, 345]] },
      { number: 2, team: "offense", path: [[400, 300], [375, 290], [330, 345], [220, 415]] },
      { number: 5, team: "offense", path: [[300, 225], [300, 225], [255, 215]] },
      { number: 3, team: "offense", path: [[110, 340], [100, 330]] },
      { number: 4, team: "offense", path: [[60, 420], [70, 410]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 2, at: 0.35 },
      { holder: 1, at: 0.65 },
    ],
  },
  {
    id: "horns-set",
    name: "혼스 세트 (Horns Set)",
    category: "오펜스",
    summary: "탑의 가드와 양쪽 엘보우 빅맨으로 시작하는 대표적인 세트 오펜스 대형",
    description:
      "혼스 세트는 포인트가드가 탑에, 두 명의 빅맨이 양쪽 엘보우에, 나머지 두 명이 양쪽 코너에 서는 " +
      "대형입니다. 가드가 한쪽 엘보우 빅맨의 스크린을 활용해 픽앤롤을 시작하고, 스크린을 세운 빅맨은 " +
      "곧바로 골밑으로 롤인합니다. 반대쪽 빅맨은 팝아웃하며 다음 옵션을 준비합니다.",
    players: [
      { number: 1, team: "offense", path: [[260, 230], [230, 245], [195, 275], [210, 340], [225, 395]] },
      { number: 5, team: "offense", path: [[190, 270], [190, 270], [215, 350], [250, 420]] },
      { number: 4, team: "offense", path: [[330, 270], [300, 255]] },
      { number: 2, team: "offense", path: [[470, 420], [455, 405]] },
      { number: 3, team: "offense", path: [[30, 420], [45, 405]] },
    ],
    ball: [{ holder: 1, at: 0 }],
  },
  {
    id: "iverson-cut",
    name: "아이버슨 컷 (Iverson Cut)",
    category: "오펜스",
    summary: "양쪽 엘보우 스크린을 연달아 타고 반대쪽 윙으로 가로지르는 유명한 오프더볼 컷",
    description:
      "아이버슨 컷은 탑의 가드가 양쪽 엘보우에 선 빅맨들의 스태거 스크린을 연달아 활용해 " +
      "한쪽 윙에서 반대쪽 윙으로 가로질러 컷하는 오프더볼 액션입니다. 수비를 스크린에 걸리게 만들어 " +
      "반대쪽에서 오픈 찬스를 만든 뒤 패스를 받습니다.",
    players: [
      { number: 1, team: "offense", path: [[260, 235], [270, 245]] },
      { number: 2, team: "offense", path: [[400, 330], [330, 270], [250, 250], [170, 270], [110, 310]] },
      { number: 4, team: "offense", path: [[330, 270], [335, 265]] },
      { number: 5, team: "offense", path: [[170, 270], [165, 265]] },
      { number: 3, team: "offense", path: [[430, 410], [420, 400]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 2, at: 0.75 },
    ],
  },
  {
    id: "elevator-screen",
    name: "엘리베이터 스크린 (Elevator Screen)",
    category: "오펜스",
    summary: "두 스크리너 사이를 슈터가 통과하면 문이 닫히듯 스크린이 좁혀지는 유명한 세트 플레이",
    description:
      "엘리베이터 스크린은 두 명의 스크리너가 나란히 서서 그 사이로 슈터가 뛰어들어가게 한 뒤, " +
      "슈터가 통과하자마자 양옆에서 좁혀 들어와 마치 엘리베이터 문이 닫히듯 뒤따라오는 수비를 " +
      "완전히 차단하는 스크린입니다. 문이 닫힌 사이로 빠져나온 슈터는 오픈 3점 찬스를 잡습니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 220], [255, 225]] },
      { number: 2, team: "offense", path: [[290, 420], [270, 340], [255, 270], [255, 215]] },
      { number: 5, team: "offense", path: [[220, 270], [215, 275]] },
      { number: 4, team: "offense", path: [[290, 270], [295, 275]] },
      { number: 3, team: "offense", path: [[430, 410], [420, 400]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 2, at: 0.85 },
    ],
  },
  {
    id: "spain-pick-and-roll",
    name: "스페인 픽앤롤 (Spain Pick and Roll)",
    category: "오펜스",
    summary: "롤맨에게 백스크린을 더해 수비를 이중으로 봉쇄하는 3인 픽앤롤 변형",
    description:
      "스페인 픽앤롤은 기본 픽앤롤에 '스크린 더 스크리너' 동작을 더한 3인 조합 플레이입니다. " +
      "빅맨(5)이 볼 핸들러(1)를 위해 온볼 스크린을 세운 뒤 골밑으로 롤인하는데, 이때 슈터(2)가 " +
      "롤맨을 쫓는 수비수를 백스크린으로 걸어 완전히 열어줍니다. 수비가 스크린에 걸리면 1번이 " +
      "활짝 열린 5번에게 패스를 연결합니다.",
    players: [
      { number: 1, team: "offense", path: [[260, 250], [220, 270], [195, 310], [210, 340]] },
      { number: 5, team: "offense", path: [[190, 270], [190, 270], [230, 360], [265, 420]] },
      { number: 2, team: "offense", path: [[400, 340], [320, 380], [350, 410]] },
      { number: 3, team: "offense", path: [[100, 340], [90, 330]] },
      { number: 4, team: "offense", path: [[430, 410], [420, 400]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 5, at: 0.85 },
    ],
  },
];

export function getTacticById(id) {
  return TACTICS.find((t) => t.id === id);
}
