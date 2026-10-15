import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  Heart,
  LockKeyhole,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  addWish as addRemoteWish,
  authenticateParticipant as authenticateWithSupabase,
  drawOnce,
  getCurrentParticipant,
  getParticipants,
  loadParticipantState,
  removeWish as removeRemoteWish,
  signOut,
  uploadAvatar,
  type Participant,
  type ParticipantProfile,
} from './lib/familyApi';
import { hasSupabaseConfig, supabase } from './lib/supabase';

const PARTICIPANTS = [
  'Nicolly',
  'Leonardo Senerine',
  'Leo Denardi',
  'Vanda',
  'Alex',
  'Pérola',
  'Tayonan',
  'Vânia',
  'Gabs',
  'Vitor',
  'Aurora',
  'Rodrigo',
  'Aguinaldo',
  'Bárbara',
  'Nilza',
  'Gabi',
  'Ingrid',
  'Amanda',
  'Andrey',
  'Sheila',
];

const STORAGE_KEY = 'amigo-secreto-familia-2026';
const FAMILY_PHOTOS = [
  { src: '/images/familia-encontro.jpeg', alt: 'A família reunida em um encontro ao ar livre', caption: 'Que bom quando a gente se reúne.', aspectRatio: 4 / 3 },
  { src: '/images/familia-festa.jpeg', alt: 'A família reunida em uma comemoração', caption: 'Um abraço desses vale tudo.', aspectRatio: 1080 / 1243 },
  { src: '/images/familia-corredor.jpeg', alt: 'Um momento espontâneo entre familiares', caption: 'Sempre cabe mais um no colo.', aspectRatio: 16 / 9 },
  { src: '/images/familia-retrato.jpeg', alt: 'Um retrato carinhoso de familiares', caption: 'Rindo de uma coisa que só a gente entende.', aspectRatio: 1080 / 1441 },
  { src: '/images/familia-encontro-2.jpeg', alt: 'A família reunida em frente de casa', caption: 'A família inteira, do nosso jeito.', aspectRatio: 4 / 3 },
  { src: '/images/familia-abraco.jpeg', alt: 'Duas familiares reunidas em um abraço', caption: 'Saudade boa de um dia feliz.', aspectRatio: 1 },
  { src: '/images/familia-hero.jpeg', alt: 'A família reunida na rede', caption: 'Todo mundo junto, até na rede.', aspectRatio: 1080 / 796 },
  { src: '/images/familia-hoje-01.jpeg', alt: 'Uma foto antiga de familiares reunidos', caption: 'Uma lembrança antiga que segue por perto.', aspectRatio: 1 },
  { src: '/images/familia-hoje-02.jpeg', alt: 'Uma criança da família em uma foto antiga', caption: 'Pequenos momentos que cresceram com a gente.', aspectRatio: 488 / 573 },
  { src: '/images/familia-hoje-03.jpeg', alt: 'Familiares juntos em um retrato', caption: 'Um retrato do nosso jeito.', aspectRatio: 800 / 527 },
  { src: '/images/familia-hoje-04.jpeg', alt: 'Crianças da família em uma foto antiga', caption: 'A bagunça boa de outros tempos.', aspectRatio: 480 / 288 },
  { src: '/images/familia-hoje-05.jpeg', alt: 'Familiares reunidos em uma fotografia', caption: 'Gente querida, sempre por perto.', aspectRatio: 4 / 3 },
  { src: '/images/familia-hoje-06.jpeg', alt: 'Mulheres da família reunidas para uma foto', caption: 'Um encontro para guardar.', aspectRatio: 4 / 3 },
  { src: '/images/familia-hoje-07.jpeg', alt: 'Familiares juntos em uma foto espontânea', caption: 'Mais uma história para contar.', aspectRatio: 1080 / 617 },
  { src: '/images/familia-hoje-08.jpeg', alt: 'Familiares em um momento de carinho', caption: 'Carinho que vira lembrança.', aspectRatio: 3 / 4 },
  { src: '/images/familia-hoje-09.jpeg', alt: 'Um abraço entre familiares', caption: 'Abraço apertado, coração cheio.', aspectRatio: 3 / 4 },
  { src: '/images/familia-hoje-10.jpeg', alt: 'Familiares reunidos em uma foto', caption: 'A família toda cabe numa foto.', aspectRatio: 714 / 680 },
  { src: '/images/familia-hoje-11.jpeg', alt: 'Uma foto quadrada de familiares', caption: 'Um dia simples, uma memória boa.', aspectRatio: 1 },
  { src: '/images/familia-hoje-12.jpeg', alt: 'Familiares reunidos para uma foto vertical', caption: 'Juntos, como sempre.', aspectRatio: 738 / 1600 },
  { src: '/images/familia-hoje-13.jpeg', alt: 'Familiares sorrindo para a câmera', caption: 'Sorrisos que a gente reconhece.', aspectRatio: 960 / 576 },
  { src: '/images/familia-hoje-14.jpeg', alt: 'Um registro espontâneo da família', caption: 'Mais um pedacinho da nossa história.', aspectRatio: 397 / 291 },
];

