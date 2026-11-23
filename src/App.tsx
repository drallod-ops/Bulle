import React, { useState, useEffect } from 'react';
import { Sofa, Image, Users, Sparkles, HandHeart, Camera, X, UserRound } from 'lucide-react';
import { useMemoryStore } from './stores/memoryStore';
import { useGameStore } from './stores/gameStore';
import { useBucketStore } from './stores/bucketStore';
import { usePrayerStore } from './stores/prayerStore';
import { useCollectionStore } from './stores/collectionStore';
import { useCustomContentStore } from './stores/customContentStore';
import { HomePage } from './pages/Home';
import { ColorEditor } from './pages/ColorEditor';
// Import direct (pas de chargement différé) : toutes les pages restent
// disponibles hors ligne, même celles jamais ouvertes.
import { InstantsPage } from './pages/Instants';
import { AdeuxPage } from './pages/Adeux';
import { EnviesPage } from './pages/Envies';
import { PrayerPage } from './pages/Prayer';
import { Button, Modal, ErrorBanner, Spinner } from './components/UI';
import { DEFAULT_GAMES } from './services/adeuxContent';
import { uploadPhoto, trashPhoto } from './services/db';
import { config, refresh, onRefresh } from './services/api';
import { pullSharedSettingsToLocal } from './services/settings';
import { SetupScreen, AccountModal, SyncBadge } from './components/Account';
import { compressPhoto, extractPhotoMetadata, reverseGeocodeCity } from './services/photoService';
import { BucketItem, PrayerTopic, Memory } from './types';
import { T, CONTEXT, SOURCE_COLORS, SOURCE_LABELS, ThemeName, THEME_ORDER, applyTheme, chooseTheme, getStoredTheme } from './theme';
import { applyStoredOverrides } from './services/colorOverrides';

type Source = 'manual' | 'game' | 'bucket' | 'prayer';
type Tab = 'sofa' | 'instants' | 'adeux' | 'envies' | 'priere';

interface MemoryPrefill {
  text?: string;
  source: Source;
  source_id?: string;
}

function App() {
  const [ready, setReady] = useState(config.isReady());
  if (!ready) return <SetupScreen onDone={() => setReady(true)} />;
  return <AppContent onLogout={() => setReady(false)} />;
}

