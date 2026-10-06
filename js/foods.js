/* ============================================================
   foods.js — 음식 / 운동 데이터베이스
   실제 서비스에서는 온디바이스 모델 + 식약처 영양 DB를 사용합니다.
   여기서는 발표 데모용 샘플 데이터를 사용합니다.
   ============================================================ */

/* 각 음식: 1인분 기준 추정 영양값 */
window.FOOD_DB = [
  {
    id: 'bibimbap',
    name: '비빔밥',
    emoji: '🍚',
    image: 'https://sspark.genspark.ai/i/QbRLCy3BaMUx0Q4T?width=1200',
    kcal: 586,
    carbs: 88,
    protein: 21,
    fat: 16,
    micro: { '식이섬유': '6.2g', '나트륨': '980mg', '비타민A': '320µg', '철분': '3.1mg' },
    allergens: ['계란', '참깨', '대두'],
    tags: ['한식', '밥류']
  },
  {
    id: 'burger',
    name: '치즈버거 세트',
    emoji: '🍔',
    image: 'https://sspark.genspark.ai/i/ABe5I8WuSej1TShF?width=1200',
    kcal: 842,
    carbs: 74,
    protein: 32,
    fat: 44,
    micro: { '식이섬유': '3.4g', '나트륨': '1420mg', '포화지방': '17g', '콜레스테롤': '68mg' },
    allergens: ['밀', '유제품', '계란', '대두'],
    tags: ['패스트푸드']
  },
  {
    id: 'salad',
    name: '그린 샐러드',
    emoji: '🥗',
    image: 'https://sspark.genspark.ai/i/GS2Qut3AKfWW4H6t?width=1200',
    kcal: 218,
    carbs: 19,
    protein: 9,
    fat: 12,
    micro: { '식이섬유': '7.8g', '나트륨': '310mg', '비타민C': '46mg', '엽산': '128µg' },
    allergens: ['유제품'],
    tags: ['샐러드', '저칼로리']
  },
  {
    id: 'pizza',
    name: '마르게리타 피자',
    emoji: '🍕',
    image: 'https://sspark.genspark.ai/i/gwjcfEYlve65IYQQ?width=1200',
    kcal: 702,
    carbs: 82,
    protein: 28,
    fat: 28,
    micro: { '식이섬유': '4.1g', '나트륨': '1180mg', '칼슘': '420mg', '포화지방': '12g' },
    allergens: ['밀', '유제품'],
    tags: ['양식', '분식']
  },
  {
    id: 'ramen',
    name: '라면 (1봉지)',
    emoji: '🍜',
    image: 'https://sspark.genspark.ai/i/2KFm4VIybSco5sQf?width=1200',
    kcal: 505,
    carbs: 79,
    protein: 11,
    fat: 16,
    micro: { '식이섬유': '2.6g', '나트륨': '1790mg', '포화지방': '7g', '칼슘': '150mg' },
    allergens: ['밀', '대두', '계란'],
    tags: ['분식', '고나트륨']
  },
  {
    id: 'chicken',
    name: '닭가슴살 샐러드',
    emoji: '🍗',
    image: 'https://sspark.genspark.ai/i/vO3ZI19moJeY0utG?width=1200',
    kcal: 342,
    carbs: 14,
    protein: 42,
    fat: 11,
    micro: { '식이섬유': '4.9g', '나트륨': '480mg', '단백질': '42g', '비타민B6': '0.9mg' },
    allergens: ['닭고기'],
    tags: ['고단백', '저칼로리']
  }
];

