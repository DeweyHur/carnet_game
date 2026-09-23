// 손으로 쓴 장소들을 지구별 파일에서 모아 하나로. 이름 regex로 찾으므로 지구가 섞여도 안전하다.
import { RICH } from './marais';
import { RICH_SG } from './saintgermain';

export const ALL_RICH = [...RICH, ...RICH_SG];