function AppContent({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('sofa');
  const [theme, setTheme] = useState<ThemeName>(getStoredTheme());
  const [showCreateMemory, setShowCreateMemory] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftSource, setDraftSource] = useState<Source>('manual');
  const [draftSourceId, setDraftSourceId] = useState<string | undefined>(undefined);
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null);
  const [draftPhotoPreview, setDraftPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    applyStoredOverrides();
  }, [theme]);

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    chooseTheme(next);
    setTheme(next);
  };

  // Stores
  const setGames = useGameStore((state) => state.setGames);
  const loadSessions = useGameStore((state) => state.loadSessions);
  const addMemory = useMemoryStore((state) => state.addMemory);
  const memories = useMemoryStore((state) => state.memories);
  const updateMemoryAction = useMemoryStore((state) => state.updateMemory);
  const loadMemories = useMemoryStore((state) => state.loadMemories);
  const loadBucketItems = useBucketStore((state) => state.loadItems);
  const loadPrayerTopics = usePrayerStore((state) => state.loadTopics);
  const loadCollections = useCollectionStore((state) => state.loadCollections);
  const loadCustomContent = useCustomContentStore((state) => state.loadCustomContent);

  useEffect(() => {
    setGames(DEFAULT_GAMES);
    const loadAll = () => {
      loadMemories();
      loadBucketItems();
      loadPrayerTopics();
      loadCollections();
      loadCustomContent();
      loadSessions();
    };
    // 1. Affichage immédiat depuis la copie locale.
    loadAll();
    // 2. Quand le Sheets répond, on recharge tout (y compris les réglages partagés).
    const unsubscribe = onRefresh(() => {
      pullSharedSettingsToLocal();
      setTheme(getStoredTheme());
      applyStoredOverrides();
      loadAll();
    });
    const sync = () => refresh().catch(() => undefined);
    sync();
    // 3. On resynchronise au retour sur l'app et toutes les 2 minutes,
    //    pour voir ce que l'autre a ajouté.
    const onVisible = () => document.visibilityState === 'visible' && sync();
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => document.visibilityState === 'visible' && sync(), 120000);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [setGames, loadMemories, loadBucketItems, loadPrayerTopics, loadCollections, loadCustomContent, loadSessions]);

  const openCreateMemory = (prefill?: MemoryPrefill) => {
    setEditingId(null);
    setDraftText(prefill?.text || '');
    setDraftLocation('');
    setDraftDate(new Date().toISOString().slice(0, 10));
    setDraftSource(prefill?.source || 'manual');
    setDraftSourceId(prefill?.source_id);
    setDraftPhotoFile(null);
    setDraftPhotoPreview(null);
    setRemovePhoto(false);
    setSaveError(null);
    setShowCreateMemory(true);
  };

  const openEditMemory = (memory: Memory) => {
    setEditingId(memory.id);
    setDraftText(memory.text);
    setDraftLocation(memory.location || '');
    setDraftDate(memory.date ? memory.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setDraftSource(memory.source);
    setDraftSourceId(memory.source_id);
    setDraftPhotoFile(null);
    setDraftPhotoPreview(memory.photo_url || null);
    setRemovePhoto(false);
    setSaveError(null);
    setShowCreateMemory(true);
  };

  const [locatingPhoto, setLocatingPhoto] = useState(false);

  const handlePhotoSelect = (file: File | null) => {
    setDraftPhotoFile(file);
    setRemovePhoto(file === null);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setDraftPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);

      // Préremplissage depuis les métadonnées EXIF (date + lieu), sans
      // bloquer l'UI ; l'utilisateur peut toujours corriger ensuite.
      setLocatingPhoto(true);
      extractPhotoMetadata(file)
        .then(async (meta) => {
          if (meta.date) setDraftDate(meta.date.slice(0, 10));
          if (meta.latitude != null && meta.longitude != null) {
            const city = await reverseGeocodeCity(meta.latitude, meta.longitude);
            if (city) setDraftLocation(city);
          }
        })
        .finally(() => setLocatingPhoto(false));
    } else {
      setDraftPhotoPreview(null);
    }
  };

  const handleCreateMemory = async () => {
    if (!draftText.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      let photo_url: string | undefined;
      let photo_file_id: string | undefined;
      if (draftPhotoFile) {
        try {
          const compressed = await compressPhoto(draftPhotoFile);
          const uploaded = await uploadPhoto(compressed);
          photo_url = uploaded.url;
          photo_file_id = uploaded.file_id;
        } catch (photoErr: any) {
          throw new Error(
            navigator.onLine === false
              ? "Pas de réseau : la photo n'a pas pu être envoyée. Réessayez une fois connecté."
              : `Échec de l'envoi de la photo : ${photoErr?.message || photoErr}`
          );
        }
      }
      const previousFileId = editingId ? memories.find((m) => m.id === editingId)?.photo_file_id : undefined;

      if (editingId) {
        const updates: Partial<Memory> = {
          text: draftText.trim(),
          date: draftDate ? new Date(draftDate).toISOString() : undefined,
          location: draftLocation || undefined,
          source: draftSource,
          source_id: draftSourceId,
          updated_at: new Date().toISOString(),
        };
        if (photo_url) {
          updates.photo_url = photo_url;
          updates.photo_file_id = photo_file_id;
          trashPhoto(previousFileId);
        } else if (removePhoto) {
          updates.photo_url = null as any;
          updates.photo_file_id = null as any;
          trashPhoto(previousFileId);
        }
        await updateMemoryAction(editingId, updates);
      } else {
        const memory = {
          text: draftText.trim(),
          date: draftDate ? new Date(draftDate).toISOString() : new Date().toISOString(),
          // L'ambiance n'est plus choisie manuellement : la couleur affichée
          // dépend désormais automatiquement de ce à quoi l'instant est lié
          // (voir SOURCE_COLORS). On garde une valeur neutre par défaut.
          ambiance: 'calme' as any,
          location: draftLocation || undefined,
          source: draftSource,
          source_id: draftSourceId,
          photo_url,
          photo_file_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await addMemory(memory);
      }
      setShowCreateMemory(false);
      setEditingId(null);
    } catch (e: any) {
      setSaveError(e?.message || "Une erreur est survenue lors de l'enregistrement.");
    }
    setSaving(false);
  };

  const knownLocations = React.useMemo(
    () => Array.from(new Set(memories.map((m) => m.location).filter(Boolean))) as string[],
    [memories]
  );

  const handleCreateMemoryForBucket = (item: BucketItem) => {
    openCreateMemory({ text: item.title, source: 'bucket', source_id: item.id });
  };

  const handleCreateMemoryForPrayer = (topic: PrayerTopic) => {
    openCreateMemory({ text: topic.title, source: 'prayer', source_id: topic.id });
  };

  const handleCreateMemoryForAdeux = (prefill: { text: string; source_id: string }) => {
    openCreateMemory({ text: prefill.text, source: 'game', source_id: prefill.source_id });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: T.paper,
        fontFamily: T.font,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.ink }}>Bulle</h1>
        <div className="row">
          <SyncBadge />
          <button onClick={() => setShowAccount(true)} className="icon-btn" aria-label="Vous deux">
            <UserRound size={20} color={T.sage} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {tab === 'sofa' && (
          <HomePage onNavigate={(t) => setTab(t as Tab)} theme={theme} onCycleTheme={cycleTheme} onOpenColorEditor={() => setShowColorEditor(true)} />
        )}
        <React.Suspense fallback={<Spinner />}>
          {tab === 'instants' && <InstantsPage onCreateClick={() => openCreateMemory()} onEditClick={openEditMemory} />}
          {tab === 'adeux' && <AdeuxPage onCreateMemoryFor={handleCreateMemoryForAdeux} />}
          {tab === 'envies' && <EnviesPage onCreateMemoryFor={handleCreateMemoryForBucket} />}
          {tab === 'priere' && <PrayerPage onCreateMemoryFor={handleCreateMemoryForPrayer} />}
        </React.Suspense>
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: T.surface,
          borderTop: `1px solid ${T.border}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
          gap: 8,
        }}
      >
        <NavButton icon={<Sofa size={20} />} label="Le Sofa" active={tab === 'sofa'} color={T.sage} onClick={() => setTab('sofa')} />
        <NavButton icon={<Image size={20} />} label="Instants" active={tab === 'instants'} color={CONTEXT.instants} onClick={() => setTab('instants')} />
        <NavButton icon={<Users size={20} />} label="À deux" active={tab === 'adeux'} color={CONTEXT.adeux} onClick={() => setTab('adeux')} />
        <NavButton icon={<Sparkles size={20} />} label="Envies" active={tab === 'envies'} color={CONTEXT.envies} onClick={() => setTab('envies')} />
        <NavButton icon={<HandHeart size={20} />} label="Prière" active={tab === 'priere'} color={CONTEXT.priere} onClick={() => setTab('priere')} />
      </div>

      {/* Create Memory (Instant) Modal */}
      <Modal isOpen={showCreateMemory} onClose={() => setShowCreateMemory(false)} title={editingId ? 'Modifier l\'instant' : 'Créer un instant'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {saveError && <ErrorBanner message={saveError} />}
          <div>
            <label style={{ fontSize: 12, color: T.muted, display: 'block', marginBottom: 8 }}>
              Lié à...
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setDraftSource(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: draftSource === s ? `1px solid ${SOURCE_COLORS[s]}` : `1px solid ${T.border}`,
                    background: draftSource === s ? SOURCE_COLORS[s] : 'transparent',
                    color: draftSource === s ? '#fff' : T.muted,
                    fontSize: 12,
                    fontFamily: T.font,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <textarea
            placeholder="Raconte ce moment..."
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            autoFocus
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              padding: '12px 16px',
              fontFamily: T.font,
              fontSize: 14,
              minHeight: 100,
              outline: 'none',
              resize: 'none',
              color: T.ink,
              background: T.surface,
            }}
          />

          <div>
            <label style={{ fontSize: 12, color: T.muted, display: 'block', marginBottom: 8 }}>
              Photo (optionnelle)
            </label>
            {draftPhotoPreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={draftPhotoPreview}
                  alt=""
                  style={{ width: '100%', maxHeight: 180, borderRadius: T.radius, objectFit: 'cover' }}
                />
                <button
                  onClick={() => handlePhotoSelect(null)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.55)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} color="#fff" />
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: `1px dashed ${T.border}`,
                  borderRadius: T.radius,
                  padding: '16px',
                  color: T.muted,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Camera size={18} />
                Ajouter une photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              style={{
                flex: 1,
                border: `1px solid ${T.border}`,
                borderRadius: T.radius,
                padding: '12px 16px',
                fontFamily: T.font,
                fontSize: 14,
                outline: 'none',
                color: T.ink,
                background: T.surface,
              }}
            />
            <input
              type="text"
              placeholder={locatingPhoto ? 'Détection du lieu...' : 'Lieu (optionnel)'}
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.target.value)}
              list="known-locations"
              style={{
                flex: 1,
                border: `1px solid ${T.border}`,
                borderRadius: T.radius,
                padding: '12px 16px',
                fontFamily: T.font,
                fontSize: 14,
                outline: 'none',
                color: T.ink,
                background: T.surface,
              }}
            />
            <datalist id="known-locations">
              {knownLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button full variant="secondary" onClick={() => setShowCreateMemory(false)}>
              Annuler
            </Button>
            <Button full onClick={handleCreateMemory} disabled={!draftText.trim() || saving}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Garder ce moment'}
            </Button>
          </div>
        </div>
      </Modal>
      {showColorEditor && <ColorEditor theme={theme} onClose={() => setShowColorEditor(false)} />}
      <AccountModal isOpen={showAccount} onClose={() => setShowAccount(false)} onLogout={onLogout} />
    </div>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, active, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: active ? color : T.muted,
      fontSize: 10,
      fontFamily: T.font,
      fontWeight: active ? 700 : 500,
      transition: 'color 0.2s',
    }}
  >
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 26,
        borderRadius: 14,
        background: active ? `${color}20` : 'transparent',
        transition: 'background 0.2s',
      }}
    >
      {icon}
    </span>
    {label}
  </button>
);

export default App;