/* 운동: MET(대사당량) 기반. 1분당 소모 = MET * 3.5 * 체중kg / 200 */
window.WORKOUT_DB = [
  { id: 'jog', name: '조깅', emoji: '🏃', met: 8.3, intensity: '중강도 유산소', note: '심폐 지구력 향상' },
  { id: 'yoga', name: '요가', emoji: '🧘', met: 3.0, intensity: '저강도 유연성', note: '코어 안정 · 스트레스 완화' },
  { id: 'strength', name: '근력운동', emoji: '💪', met: 6.0, intensity: '중강도 무산소', note: '기초대사량 증가' },
  { id: 'walk', name: '빠르게 걷기', emoji: '🚶', met: 4.3, intensity: '저강도 유산소', note: '식후 혈당 관리' },
  { id: 'cycle', name: '사이클', emoji: '🚴', met: 7.5, intensity: '중강도 유산소', note: '하체 근지구력' },
  { id: 'stairs', name: '계단 오르기', emoji: '🪜', met: 8.8, intensity: '고강도 유산소', note: '짧은 시간 고효율' }
];

/* 알레르기 위험 성분 목록 (데모용 사용자 프로필) */
window.USER_ALLERGENS = ['계란', '대두', '유제품'];

/* ============================================================
   대전 저칼로리 식당 큐레이션 (600kcal 이하)
   ------------------------------------------------------------
   ※ 실제 음식점의 상호·영업시간은 시시각각 변동되므로 이 데모에는
     하드코딩하지 않습니다. 대신 "대전 실제 행정동 + 저칼로리 메뉴 유형"
     조합을 제공하고, 네이버 지도 검색 링크로 최신 영업 정보를
     확인하도록 연결합니다. kcal은 해당 메뉴 유형의 일반적 1인분 추정값입니다.
   ============================================================ */
