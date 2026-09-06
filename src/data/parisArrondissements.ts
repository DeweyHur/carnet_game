// 파리 20개 구(區)의 대략적인 중심 좌표와 통칭. 도시 내부 지도(CityMap)에서
// 파리를 열었을 때만 배경 라벨로 표시한다 — 정밀한 구 경계 폴리곤 대신
// 각 구를 대표하는 한 지점의 라벨로 "파리는 20개 구로 나뉜다"는 감각을 준다.
export interface Arrondissement {
  num: number;
  name: string;
  nameEn: string;
  coord: [number, number];
}

export const PARIS_ARRONDISSEMENTS: Arrondissement[] = [
  { num: 1, name: '루브르', nameEn: 'Louvre', coord: [2.3376, 48.8606] },
  { num: 2, name: '부르스', nameEn: 'Bourse', coord: [2.3417, 48.8697] },
  { num: 3, name: '탕플', nameEn: 'Temple', coord: [2.3622, 48.863] },
  { num: 4, name: '오텔드빌', nameEn: 'Hôtel-de-Ville', coord: [2.3574, 48.8546] },
  { num: 5, name: '팡테옹', nameEn: 'Panthéon', coord: [2.3491, 48.8448] },
  { num: 6, name: '뤽상부르', nameEn: 'Luxembourg', coord: [2.3317, 48.8496] },
  { num: 7, name: '팔레부르봉', nameEn: 'Palais-Bourbon', coord: [2.308, 48.8562] },
  { num: 8, name: '엘리제', nameEn: 'Élysée', coord: [2.3125, 48.8718] },
  { num: 9, name: '오페라', nameEn: 'Opéra', coord: [2.3387, 48.8768] },
  { num: 10, name: '앙트르포', nameEn: 'Entrepôt', coord: [2.3601, 48.876] },
  { num: 11, name: '포피퀴에르', nameEn: 'Popincourt', coord: [2.3805, 48.859] },
  { num: 12, name: '렝시', nameEn: 'Reuilly', coord: [2.3963, 48.8339] },
  { num: 13, name: '고블랭', nameEn: 'Gobelins', coord: [2.3556, 48.8322] },
  { num: 14, name: '옵세르바투아르', nameEn: 'Observatoire', coord: [2.3256, 48.8286] },
  { num: 15, name: '보지라르', nameEn: 'Vaugirard', coord: [2.2928, 48.8412] },
  { num: 16, name: '파시', nameEn: 'Passy', coord: [2.2611, 48.8637] },
  { num: 17, name: '바티뇰몽소', nameEn: 'Batignolles-Monceau', coord: [2.3072, 48.8874] },
  { num: 18, name: '뷔트몽마르트르', nameEn: 'Butte-Montmartre', coord: [2.3444, 48.8927] },
  { num: 19, name: '뷔트쇼몽', nameEn: 'Buttes-Chaumont', coord: [2.3822, 48.887] },
  { num: 20, name: '메닐몽탕', nameEn: 'Ménilmontant', coord: [2.4008, 48.8636] },
];