type AppData = {
  wishlists: Record<string, string[]>;
  photos: Record<string, string>;
  assignments: Record<string, string> | null;
  passwords: Record<string, PasswordCredential>;
};

type PasswordCredential = { salt: string; hash: string };

const EMPTY_DATA: AppData = { wishlists: {}, photos: {}, assignments: null, passwords: {} };

function readData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return EMPTY_DATA;
    const parsed = JSON.parse(stored) as Partial<AppData>;
    return {
      wishlists: parsed.wishlists ?? {},
      photos: parsed.photos ?? {},
      assignments: parsed.assignments ?? null,
      passwords: parsed.passwords ?? {},
    };
  } catch {
    return EMPTY_DATA;
  }
}

function encodeBytes(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' }, key, 256);
  return encodeBytes(new Uint8Array(hash));
}

async function createPasswordCredential(password: string): Promise<PasswordCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: encodeBytes(salt), hash: await hashPassword(password, salt) };
}

async function verifyPassword(password: string, credential: PasswordCredential) {
  return (await hashPassword(password, decodeBytes(credential.salt))) === credential.hash;
}

function createAssignments(): Record<string, string> {
  const shuffled = [...PARTICIPANTS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return Object.fromEntries(PARTICIPANTS.map((name, index) => [name, shuffled[index]]));
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const maxDimension = 420;
      const scale = Math.min(1, maxDimension / image.width, maxDimension / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Não foi possível processar esta imagem.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível abrir esta imagem.'));
    };
    image.src = objectUrl;
  });
}

function NotFoundPage() {
  useEffect(() => {
    document.title = 'Página não encontrada | Amigo secreto da família';
    return () => { document.title = 'Amigo secreto da família'; };
  }, []);

  return (
    <main className="not-found-page">
      <div className="not-found-photo">
        <img src="/images/familia-hero.jpeg" alt="A família reunida na rede" />
      </div>
      <section className="not-found-content">
        <a className="brand not-found-brand" href="/" aria-label="Voltar para Amigo secreto">
          <span className="brand-mark"><Gift size={19} /></span>
          <span>Amigo secreto</span>
        </a>
        <span className="not-found-code">404 · PÁGINA NÃO ENCONTRADA</span>
        <h1>Esse caminho ficou fora do sorteio.</h1>
        <p>Não encontramos este endereço. Vamos voltar para a nossa família?</p>
        <a className="not-found-link" href="/"><ArrowLeft size={17} /> Voltar para o início</a>
      </section>
    </main>
  );
}

