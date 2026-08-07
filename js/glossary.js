// 팀 공통 용어 사전.
// 전술 하나에 묻어두면 찾기 어려운 용어들을 따로 모은 곳이다.
//
// term    표시할 용어 이름
// en      영어 표기 (없으면 생략)
// group   묶음 — "픽앤롤 수비 콜" / "매치업" / "코트·움직임"
// when    언제 쓰는지 (선택)
// idea    핵심 아이디어 / 뜻
// tactic  이 용어가 실제로 나오는 전술 id (선택). 있으면 "코트에서 보기" 링크가 붙는다.
//
// "픽앤롤 수비 콜"과 "매치업" 묶음은 [규철] 맨투맨 디팬스 설명에 규철이 정리해둔 내용을
// 그대로 옮긴 것이다. "코트·움직임" 묶음은 여러 전술 설명에 반복해서 나오는 일반 용어라
// 새로 적었으니, 팀에서 쓰는 뜻과 다르면 알려주세요.
export const GLOSSARY = [
  {
    term: "스위치",
    en: "Switch",
    group: "픽앤롤 수비 콜",
    when: "수비수 스피드/사이즈가 비슷할 때",
    idea: "스크린 걸리자마자 바로 매치업 교체, 공간과 미스매치 차단",
    tactic: "switch-coverage",
  },
  {
    term: "드롭백",
    en: "Drop",
    group: "픽앤롤 수비 콜",
    when: "우리 빅맨이 느리거나, 상대 가드 돌파가 위험할 때",
    idea: "가드는 스크린 위에서 압박, 빅맨은 페인트 안쪽으로 내려가 돌파/롤 차단",
    tactic: "drop-coverage",
  },
  {
    term: "블리츠",
    en: "Blitz",
    group: "픽앤롤 수비 콜",
    when: "상대 가드 슛이 무서울 때",
    idea: "두 수비수가 잠시 가드를 더블팀으로 묶어 공 빼앗기 or 패스 강요",
    tactic: "man-to-man-defense",
  },
  {
    term: "아이스 / 블루",
    en: "Ice / Blue",
    group: "픽앤롤 수비 콜",
    when: "사이드 픽앤롤 막을 때",
    idea: "가드를 스크린 아래로 몰아 사이드라인 쪽으로 밀어내고, 빅맨이 돌파 경로 차단",
  },
  {
    term: "파이트 스루",
    en: "Fight through",
    group: "픽앤롤 수비 콜",
    when: "스크린을 피하고 원래 마크맨 계속 따라갈 때",
    idea: "스크린 위/아래로 빠르게 빠져나와 스위치 없이 원 매치업 유지",
  },
  {
    term: "헤지",
    en: "Hedge",
    group: "픽앤롤 수비 콜",
    when: "볼 핸들러의 속도를 잠깐 끊고 싶을 때",
    idea: "빅맨이 스크린 위로 잠깐 나가 핸들러를 막았다가, 자기 마크로 되돌아간다",
    tactic: "hedge-coverage",
  },

  {
    term: "프리 스위치",
    en: "Pre-switch",
    group: "매치업",
    when: "핸들러가 상대 에이스인 경우",
    idea:
      "상대가 늘 같은 조합으로 픽앤롤을 시작하면, 스크린이 오기 전에 미리 서로의 마크를 바꿔둔다. " +
      "이미 '반대 매치업'이 되어 있으니 스위치가 되어도 미스매치가 안 생긴다",
    tactic: "man-to-man-defense",
  },
  {
    term: "스크램 스위치",
    en: "Scram switch",
    group: "매치업",
    when: "포워드가 상대 에이스인 경우",
    idea:
      "스위치로 생긴 미스매치(작은 가드가 큰 포스트맨을 막게 됨)를, 공이 움직이는 짧은 순간에 " +
      "제3의 수비수까지 끌어와 다시 정리한다. 2대2 픽앤롤 수비가 3대3 스위치처럼 변한다",
    tactic: "man-to-man-defense",
  },
  {
    term: "미스매치",
    en: "Mismatch",
    group: "매치업",
    idea: "체격·스피드 차이가 큰 매치업. 작은 가드가 큰 포스트맨을 막게 되는 상황이 대표적이다",
  },

  {
    term: "온볼 스크린",
    en: "On-ball screen",
    group: "코트·움직임",
    idea: "공을 가진 선수를 위해 세우는 스크린. 픽앤롤의 '픽'이 이것이다",
    tactic: "pick-and-roll",
  },
  {
    term: "백스크린",
    en: "Back screen",
    group: "코트·움직임",
    idea: "수비수의 등 뒤에서 세우는 스크린. 수비가 보지 못한 채 걸리기 때문에 컷하는 선수가 크게 열린다",
    tactic: "spain-pick-and-roll",
  },
  {
    term: "롤인 / 팝아웃",
    en: "Roll / Pop",
    group: "코트·움직임",
    idea: "스크린을 세운 빅맨의 다음 선택. 골밑으로 파고들면 롤인, 외곽으로 빠져 슛을 노리면 팝아웃",
    tactic: "pick-and-roll",
  },
  {
    term: "컷 / 컷인",
    en: "Cut",
    group: "코트·움직임",
    idea: "공 없는 선수가 빈 공간으로 빠르게 파고드는 움직임. 수비 시선이 공에 쏠린 틈을 노린다",
    tactic: "give-and-go",
  },
  {
    term: "핸드오프",
    en: "Hand-off",
    group: "코트·움직임",
    idea: "패스 대신 바로 옆에서 손으로 공을 건네주는 것. 코트에서는 이중 호(⌒) 기호로 표시된다",
    tactic: "pistol-21-action",
  },
  {
    term: "하이 포스트 / 로우 포스트",
    en: "High / Low post",
    group: "코트·움직임",
    idea: "자유투 라인 근처가 하이 포스트, 골대 옆 페인트존 아래쪽이 로우 포스트",
  },
  {
    term: "페인트존",
    en: "Paint",
    group: "코트·움직임",
    idea: "골대 앞 직사각형 구역. 코트 그림에서 색이 살짝 다르게 칠해진 곳이다",
  },
  {
    term: "스페이싱",
    en: "Spacing",
    group: "코트·움직임",
    idea: "선수들이 서로 충분히 떨어져 서서 돌파 길과 패스 길을 열어두는 것",
    tactic: "beat-3-2-zone-yunho",
  },
];

export const GLOSSARY_GROUPS = ["픽앤롤 수비 콜", "매치업", "코트·움직임"];
