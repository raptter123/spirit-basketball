// 전술 데이터. 좌표는 하프코트 SVG 기준 (viewBox 0 0 500 470, 골대는 y=442 근처).
// player.path 는 [x, y] 웨이포인트 배열이며, 애니메이션 시 이 경로를 따라 이동한다.
// 웨이포인트가 1개뿐이면 해당 위치에 고정(움직이지 않음)된 선수를 뜻한다.
// tactic.ball 은 공을 가진 선수가 바뀌는 시점을 [{ holder: 선수번호, at: 0~1 진행률 }] 로 나타낸다.
// 순수 수비 전술처럼 공을 표시할 필요가 없으면 ball 필드를 생략한다.
// tactic.scenarios (선택) 는 같은 시작 배치에서 갈라지는 대안 시나리오 목록이다.
// 예: 트리플 쓰렛 상황에서 "돌파" / "1번 패스" / "2번 패스"처럼 여러 흐름을 한 전술에 담고 싶을 때 사용한다.
// [{ name: "1번 패스", players: [...], ball: [...] }] 형태이며, players/ball 형식은 전술 최상위 필드와 동일하다.
// 최상위 players/ball은 "기본" 시나리오로 취급되고, scenarios는 그 외 추가 시나리오다.
// player.opponent: true (선택) 는 그 선수가 우리 팀이 아니라 상대 수비수임을 뜻한다.
// 상대 수비수는 로스터 선수가 아니므로 number를 등번호 대신 "X1", "X2"... 로 표기하고,
// 선수 이름 시뮬레이션과 공 소유자 선택 목록에서는 제외된다. 상대 수비 대형에 따른
// 공격 파훼법을 그릴 때(예: 지역방어 vs 오펜스), 기존 5명 오펜스 선수와 함께 넣어 쓴다.
// 2026-07-30에 구글/유튜브 자료로 명칭·설명을 다시 검증해서 정리함 (없는 용어는 바로잡고, 디펜스 전술을 보강함).
export const TACTICS = [
  {
    id: "pick-and-roll",
    name: "픽앤롤 (Pick and Roll)",
    category: "패턴",
    summary: "센터의 스크린을 활용해 가드가 골밑을 파고드는 2대2 기본 전술",
    description:
      "포인트가드(1)가 볼을 몰고 오면 센터(5)가 스크린을 세워 수비를 지연시키고, " +
      "가드는 스크린을 타고 페인트존으로 돌파합니다. 스크린을 세운 센터는 곧바로 골밑으로 롤인하여 " +
      "패스를 받을 준비를 합니다. 현대 농구에서 가장 기본이 되는 2대2 액션입니다.",
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
    category: "패턴",
    summary: "패스 후 즉시 골밑으로 컷인하는 기본 2인 연계 플레이",
    description:
      "포인트가드(1)가 윙에 있는 슈팅가드(2)에게 패스한 뒤, 수비가 볼에 시선을 빼앗긴 틈을 타 " +
      "곧바로 백도어 컷으로 골밑을 파고듭니다. 패스를 받은 2번은 곧바로 1번에게 리턴 패스를 노립니다. " +
      "농구에서 가장 오래되고 단순하지만 여전히 유효한 오프더볼 움직임입니다.",
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
    id: "fast-break",
    name: "속공 (Fast Break)",
    category: "패턴",
    summary: "리바운드 후 3인이 빠르게 골밑으로 전개하는 속공 전술",
    description:
      "리바운드를 잡은 직후, 세 명의 선수가 각자 레인을 나눠 빠르게 전개하는 3인 속공(3-lane break)입니다. " +
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
    name: "피스톨 액션 (Pistol Action)",
    category: "패턴",
    summary: "속공 이후 바로 이어지는 얼리 오펜스, 핸드오프로 2대2를 빠르게 세팅",
    description:
      "피스톨 액션은 트랜지션 직후 곧바로 이어지는 얼리 오펜스 세트입니다. 포인트가드(1)가 볼을 몰고 " +
      "올라오며 미리 윙에 자리 잡은 슈팅가드(2)에게 핸드오프로 볼을 넘기고, 2번은 곧바로 하이 포스트의 " +
      "센터(5)가 세워주는 스크린을 타고 미들로 돌파합니다. 나머지 세 명은 반대쪽 코트를 넓게 벌려 " +
      "공간을 만듭니다.",
    players: [
      { number: 1, team: "offense", path: [[181, 31], [89, 189], [120, 318], [197, 433]] },
      { number: 2, team: "offense", path: [[263, 176], [102, 208]] },
      { number: 5, team: "offense", path: [[323, 450], [358, 363], [340, 266]] },
      { number: 3, team: "offense", path: [[423, 235], [259, 174]] },
      { number: 4, team: "offense", path: [[145, 441], [284, 451], [443, 445]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 2, at: 0.39 },
      { holder: 1, at: 0.52 },
    ],
  },
  {
    id: "horns-set",
    name: "혼스 세트 (Horns Set)",
    category: "세트 오펜스",
    summary: "탑의 가드와 양쪽 엘보우 빅맨으로 시작하는 대표적인 세트 오펜스 대형",
    description:
      "혼스 세트는 포인트가드가 탑에, 두 명의 빅맨이 양쪽 엘보우에, 나머지 두 명이 양쪽 코너에 서는 " +
      "대형입니다. 가드가 한쪽 엘보우 빅맨의 스크린을 활용해 픽앤롤을 시작하고, 스크린을 세운 빅맨은 " +
      "곧바로 골밑으로 롤인합니다. 반대쪽 빅맨은 팝아웃하며 다음 옵션을 준비합니다. 대부분의 NBA 팀이 " +
      "쓰는 가장 대표적인 세트 오펜스입니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 220], [230, 245], [195, 275], [210, 340], [225, 395]] },
      { number: 5, team: "offense", path: [[180, 270], [180, 270], [215, 350], [250, 420]] },
      { number: 4, team: "offense", path: [[320, 270], [300, 250]] },
      { number: 2, team: "offense", path: [[470, 420], [455, 405]] },
      { number: 3, team: "offense", path: [[30, 420], [45, 405]] },
    ],
    ball: [{ holder: 1, at: 0 }],
  },
  {
    id: "flex-offense",
    name: "플렉스 오펜스 (Flex Offense)",
    category: "세트 오펜스",
    summary: "다섯 명이 자리를 순환하며 스크린을 이어가는 대표적인 연속(모션) 세트 오펜스",
    description:
      "플렉스 오펜스는 선수 다섯 명이 계속 자리를 바꿔가며 순환하는 대표적인 연속 오펜스입니다. " +
      "하이 포스트(5)가 패스를 받으면, 반대쪽 베이스라인에 있는 3번이 같은 편 베이스라인 선수(2)의 " +
      "크로스 스크린(플렉스 스크린)을 타고 골밑 쪽으로 컷인해 패스를 받습니다. 스크린을 세운 2번은 " +
      "곧이어 1번의 다운 스크린을 받아 반대쪽 탑으로 팝아웃하며 다음 사이클을 준비합니다. " +
      "'스크린 후 그 스크리너를 다시 스크린해주는' 패턴이 계속 반복되는 것이 특징으로, 선수 교체 " +
      "없이도 오픈 찬스를 계속 만들어낼 수 있어 아마추어·고교 농구에서 특히 선호됩니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 220], [250, 220], [230, 270], [210, 320]] },
      { number: 5, team: "offense", path: [[320, 270], [320, 270]] },
      { number: 2, team: "offense", path: [[200, 420], [200, 420], [220, 380], [250, 300]] },
      { number: 3, team: "offense", path: [[300, 420], [220, 410], [180, 380]] },
      { number: 4, team: "offense", path: [[180, 270], [170, 260]] },
    ],
    ball: [
      { holder: 1, at: 0 },
      { holder: 5, at: 0.3 },
      { holder: 3, at: 0.7 },
    ],
  },
  {
    id: "daeju",
    name: "대주",
    category: "세트 오펜스",
    summary: "볼러의 패스 후 움직임과 스크린을 이용한 3점 찬스 만드는 전술",
    description:
      "1번(핸들러)이 탑, 2번과 3번이 양쪽 45도, 4번과 5번이 양쪽 로우에 서는 대형으로 시작합니다. " +
      "1번이 2번에게 패스한 뒤 볼 반대편 로우에 있는 5번에게 스크린을 걸어주고, 5번은 그 스크린을 " +
      "타고 하이 포스트로 올라와 패스를 받습니다. 1번은 곧바로 반대편으로 스윙돌며 이때 4번의 " +
      "스크린을 받습니다. 하이 포스트에서 볼을 잡은 5번은 스윙돈 1번에게 패스하거나, 스크린을 " +
      "걸어주고 로우로 컷인하는 4번에게 패스를 연결합니다.",
    players: [
      { number: 1, team: "offense", path: [[250, 157], [176, 275], [226, 394], [336, 444], [478, 432]] },
      { number: 2, team: "offense", path: [[424, 239], [382, 231], [395, 261]] },
      { number: 3, team: "offense", path: [[83, 230]] },
      { number: 4, team: "offense", path: [[329, 266], [343, 367], [326, 450], [224, 414]] },
      { number: 5, team: "offense", path: [[180, 436], [184, 292], [239, 269], [295, 303]] },
    ],
    ball: [
      { holder: 1, at: 0.02 },
      { holder: 2, at: 0.08 },
      { holder: 1, at: 1 },
    ],
  },
  {
    id: "iverson-cut",
    name: "아이버슨 컷 (Iverson Cut)",
    category: "패턴",
    summary: "양쪽 엘보우 스크린을 연달아 타고 반대쪽 윙으로 가로지르는 유명한 오프더볼 컷",
    description:
      "아이버슨 컷은 탑의 가드가 양쪽 엘보우에 선 빅맨들의 스태거 스크린을 연달아 활용해 " +
      "한쪽 윙에서 반대쪽 윙으로 가로질러 컷하는 오프더볼 액션입니다. 필라델피아 시절 앨런 아이버슨이 " +
      "자주 활용해 이름이 붙었습니다. 수비를 스크린에 걸리게 만들어 반대쪽에서 오픈 찬스를 만든 뒤 " +
      "패스를 받습니다.",
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
    category: "패턴",
    summary: "두 스크리너 사이를 슈터가 통과하면 문이 닫히듯 스크린이 좁혀지는 유명한 세트 플레이",
    description:
      "엘리베이터 스크린은 두 명의 스크리너가 나란히 서서 그 사이로 슈터가 뛰어들어가게 한 뒤, " +
      "슈터가 통과하자마자 양옆에서 좁혀 들어와 마치 엘리베이터 문이 닫히듯 뒤따라오는 수비를 " +
      "완전히 차단하는 스크린입니다. 레지 밀러, 클레이 탐슨 등이 즐겨 쓴 것으로 유명합니다. " +
      "문이 닫힌 사이로 빠져나온 슈터는 오픈 3점 찬스를 잡습니다.",
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
    category: "패턴",
    summary: "롤맨에게 백스크린을 더해 수비를 이중으로 봉쇄하는 3인 픽앤롤 변형",
    description:
      "스페인 픽앤롤은 기본 픽앤롤에 '스크린 더 스크리너' 동작을 더한 3인 조합 플레이입니다. " +
      "빅맨(5)이 볼 핸들러(1)를 위해 온볼 스크린을 세운 뒤 골밑으로 롤인하는데, 이때 슈터(2)가 " +
      "롤맨을 쫓는 수비수를 백스크린으로 걸어 완전히 열어줍니다. 스페인 국가대표팀이 즐겨 써서 " +
      "이런 이름이 붙었습니다. 수비가 스크린에 걸리면 1번이 활짝 열린 5번에게 패스를 연결합니다.",
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
    id: "drop-coverage",
    name: "픽앤롤 수비: 드랍 커버리지 (Drop Coverage)",
    category: "디펜스",
    summary: "스크리너를 막는 빅맨이 골밑으로 내려앉아 림과 돌파를 지키는 픽앤롤 수비",
    description:
      "픽앤롤 상황에서 스크리너를 막는 빅맨(5)이 뒤로 처지며 골밑을 사수하고, 온볼 수비수(1)는 " +
      "스크린 위를 넘어 쫓아가며 볼 핸들러의 중앙 돌파를 막습니다. 나머지 세 명은 강 사이드로 살짝 " +
      "좁혀 헬프 각도를 만듭니다. 미드레인지 풀업 점퍼는 내주더라도 골밑과 돌파만은 확실히 막는 " +
      "수비로, 발이 느린 대신 림 프로텍팅에 능한 빅맨이 있는 팀이 즐겨 씁니다.",
    players: [
      { number: 1, team: "defense", path: [[250, 290], [220, 270], [200, 310], [210, 350]] },
      { number: 5, team: "defense", path: [[190, 300], [220, 360], [240, 410], [260, 390]] },
      { number: 2, team: "defense", path: [[400, 340], [370, 330]] },
      { number: 3, team: "defense", path: [[100, 350], [130, 340]] },
      { number: 4, team: "defense", path: [[350, 250], [300, 270]] },
    ],
  },
  {
    id: "hedge-coverage",
    name: "픽앤롤 수비: 헤지 (Hedge)",
    category: "디펜스",
    summary: "빅맨이 순간적으로 튀어나가 볼 핸들러를 막고 다시 자기 마크맨에게 돌아가는 수비",
    description:
      "빅맨(5)이 스크린 시점에 순간적으로 강하게 튀어나가 볼 핸들러의 진행을 잠깐 막아서고, " +
      "그 사이 온볼 수비수(1)가 스크린을 돌아 나와 다시 볼을 따라붙습니다. 헤지를 마친 빅맨은 " +
      "곧바로 자기 마크맨(롤러)에게 복귀합니다. 드랍보다 더 적극적으로 볼 핸들러를 압박하고 싶을 " +
      "때 쓰는 픽앤롤 수비 커버리지입니다.",
    players: [
      { number: 1, team: "defense", path: [[250, 290], [230, 300], [210, 330], [220, 360]] },
      { number: 5, team: "defense", path: [[190, 300], [230, 320], [210, 360], [230, 400]] },
      { number: 2, team: "defense", path: [[400, 340], [380, 330]] },
      { number: 3, team: "defense", path: [[100, 350], [120, 340]] },
      { number: 4, team: "defense", path: [[350, 250], [320, 280]] },
    ],
  },
  {
    id: "switch-coverage",
    name: "픽앤롤 수비: 스위치 (Switch)",
    category: "디펜스",
    summary: "스크린이 걸리는 순간 두 수비수가 마크맨을 맞바꾸는 가장 단순한 픽앤롤 수비",
    description:
      "스크린이 걸리는 순간 두 수비수가 그대로 마크맨을 맞바꿉니다. 온볼 수비수(1)는 스크리너였던 " +
      "선수를 막고, 스크리너를 막던 빅맨(5)이 볼 핸들러를 맡습니다. 미스매치를 감수하더라도 스크린 " +
      "자체를 무력화하는 가장 단순하고 확실한 방법이라, 수비수들의 스위치가 가능한 팀에서 널리 " +
      "쓰입니다.",
    players: [
      { number: 1, team: "defense", path: [[250, 290], [210, 300], [200, 340], [230, 390]] },
      { number: 5, team: "defense", path: [[190, 300], [220, 290], [240, 310], [230, 340]] },
      { number: 2, team: "defense", path: [[400, 340], [390, 335]] },
      { number: 3, team: "defense", path: [[100, 350], [105, 345]] },
      { number: 4, team: "defense", path: [[350, 250], [340, 255]] },
    ],
  },
  {
    id: "box-and-one",
    name: "박스앤원 (Box and One)",
    category: "디펜스",
    summary: "네 명이 박스 존을 짜고 한 명이 상대 에이스를 전담 마크하는 변형 수비",
    description:
      "네 명이 페인트 구역을 감싸는 박스 모양의 지역방어를 서고, 한 명(5)은 상대 에이스 득점원을 " +
      "어디든 따라다니며 맨투맨으로 밀착 수비합니다. 상대 팀에 확실한 에이스 한 명만 있고 나머지 " +
      "득점력이 약할 때, 그 한 명을 완전히 잠그기 위해 아마추어 농구에서도 자주 쓰이는 변형 수비입니다.",
    players: [
      { number: 1, team: "defense", path: [[190, 270], [200, 260]] },
      { number: 2, team: "defense", path: [[310, 270], [300, 260]] },
      { number: 3, team: "defense", path: [[200, 400], [190, 390]] },
      { number: 4, team: "defense", path: [[300, 400], [310, 390]] },
      { number: 5, team: "defense", path: [[400, 200], [300, 180], [420, 320], [350, 400]] },
    ],
  },
  {
    id: "half-court-trap",
    name: "하프코트 트랩 (Half-Court Trap)",
    category: "디펜스",
    summary: "하프라인을 넘는 볼 핸들러를 두 명이 순간적으로 더블팀하는 압박 수비",
    description:
      "볼 핸들러가 하프라인을 넘어오는 시점에 두 명(1, 2)이 순간적으로 달려들어 더블팀을 만듭니다. " +
      "나머지 세 명은 패스 레인을 좁히고 롱패스에 대비해 골밑까지 커버합니다. 상대 볼 핸들링이 " +
      "불안하거나 세트 오펜스가 시작되기 전에 흐름을 강제로 끊고 싶을 때 쓰는 압박 수비입니다.",
    players: [
      { number: 1, team: "defense", path: [[250, 150], [240, 170]] },
      { number: 2, team: "defense", path: [[350, 150], [270, 160]] },
      { number: 3, team: "defense", path: [[100, 200], [150, 220]] },
      { number: 4, team: "defense", path: [[400, 250], [350, 240]] },
      { number: 5, team: "defense", path: [[250, 350], [280, 300]] },
    ],
  },
  {
    id: "shooter-pattern",
    name: "슛터 패턴",
    category: "세트 오펜스",
    summary: "빅맨의 로우 포스트 셋업을 미끼로, 슛터가 반대편에서 컷하다 방향을 바꿔 스크린을 받는 오프더볼 패턴",
    description:
      "공격팀 빅맨이 로우 포스트 자리를 잡는거처럼 행동을 시작할때 슛터가 포스트 잡는 빅맨 반대쪽 컷을 도는거처럼 들어가다가 순간적으로 방향을 바꿔 스크린을 받는 슛 찬스\n" +
      "(추가 패턴은 이때 슛체크를 상대팀 3번이 나오면 슛터를 주는것이 아닌 로우포스트에 있는 빅맨 컷인 찬스 봐주기)",
    players: [
      { number: 1, team: "offense", path: [[238, 147], [72, 224]] },
      { number: 2, team: "offense", path: [[59, 249], [201, 367], [24, 372]] },
      { number: 3, team: "offense", path: [[424, 240], [256, 147]] },
      { number: 4, team: "offense", path: [[100, 365]] },
      { number: 5, team: "offense", path: [[374, 321]] },
      { number: "X1", team: "defense", opponent: true, path: [[200, 230]] },
      { number: "X2", team: "defense", opponent: true, path: [[306, 230]] },
      { number: "X3", team: "defense", opponent: true, path: [[170, 363]] },
      { number: "X4", team: "defense", opponent: true, path: [[344, 356]] },
      { number: "X5", team: "defense", opponent: true, path: [[257, 359]] },
    ],
    ball: [
      { holder: 1, at: 0.88 },
      { holder: 2, at: 1 },
    ],
    scenarios: [
      {
        name: "시나리오 1",
        players: [
          { number: 1, team: "offense", path: [[238, 147], [72, 224]] },
          { number: 2, team: "offense", path: [[59, 249], [201, 367], [28, 365]] },
          { number: 3, team: "offense", path: [[424, 240], [256, 147]] },
          { number: 4, team: "offense", path: [[122, 332], [98, 374]] },
          { number: 5, team: "offense", path: [[374, 321]] },
          { number: "X1", team: "defense", opponent: true, path: [[200, 230], [143, 250]] },
          { number: "X2", team: "defense", opponent: true, path: [[306, 230], [249, 241]] },
          { number: "X3", team: "defense", opponent: true, path: [[144, 371]] },
          { number: "X4", team: "defense", opponent: true, path: [[344, 356]] },
          { number: "X5", team: "defense", opponent: true, path: [[257, 359]] },
        ],
        ball: [
          { holder: 1, at: 0.88 },
          { holder: 2, at: 1 },
        ],
      },
      {
        name: "시나리오 2",
        players: [
          { number: 1, team: "offense", path: [[238, 147], [72, 224]] },
          { number: 2, team: "offense", path: [[59, 249], [201, 367], [28, 365]] },
          { number: 3, team: "offense", path: [[424, 240], [256, 147]] },
          { number: 4, team: "offense", path: [[122, 332], [98, 374]] },
          { number: 5, team: "offense", path: [[374, 321]] },
          { number: "X1", team: "defense", opponent: true, path: [[200, 230], [143, 250]] },
          { number: "X2", team: "defense", opponent: true, path: [[306, 230], [249, 241]] },
          { number: "X3", team: "defense", opponent: true, path: [[144, 371], [52, 360]] },
          { number: "X4", team: "defense", opponent: true, path: [[344, 356]] },
          { number: "X5", team: "defense", opponent: true, path: [[257, 359]] },
        ],
        ball: [
          { holder: 1, at: 0.88 },
          { holder: 4, at: 1 },
        ],
      },
    ],
  },
];

export function getTacticById(id) {
  return TACTICS.find((t) => t.id === id);
}
