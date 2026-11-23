import React, { useState, useEffect } from 'react';
import { Sofa, Image, Users, Sparkles, HandHeart, Camera, X, UserRound, Plus } from 'lucide-react';
import { UndoToast } from './components/Feedback';
import { QuickAdd } from './components/QuickAdd';
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
import { Button, Modal, ErrorBanner } from './components/UI';
import { DEFAULT_GAMES } from './services/adeuxContent';
import { trashPhoto } from './services/db';
import { queuePhotoUpload } from './services/photoUpload';
import { config, refresh, onRefresh } from './services/api';
import { pullSharedSettingsToLocal } from './services/settings';
import { SetupScreen, AccountModal, SyncBadge } from './components/Account';
import { extractPhotoMetadata, reverseGeocodeCity } from './services/photoService';
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [initialGame, setInitialGame] = useState<string | null>(null);

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
      // La photo est envoyée en arrière-plan, après l'enregistrement de l'instant.
      const photo_url: string | undefined = undefined;
      const photo_file_id: string | undefined = undefined;
      const photoToSend = draftPhotoFile;
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
        if (removePhoto && !photoToSend) {
          updates.photo_url = null as any;
          updates.photo_file_id = null as any;
          trashPhoto(previousFileId);
        }
        await updateMemoryAction(editingId, updates);
        if (photoToSend) queuePhotoUpload(editingId, photoToSend, previousFileId);
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
        const saved = await addMemory(memory);
        if (photoToSend && saved) queuePhotoUpload(saved.id, photoToSend);
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
      {/* En-tête : titre de la page, bordé d'une frise façon tapis mosaïque */}
      <header className="app-header">
        <h1 className="app-title">{TAB_TITLES[tab]}</h1>
        <div className="row">
          <SyncBadge />
          <button onClick={() => setShowAccount(true)} className="icon-btn" aria-label="Vous deux">
            <UserRound size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        {tab === 'sofa' && (
          <HomePage
            onNavigate={(t, game) => { setInitialGame(game || null); setTab(t as Tab); }}
            theme={theme}
            onCycleTheme={cycleTheme}
            onOpenColorEditor={() => setShowColorEditor(true)}
          />
        )}
        {tab === 'instants' && <InstantsPage onCreateClick={() => openCreateMemory()} onEditClick={openEditMemory} />}
        {tab === 'adeux' && <AdeuxPage onCreateMemoryFor={handleCreateMemoryForAdeux} initialGame={initialGame} />}
        {tab === 'envies' && <EnviesPage onCreateMemoryFor={handleCreateMemoryForBucket} />}
        {tab === 'priere' && <PrayerPage onCreateMemoryFor={handleCreateMemoryForPrayer} />}
      </main>

      <button className="fab" onClick={() => setShowQuickAdd(true)} aria-label="Ajouter un instant, une envie ou une prière">
        <Plus size={26} />
      </button>
      <UndoToast />
      <QuickAdd
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onInstant={() => { setShowQuickAdd(false); openCreateMemory(); }}
        defaultKind={tab === 'priere' ? 'priere' : tab === 'instants' ? 'instant' : 'envie'}
      />

      {/* Navigation : le « parquet », en lames de bois rayé */}
      <nav className="app-nav" aria-label="Sections">
        <NavButton icon={<Sofa size={21} />} label="Accueil" active={tab === 'sofa'} onClick={() => setTab('sofa')} />
        <NavButton icon={<Image size={21} />} label="Instants" active={tab === 'instants'} onClick={() => setTab('instants')} />
        <NavButton icon={<Users size={21} />} label="À deux" active={tab === 'adeux'} onClick={() => { setInitialGame(null); setTab('adeux'); }} />
        <NavButton icon={<Sparkles size={21} />} label="Envies" active={tab === 'envies'} onClick={() => setTab('envies')} />
        <NavButton icon={<HandHeart size={21} />} label="Prière" active={tab === 'priere'} onClick={() => setTab('priere')} />
      </nav>

      {/* Create Memory (Instant) Modal */}
      <Modal isOpen={showCreateMemory} onClose={() => setShowCreateMemory(false)} title={editingId ? 'Modifier l\'instant' : 'Créer un instant'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {saveError && <ErrorBanner message={saveError} />}
          <div>
            <label style={{ fontSize: 13, color: T.muted, display: 'block', marginBottom: 8 }}>
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
                    fontSize: 13,
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
            <label style={{ fontSize: 13, color: T.muted, display: 'block', marginBottom: 8 }}>
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

const TAB_TITLES: Record<string, string> = { sofa: 'Bulle', instants: 'Instants', adeux: 'À deux', envies: 'Envies', priere: 'Prière' };

const NavButton: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button className={`nav-btn${active ? ' on' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
    <span className="nav-pill">{icon}</span>
    {label}
  </button>
);

export default App;
