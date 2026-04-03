import { SpriteSheet, Collection } from '@/types/sprite';

const SPRITES_KEY = 'sprite-gen-sprites';
const COLLECTIONS_KEY = 'sprite-gen-collections';

export function getSprites(): SpriteSheet[] {
  try {
    const data = localStorage.getItem(SPRITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveSprites(sprites: SpriteSheet[]) {
  localStorage.setItem(SPRITES_KEY, JSON.stringify(sprites));
}

export function addSprite(sprite: SpriteSheet) {
  const sprites = getSprites();
  sprites.unshift(sprite);
  saveSprites(sprites);
  return sprites;
}

export function deleteSprites(ids: string[]) {
  const sprites = getSprites().filter(s => !ids.includes(s.id));
  saveSprites(sprites);
  return sprites;
}

export function getCollections(): Collection[] {
  try {
    const data = localStorage.getItem(COLLECTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveCollections(collections: Collection[]) {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function addCollection(collection: Collection) {
  const collections = getCollections();
  collections.unshift(collection);
  saveCollections(collections);
  return collections;
}

export function deleteCollection(id: string) {
  const collections = getCollections().filter(c => c.id !== id);
  saveCollections(collections);
  // Remove collection from all sprites
  const sprites = getSprites().map(s => ({
    ...s,
    collectionIds: s.collectionIds.filter(cid => cid !== id),
  }));
  saveSprites(sprites);
  return { collections, sprites };
}

export function addSpriteToCollection(spriteId: string, collectionId: string) {
  const sprites = getSprites().map(s =>
    s.id === spriteId && !s.collectionIds.includes(collectionId)
      ? { ...s, collectionIds: [...s.collectionIds, collectionId] }
      : s
  );
  saveSprites(sprites);
  return sprites;
}

export function removeSpriteFromCollection(spriteId: string, collectionId: string) {
  const sprites = getSprites().map(s =>
    s.id === spriteId
      ? { ...s, collectionIds: s.collectionIds.filter(cid => cid !== collectionId) }
      : s
  );
  saveSprites(sprites);
  return sprites;
}