window.DAEJEON_SPOTS = [
  {
    id: 'spot-salad-yh',
    district: '중구',
    area: '은행동 · 으능정이 문화의거리',
    menu: '샐러드 · 포케볼',
    emoji: '🥗',
    keyword: '대전 은행동 샐러드',
    kcal: 380, carbs: 42, protein: 26, fat: 12,
    note: '드레싱을 오일·발사믹으로 바꾸면 100kcal 이상 줄일 수 있습니다.',
    tags: ['고단백', '채소', '도보접근']
  },
  {
    id: 'spot-soba-dh',
    district: '중구',
    area: '대흥동 · 중앙시장 인근',
    menu: '메밀 소바 · 냉모밀',
    emoji: '🍜',
    keyword: '대전 대흥동 메밀 소바',
    kcal: 420, carbs: 68, protein: 18, fat: 8,
    note: '국물은 남기고 면만 먹으면 나트륨 섭취를 크게 줄일 수 있습니다.',
    tags: ['저지방', '시장', '가성비']
  },
  {
    id: 'spot-juk-sh',
    district: '중구',
    area: '선화동 · 중앙로역 인근',
    menu: '죽 · 수프 전문',
    emoji: '🥣',
    keyword: '대전 선화동 죽 전문점',
    kcal: 260, carbs: 44, protein: 9, fat: 5,
    note: '속이 편하고 칼로리가 가장 낮은 선택지. 단백질은 부족합니다.',
    tags: ['최저칼로리', '소화편안']
  },
  {
    id: 'spot-dosirak-ds',
    district: '서구',
    area: '둔산동 · 시청 인근',
    menu: '닭가슴살 도시락',
    emoji: '🍱',
    keyword: '대전 둔산동 닭가슴살 도시락',
    kcal: 450, carbs: 52, protein: 38, fat: 10,
    note: '직장인 점심으로 가장 균형 잡힌 조합. 현미밥 선택을 권합니다.',
    tags: ['고단백', '직장인', '식단관리']
  },
  {
    id: 'spot-syabu-tb',
    district: '서구',
    area: '탄방동 · 탄방역 인근',
    menu: '채소 샤브샤브',
    emoji: '🍲',
    keyword: '대전 탄방동 샤브샤브',
    kcal: 520, carbs: 38, protein: 34, fat: 22,
    note: '고기 양을 절반으로 줄이고 채소를 늘리면 400kcal대까지 내려갑니다.',
    tags: ['채소', '저녁', '단체가능']
  },
  {
    id: 'spot-tofu-gj',
    district: '서구',
    area: '관저동 · 관저고 인근',
    menu: '두부 요리 (순두부·두부김치)',
    emoji: '🥘',
    keyword: '대전 관저동 두부 요리',
    kcal: 340, carbs: 22, protein: 24, fat: 16,
    note: '밥은 반 공기만. 순두부찌개는 국물을 적게 먹는 게 좋습니다.',
    tags: ['식물성단백질', '저녁']
  },
  {
    id: 'spot-poke-gung',
    district: '유성구',
    area: '궁동 · 충남대 정문 앞',
    menu: '포케볼 · 샐러드볼',
    emoji: '🐟',
    keyword: '대전 궁동 포케',
    kcal: 460, carbs: 55, protein: 28, fat: 14,
    note: '연어 대신 참치·닭가슴살을 고르면 지방을 더 줄일 수 있습니다.',
    tags: ['학생가', '고단백', '한끼']
  },
  {
    id: 'spot-mulhoe-bm',
    district: '유성구',
    area: '봉명동 · 유성온천역 인근',
    menu: '물회 · 회덮밥',
    emoji: '🐠',
    keyword: '대전 봉명동 물회',
    kcal: 300, carbs: 26, protein: 28, fat: 7,
    note: '여름철 최적. 초고추장은 따로 받아 소량만 사용하세요.',
    tags: ['저지방', '고단백', '여름']
  },
  {
    id: 'spot-yogurt-dr',
    district: '유성구',
    area: '도룡동 · 엑스포 인근',
    menu: '그릭요거트 · 아사이볼',
    emoji: '🍨',
    keyword: '대전 도룡동 그릭요거트',
    kcal: 280, carbs: 38, protein: 14, fat: 8,
    note: '간식 대체용으로 좋습니다. 시럽 추가는 칼로리를 크게 올립니다.',
    tags: ['간식', '카페', '가벼움']
  },
  {
    id: 'spot-bibim-gy',
    district: '동구',
    area: '가양동 · 가양네거리 인근',
    menu: '비빔밥 (밥 반 공기)',
    emoji: '🍚',
    keyword: '대전 가양동 비빔밥',
    kcal: 430, carbs: 62, protein: 16, fat: 12,
    note: '기본 비빔밥(약 580kcal)에서 밥을 절반으로 줄인 기준입니다.',
    tags: ['한식', '채소', '가성비']
  },
  {
    id: 'spot-chicken-dd',
    district: '동구',
    area: '대동 · 대전역 동광장 인근',
    menu: '닭가슴살 샐러드',
    emoji: '🍗',
    keyword: '대전 대동 닭가슴살 샐러드',
    kcal: 360, carbs: 20, protein: 36, fat: 12,
    note: '기차 타기 전 가볍게 먹기 좋은 위치입니다.',
    tags: ['고단백', '역세권']
  },
  {
    id: 'spot-mushroom-st',
    district: '대덕구',
    area: '신탄진동 · 신탄진역 인근',
    menu: '버섯 샤브샤브',
    emoji: '🍄',
    keyword: '대전 신탄진 버섯 샤브샤브',
    kcal: 490, carbs: 44, protein: 30, fat: 18,
    note: '버섯 위주로 먹으면 포만감 대비 칼로리가 낮습니다.',
    tags: ['채소', '포만감', '저녁']
  }
];

/* 네이버 지도 검색 딥링크 생성 (API 키 불필요) */
window.naverMapSearchUrl = function (query) {
  return 'https://map.naver.com/p/search/' + encodeURIComponent(query);
};

/* 목표별 칼로리 계수 */
window.GOAL_PRESETS = {
  lose: { label: '체중 감량', factor: 0.82, tone: '#22d3ee' },
  keep: { label: '체중 유지', factor: 1.0, tone: '#4ade80' },
  gain: { label: '근육 증가', factor: 1.15, tone: '#a3e635' }
};

/* 활동 수준 계수 (TDEE) */
window.ACTIVITY_FACTORS = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
