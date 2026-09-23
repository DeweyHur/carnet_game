// 손으로 쓴 장소들을 지구별 파일에서 모아 하나로. 이름 regex로 찾으므로 지구가 섞여도 안전하다.
import { RICH } from './marais';
import { RICH_SG } from './saintgermain';
import { RICH_MONTMARTRE } from './montmartre';
import { RICH_BELLEVILLE } from './belleville';
import { RICH_CHAMPS } from './champs';

export const ALL_RICH = [...RICH, ...RICH_SG, ...RICH_MONTMARTRE, ...RICH_BELLEVILLE, ...RICH_CHAMPS];