function FamilyApp() {
  const [data, setData] = useState<AppData>(readData);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [drawSubmitting, setDrawSubmitting] = useState(false);
  const [wishInput, setWishInput] = useState('');
  const [filter, setFilter] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteReady, setRemoteReady] = useState(!hasSupabaseConfig);
  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [remoteWishIds, setRemoteWishIds] = useState<Record<string, string[]>>({});
  const [connectionError, setConnectionError] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [activePhoto, setActivePhoto] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);

  async function loadSharedState(profile: ParticipantProfile, directory: Participant[]) {
    const sharedState = await loadParticipantState(profile, directory);
    const wishlists: Record<string, string[]> = { [profile.name]: sharedState.wishes.map((wish) => wish.item) };
    if (sharedState.recipientName) {
      wishlists[sharedState.recipientName] = sharedState.recipientWishes.map((wish) => wish.item);
    }
    setData({
      wishlists,
      photos: sharedState.photos,
      assignments: sharedState.recipientName ? { [profile.name]: sharedState.recipientName } : null,
      passwords: {},
    });
    setRemoteWishIds({ [profile.name]: sharedState.wishes.map((wish) => wish.id) });
    setCurrentParticipantId(profile.id);
    setCurrentUserId(profile.userId);
    setCurrentName(profile.name);
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActivePhoto((current) => (current + 1) % FAMILY_PHOTOS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
    let active = true;
    const client = supabase;

    async function initializeSharedApp() {
      try {
        const directory = await getParticipants();
        if (!active) return;
        setParticipants(directory);
        setRemoteReady(true);
        const profile = await getCurrentParticipant();
        if (active && profile) await loadSharedState(profile, directory);
      } catch (error) {
        if (!active) return;
        setConnectionError(error instanceof Error ? error.message : 'Não foi possível conectar ao Supabase.');
      }
    }

    void initializeSharedApp();
    const { data: authState } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentName(null);
        setCurrentParticipantId(null);
        setCurrentUserId(null);
      }
    });

    return () => {
      active = false;
      authState.subscription.unsubscribe();
    };
  }, []);

  const recipient = currentName && data.assignments ? data.assignments[currentName] : null;
  const wishes = currentName ? data.wishlists[currentName] ?? [] : [];
  const recipientWishes = recipient ? data.wishlists[recipient] ?? [] : [];
  const selectedParticipant = authName ? participants.find((participant) => participant.name === authName) : null;
  const hasPassword = authName
    ? hasSupabaseConfig
      ? Boolean(selectedParticipant?.is_claimed)
      : Boolean(data.passwords[authName])
    : false;
  const participantNames = hasSupabaseConfig && remoteReady ? participants.map((participant) => participant.name) : PARTICIPANTS;
  const visibleParticipants = participantNames.filter((name) => name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));

  function chooseParticipant(name: string) {
    if (hasSupabaseConfig && !remoteReady) return;
    setAuthName(name);
    setAuthPassword('');
    setAuthConfirm('');
    setAuthError('');
  }

  async function authenticateParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authName) return;
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (hasSupabaseConfig) {
        const participant = participants.find((item) => item.name === authName);
        if (!participant) throw new Error('Não foi possível encontrar esse nome no grupo.');
        const profile = await authenticateWithSupabase(participant, authPassword, authConfirm);
        await loadSharedState(profile, participants);
        setParticipants((previous) => previous.map((item) => item.id === participant.id ? { ...item, is_claimed: true } : item));
        setAuthName(null);
        setAuthPassword('');
        setAuthConfirm('');
        setConnectionError('');
        return;
      }

      const credential = data.passwords[authName];
      if (credential) {
        if (!(await verifyPassword(authPassword, credential))) {
          setAuthError('Essa senha não confere. Tente novamente.');
          return;
        }
      } else {
        if (authPassword.length < 8) {
          setAuthError('Use uma senha com pelo menos 8 caracteres.');
          return;
        }
        if (authPassword !== authConfirm) {
          setAuthError('As senhas não são iguais.');
          return;
        }
        const newCredential = await createPasswordCredential(authPassword);
        setData((previous) => ({ ...previous, passwords: { ...previous.passwords, [authName]: newCredential } }));
      }
      setCurrentName(authName);
      setIsRevealed(false);
      setWishInput('');
      setPhotoError('');
      setAuthName(null);
      setAuthPassword('');
      setAuthConfirm('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível verificar a senha. Confira os dados e tente novamente.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function addWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wish = wishInput.trim();
    if (!currentName || !wish) return;
    if (hasSupabaseConfig && currentParticipantId !== null) {
      try {
        const savedWish = await addRemoteWish(currentParticipantId, wish);
        setData((previous) => ({ ...previous, wishlists: { ...previous.wishlists, [currentName]: [...(previous.wishlists[currentName] ?? []), savedWish.item] } }));
        setRemoteWishIds((previous) => ({ ...previous, [currentName]: [...(previous[currentName] ?? []), savedWish.id] }));
        setWishInput('');
        setConnectionError('');
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : 'Não foi possível salvar o desejo.');
      }
      return;
    }
    setData((previous) => ({
      ...previous,
      wishlists: {
        ...previous.wishlists,
        [currentName]: [...(previous.wishlists[currentName] ?? []), wish],
      },
    }));
    setWishInput('');
  }

  async function removeWish(indexToRemove: number) {
    if (!currentName) return;
    if (hasSupabaseConfig) {
      const wishId = remoteWishIds[currentName]?.[indexToRemove];
      if (!wishId) return;
      try {
        await removeRemoteWish(wishId);
        setRemoteWishIds((previous) => ({ ...previous, [currentName]: previous[currentName].filter((_, index) => index !== indexToRemove) }));
        setData((previous) => ({ ...previous, wishlists: { ...previous.wishlists, [currentName]: (previous.wishlists[currentName] ?? []).filter((_, index) => index !== indexToRemove) } }));
        setConnectionError('');
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : 'Não foi possível remover o desejo.');
      }
      return;
    }
    setData((previous) => ({
      ...previous,
      wishlists: {
        ...previous.wishlists,
        [currentName]: (previous.wishlists[currentName] ?? []).filter((_, index) => index !== indexToRemove),
      },
    }));
  }

  function startDraw() {
    setIsRevealed(false);
    setShowWarning(true);
  }

  async function confirmReveal() {
    setDrawSubmitting(true);
    setConnectionError('');
    try {
      if (hasSupabaseConfig) {
        const participant = participants.find((item) => item.id === currentParticipantId);
        if (!participant || currentParticipantId === null || !currentUserId) throw new Error('Entre novamente para continuar.');
        await drawOnce();
        await loadSharedState({ id: participant.id, name: participant.name, userId: currentUserId, avatar_path: participant.avatar_path ?? `${currentUserId}/avatar.jpg` }, participants);
      } else if (!data.assignments) {
        setData((previous) => ({ ...previous, assignments: createAssignments() }));
      }
      setIsRevealed(true);
      setShowWarning(false);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Não foi possível concluir o sorteio.');
    } finally {
      setDrawSubmitting(false);
    }
  }

  async function savePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !currentName) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Escolha uma imagem para o perfil.');
      return;
    }
    try {
      const photo = await compressImage(file);
      if (hasSupabaseConfig) {
        if (!currentUserId) throw new Error('Entre novamente para enviar sua foto.');
        const imageBlob = await (await fetch(photo)).blob();
        const signedUrl = await uploadAvatar(currentUserId, imageBlob);
        setData((previous) => ({ ...previous, photos: { ...previous.photos, [currentName]: signedUrl } }));
        setParticipants((previous) => previous.map((participant) => participant.id === currentParticipantId
          ? { ...participant, avatar_path: `${currentUserId}/avatar.jpg` }
          : participant));
        setPhotoError('');
        event.target.value = '';
        return;
      }
      setData((previous) => ({ ...previous, photos: { ...previous.photos, [currentName]: photo } }));
      setPhotoError('');
    } catch {
      setPhotoError('Não foi possível carregar essa imagem. Tente outra.');
    }
    event.target.value = '';
  }

  function changeParticipant() {
    if (hasSupabaseConfig) void signOut().catch((error) => setConnectionError(error instanceof Error ? error.message : 'Não foi possível sair da conta.'));
    setCurrentName(null);
    setCurrentParticipantId(null);
    setCurrentUserId(null);
    setIsRevealed(false);
    setShowWarning(false);
    setShowWishlist(false);
    setFilter('');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Amigo secreto da família, início">
          <span className="brand-mark"><Gift size={19} strokeWidth={2.1} /></span>
          <span>Amigo secreto</span>
        </a>
        <div className="topbar-meta"><span className="online-dot" /> EDIÇÃO DA FAMÍLIA <span className="meta-year">2026</span></div>
      </header>

      <main id="inicio">
        <section className="photo-hero" aria-label="Encontro da família">
          <img className="hero-photo" src="/images/familia-hero.jpeg" alt="A família reunida em volta da rede" />
          <div className="hero-scrim" />
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> AMIGO SECRETO DA FAMÍLIA</span>
            <h1>O melhor presente<br />é ter vocês <em>por perto.</em></h1>
            <p>Que bom poder dividir a vida com a nossa família.</p>
          </div>
        </section>

        <section className="content-wrap">
          {!currentName ? (
            <div className="chooser-layout">
              <div className="chooser-main">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">PRIMEIRO, QUEM É VOCÊ?</span>
                    <h2>Escolha seu nome.</h2>
                  </div>
                  <div className="participant-count"><Users size={17} /><strong>{participantNames.length}</strong><span>na roda</span></div>
                </div>
                <label className="search-box">
                  <span className="search-glyph">⌕</span>
                  <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Encontre seu nome" aria-label="Buscar participante" />
                  <span className="search-hint">BUSCAR</span>
                </label>
                <div className="people-grid">
                  {visibleParticipants.map((name, index) => (
                    <button className={`person-option color-${index % 6}`} key={name} style={{ animationDelay: `${Math.min(index * 24, 320)}ms` }} onClick={() => chooseParticipant(name)} disabled={hasSupabaseConfig && !remoteReady}>
                      <span className="avatar avatar-small">{initials(name)}</span>
                      <span className="person-name">{name}</span>
                      <ArrowRight className="person-arrow" size={16} />
                    </button>
                  ))}
                  {visibleParticipants.length === 0 && <p className="empty-search">Nenhum nome encontrado.</p>}
                </div>
                <p className="privacy-note"><LockKeyhole size={14} /> Seus dados ficam protegidos no espaço da família.</p>
                {connectionError && <p className="connection-error" role="status">{connectionError}</p>}
              </div>
              <aside className="family-aside">
                <span className="section-kicker">SEM COMPLICAÇÃO</span>
                <h3>Como funciona</h3>
                <ol className="how-steps">
                  <li><span>01</span><p>Escolha seu nome e adicione sua foto.</p></li>
                  <li><span>02</span><p>Anote ideias de presentes na sua lista.</p></li>
                  <li><span>03</span><p>Sorteie e revele quando estiver em um cantinho só seu.</p></li>
                </ol>
              </aside>
            </div>
          ) : (
            <div className="dashboard">
              <div className="dashboard-heading">
                <div className="identity-block">
                  <button className="profile-photo-button" onClick={() => photoInput.current?.click()} aria-label={`Adicionar ou trocar foto de ${currentName}`} title="Adicionar ou trocar sua foto">
                    {data.photos[currentName] ? <img src={data.photos[currentName]} alt={`Foto de ${currentName}`} /> : <span className="avatar-placeholder">{initials(currentName)}</span>}
                    <span className="camera-badge"><Camera size={14} /></span>
                  </button>
                  <input ref={photoInput} className="visually-hidden" type="file" accept="image/*" onChange={savePhoto} aria-label="Escolher foto de perfil" />
                  <div>
                    <span className="section-kicker">BEM-VINDE À RODA</span>
                    <h2>Oi, {currentName}<span className="heading-period">.</span></h2>
                    <button className="photo-link" onClick={() => photoInput.current?.click()}>{data.photos[currentName] ? 'Trocar foto' : 'Adicionar minha foto'} <Camera size={13} /></button>
                    {photoError && <span className="photo-error" role="status">{photoError}</span>}
                  </div>
                </div>
                <button className="text-button change-person" onClick={changeParticipant}><ArrowLeft size={15} /> Trocar pessoa</button>
              </div>

              <div className="dashboard-grid">
                <section className="wishlist-section">
                  <div className="panel-heading">
                    <div><span className="section-kicker">UMAS IDEIAS PARA AJUDAR</span><h3>Minha lista de desejos</h3></div>
                    <span className="wish-count">{wishes.length.toString().padStart(2, '0')}</span>
                  </div>
                  <form className="wish-form" onSubmit={addWish}>
                    <input value={wishInput} onChange={(event) => setWishInput(event.target.value)} placeholder="O que você gostaria de ganhar?" aria-label="Adicionar presente desejado" maxLength={100} />
                    <button type="submit" disabled={!wishInput.trim()} aria-label="Adicionar desejo"><Plus size={19} /></button>
                  </form>
                  <div className="wish-list" aria-live="polite">
                    {wishes.length ? wishes.map((wish, index) => (
                      <div className="wish-item" key={`${wish}-${index}`}><span className="wish-bullet"><Heart size={13} /></span><span>{wish}</span><button onClick={() => removeWish(index)} aria-label={`Remover ${wish}`}><X size={15} /></button></div>
                    )) : <div className="wish-empty"><span className="empty-gift"><Gift size={23} /></span><p>Sua lista começa com uma ideia.<br /><span>Vale qualquer desejo, grande ou pequeno.</span></p></div>}
                  </div>
                  <p className="wishlist-footnote">Só quem tirar você verá esta lista.</p>
                </section>

                <section className={`draw-section ${isRevealed ? 'draw-section-revealed' : ''}`}>
                  <div className="draw-topline"><span className="draw-icon"><Gift size={17} /></span><span>{data.assignments ? 'O SORTEIO ESTÁ FEITO' : 'A SURPRESA ESPERA'}</span></div>
                  {!isRevealed ? (
                    <>
                      <h3>{data.assignments ? 'Seu nome já saiu.' : 'Pronto para descobrir?'}</h3>
                      <p>{data.assignments ? 'Encontre um cantinho só seu antes de abrir.' : 'Você pode sortear agora ou deixar para quando estiver pronto.'}</p>
                      <button className="draw-button" onClick={() => data.assignments ? setShowWarning(true) : startDraw()}>
                        {data.assignments ? 'Revelar meu sorteado' : 'Sortear agora'} <ArrowRight size={17} />
                      </button>
                      <div className="draw-later"><span className="draw-status-dot" />{data.assignments ? 'Seu resultado ficará guardado' : 'Também dá para fazer isso depois'}</div>
                    </>
                  ) : (
                    <>
                      <span className="revealed-label"><Sparkles size={14} /> SEU AMIGO SECRETO É</span>
                      <h3 className="recipient-name">{recipient}</h3>
                      <p>Agora é só escolher algo que tenha a cara dessa pessoa.</p>
                      <button className="draw-button recipient-wish-button" onClick={() => setShowWishlist(true)}>
                        Ver lista de desejos <ArrowRight size={17} />
                      </button>
                      <div className="draw-later"><LockKeyhole size={13} /> Guarde esse segredo!</div>
                    </>
                  )}
                </section>
              </div>
              {connectionError && <p className="connection-error" role="status">{connectionError}</p>}
              <div className="dashboard-footer"><span><LockKeyhole size={13} /> A surpresa é sua. Revele em um lugar reservado.</span><span>COM CARINHO, FAMÍLIA <Heart size={12} fill="currentColor" /></span></div>
            </div>
          )}
        </section>

        <section className="family-gallery" aria-labelledby="gallery-title">
          <div className="gallery-inner">
            <div className="gallery-heading">
              <div>
                <span className="section-kicker">ALGUNS MOMENTOS NOSSOS</span>
                <h2 id="gallery-title">Nossa família, do nosso jeito.</h2>
                <p>Que sorte a nossa poder guardar tudo isso junto.</p>
              </div>
              <div className="gallery-controls">
                <button onClick={() => setActivePhoto((activePhoto - 1 + FAMILY_PHOTOS.length) % FAMILY_PHOTOS.length)} aria-label="Foto anterior"><ChevronLeft size={18} /></button>
                <span>{String(activePhoto + 1).padStart(2, '0')} <i>/</i> {String(FAMILY_PHOTOS.length).padStart(2, '0')}</span>
                <button onClick={() => setActivePhoto((activePhoto + 1) % FAMILY_PHOTOS.length)} aria-label="Próxima foto"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="gallery-stage" aria-live="polite">
              <div className="gallery-feature" style={{ width: `min(100%, ${Math.round(520 * FAMILY_PHOTOS[activePhoto].aspectRatio)}px)`, aspectRatio: `${FAMILY_PHOTOS[activePhoto].aspectRatio}` }}>
                <img key={FAMILY_PHOTOS[activePhoto].src} src={FAMILY_PHOTOS[activePhoto].src} alt={FAMILY_PHOTOS[activePhoto].alt} />
                <div className="gallery-caption"><Heart size={15} fill="currentColor" /><span>{FAMILY_PHOTOS[activePhoto].caption}</span></div>
              </div>
            </div>
            <div className="gallery-thumbnails" aria-label="Escolher foto">
              {FAMILY_PHOTOS.map((photo, index) => (
                <button className={index === activePhoto ? 'thumbnail-active' : ''} key={photo.src} style={{ animationDelay: `${Math.min(index * 24, 360)}ms` }} onClick={() => setActivePhoto(index)} aria-label={`Mostrar foto ${index + 1}`} aria-pressed={index === activePhoto}>
                  <img src={photo.src} alt="" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><a className="brand footer-brand" href="#inicio"><span className="brand-mark"><Gift size={16} /></span><span>Amigo secreto</span></a><span>UMA TRADIÇÃO FEITA DE PESSOAS</span><span>2026 <Heart size={12} /></span></footer>

      {authName && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthName(null); }}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" onClick={() => setAuthName(null)} aria-label="Fechar"><X size={18} /></button>
            <div className="modal-icon"><LockKeyhole size={22} /></div>
            <span className="section-kicker">{hasPassword ? 'QUE BOM TER VOCÊ DE VOLTA' : 'PRIMEIRO ACESSO'}</span>
            <h2 id="auth-title">{hasPassword ? `Entre como ${authName}` : `Crie sua senha, ${authName}`}</h2>
            <p>{hasPassword ? 'Digite sua senha para abrir sua área.' : 'Escolha uma senha com pelo menos 8 caracteres.'}</p>
            <form className="auth-form" onSubmit={authenticateParticipant}>
              <label>Senha
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={hasPassword ? 'current-password' : 'new-password'} minLength={8} required autoFocus />
              </label>
              {!hasPassword && <label>Confirme a senha
                <input type="password" value={authConfirm} onChange={(event) => setAuthConfirm(event.target.value)} autoComplete="new-password" minLength={8} required />
              </label>}
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="confirm-reveal" type="submit" disabled={authSubmitting}>
                {authSubmitting ? 'Verificando...' : hasPassword ? 'Entrar' : 'Criar senha'} <ArrowRight size={17} />
              </button>
            </form>
            {!hasPassword && <p className="auth-note">O primeiro acesso cria a senha deste nome. Combine o cadastro com a pessoa antes de continuar.</p>}
            <p className="auth-note">Sua senha fica protegida pelo Supabase. Como o cadastro não usa e-mail real, peça ao organizador para redefinir uma senha esquecida.</p>
          </section>
        </div>
      )}

      {showWarning && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWarning(false); }}>
          <section className="reveal-modal" role="dialog" aria-modal="true" aria-labelledby="warning-title">
            <button className="modal-close" onClick={() => setShowWarning(false)} aria-label="Fechar"><X size={18} /></button>
            <div className="modal-icon"><LockKeyhole size={22} /></div>
            <span className="section-kicker">UM SEGREDO SÓ SEU</span>
            <h2 id="warning-title">Tem alguém olhando<br />por cima do seu ombro?</h2>
            <p>Seu sorteado vai aparecer na tela. Confira se está em um lugar reservado antes de continuar.</p>
            <button className="confirm-reveal" onClick={confirmReveal} disabled={drawSubmitting}>{drawSubmitting ? 'Preparando o sorteio...' : <><Check size={17} /> Estou em um lugar reservado</>}</button>
            <button className="later-button" onClick={() => setShowWarning(false)}>Agora não, volto depois</button>
          </section>
        </div>
      )}

      {showWishlist && recipient && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWishlist(false); }}>
          <section className="wishlist-modal" role="dialog" aria-modal="true" aria-labelledby="recipient-wishes-title">
            <button className="modal-close" onClick={() => setShowWishlist(false)} aria-label="Fechar"><X size={18} /></button>
            <div className="modal-icon wish-modal-icon"><Gift size={22} /></div>
            <span className="section-kicker">UMA PISTA PARA O PRESENTE</span>
            <h2 id="recipient-wishes-title">O que {recipient} gostaria?</h2>
            {recipientWishes.length ? <ul className="recipient-wish-list">{recipientWishes.map((wish, index) => <li key={`${wish}-${index}`}><Heart size={14} /> {wish}</li>)}</ul> : <p className="no-recipient-wishes">Ainda não tem desejos por aqui. Um presente escolhido com carinho vai ser ótimo.</p>}
            <button className="confirm-reveal" onClick={() => setShowWishlist(false)}>Entendi <ArrowRight size={17} /></button>
          </section>
        </div>
      )}
    </div>
  );
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/index.html') return <NotFoundPage />;
  return <FamilyApp />;
}

export default App;
