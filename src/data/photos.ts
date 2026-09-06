import manifest from './photoManifest.json';

export interface TravelPhoto {
  id: string; src: string; thumb: string; title: string; author: string;
  license: string; licenseUrl: string; sourceUrl: string;
  width: number; height: number; changes: string;
}
export const PHOTOS: Record<string, TravelPhoto> = manifest;
const aliases: Record<string, string> = {
  'boulogne:albert-kahn': 'boulogne', 'saint-denis:basilica': 'saint-denis',
  'versailles:chateau': 'versailles', 'chartres:chartres-cath': 'chartres',
  'amiens:amiens-cath': 'amiens', 'reims:reims-cath': 'reims',
  'rouen:gros-horloge': 'rouen', 'lille:vieille-bourse': 'lille', 'orleans:orleans-cath': 'orleans',
};
export const photoById = (id: string) => PHOTOS[aliases[id] ?? id];
export const cityPhotos = (cityId: string) => Object.values(PHOTOS).filter((p) => p.id === cityId || p.id.startsWith(`${cityId}:`));
export const placePhoto = (cityId: string, poiId: string) => photoById(`${cityId}:${poiId}`);
