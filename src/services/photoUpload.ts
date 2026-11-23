// Envoi des photos en arrière-plan : l'instant est enregistré tout de suite,
// la photo part ensuite pendant que vous continuez à utiliser l'app.
import { compressPhoto } from './photoService';
import { uploadPhoto, trashPhoto } from './db';
import { useMemoryStore } from '../stores/memoryStore';
import { showNotice } from '../stores/undoStore';

let active = 0;

export function queuePhotoUpload(memoryId: string, file: File, previousFileId?: string) {
  const preview = URL.createObjectURL(file);
  useMemoryStore.getState().setLocalPhoto(memoryId, preview);
  run(memoryId, file, previousFileId, preview);
}

async function run(memoryId: string, file: File, previousFileId: string | undefined, preview: string) {
  active++;
  showNotice(active > 1 ? `Envoi de ${active} photos…` : 'Envoi de la photo en arrière-plan…', undefined, undefined, 0);
  try {
    const compressed = await compressPhoto(file);
    const uploaded = await uploadPhoto(compressed);
    await useMemoryStore.getState().updateMemory(memoryId, { photo_url: uploaded.url, photo_file_id: uploaded.file_id });
    trashPhoto(previousFileId);
    URL.revokeObjectURL(preview);
    active--;
    showNotice(active > 0 ? `Encore ${active} photo${active > 1 ? 's' : ''} en cours…` : 'Photo enregistrée.', undefined, undefined, active > 0 ? 0 : 3000);
  } catch (e: any) {
    active--;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    showNotice(
      offline ? "Pas de réseau : la photo n'est pas encore envoyée." : `La photo n'a pas pu être envoyée (${e?.message || 'erreur'}).`,
      () => run(memoryId, file, previousFileId, preview),
      'Réessayer',
      0
    );
  }
}
