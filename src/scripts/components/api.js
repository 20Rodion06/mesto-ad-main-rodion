/**
 * Атлас — модуль данных.
 * По умолчанию работает через Supabase Auth + REST API.
 * Только ?demo=1 включает автономную демоверсию с localStorage.
 * В браузере допустим ТОЛЬКО publishable key: доступ ограничивается RLS.
 */
const SUPABASE_URL = "https://jjffshsfepjdpljqamfd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fjfM7DsurkyqIIsSj8r_fQ_1uNu-Pwn";
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
const SESSION_KEY = "rodion-atlas-supabase-session-v1";
const DEMO_STORAGE_KEY = "atlas-mesto-demo-v1";
const DEMO_USER_ID = "atlas-demo-user";

let demoMode = false;
let session = null;
let authInFlight = null;
const copy = (value) => JSON.parse(JSON.stringify(value));

// В Supabase анонимный пользователь получает роль authenticated.
// При обновлении вкладки его access_token обновляется по refresh_token.
const readSession = () => {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Не удалось прочитать сессию Supabase:", error);
    return null;
  }
};

const storeSession = (data) => {
  const source = data.session || data;
  const userId = source.user?.id || data.user?.id || session?.userId;
  if (!source.access_token || !source.refresh_token || !userId) {
    throw new Error("Supabase не вернул корректную сессию авторизации");
  }
  const expiry = typeof source.expires_at === "number"
    ? source.expires_at * 1000
    : Date.now() + Number(source.expires_in || 3600) * 1000;
  session = {
    accessToken: source.access_token,
    refreshToken: source.refresh_token,
    userId,
    expiresAt: expiry,
  };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  catch (error) { console.warn("Сессия не сохранилась в браузере:", error); }
  return session;
};

const authRequest = async (path, body) => {
  const response = await fetch(`${AUTH_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Ошибка авторизации Supabase (${response.status}): ${data.msg || data.message || data.error_description || data.error || "Не удалось войти"}`);
  }
  return data;
};

const ensureSession = async () => {
  if (demoMode) return null;
  if (!session) session = readSession();
  if (session?.accessToken && Date.now() < session.expiresAt - 60_000) return session;
  if (authInFlight) return authInFlight;

  authInFlight = (async () => {
    // Не создаём новый аккаунт при ошибке обновления старой сессии:
    // иначе пользователь незаметно потеряет доступ к своим карточкам.
    const data = session?.refreshToken
      ? await authRequest("/token?grant_type=refresh_token", { refresh_token: session.refreshToken })
      : await authRequest("/signup", {});
    return storeSession(data);
  })();
  try { return await authInFlight; }
  finally { authInFlight = null; }
};

const request = async (path, { method = "GET", body, returnRows = false } = {}) => {
  const active = await ensureSession();
  const response = await fetch(`${REST_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${active.accessToken}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(returnRows ? { Prefer: "return=representation" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; }
  catch { throw new Error("Сервер вернул некорректный JSON"); }
  if (!response.ok) {
    throw new Error(`Supabase API (${response.status}): ${data?.message || data?.error || raw || "Ошибка запроса"}`);
  }
  return data;
};

const profileToUser = (profile) => ({
  _id: profile.id,
  name: profile.name,
  about: profile.about,
  avatar: profile.avatar,
});

const mapCards = (cards, profiles, likes) => {
  const people = new Map(profiles.map((p) => [p.id, { _id: p.id, name: p.name }]));
  const likesByCard = new Map();
  likes.forEach((like) => {
    const user = people.get(like.user_id) || { _id: like.user_id, name: "Пользователь" };
    if (!likesByCard.has(like.card_id)) likesByCard.set(like.card_id, []);
    likesByCard.get(like.card_id).push(user);
  });
  return cards.map((card) => ({
    _id: card.id,
    name: card.name,
    link: card.link,
    owner: people.get(card.owner_id) || { _id: card.owner_id, name: "Пользователь" },
    likes: likesByCard.get(card.id) || [],
    createdAt: card.created_at,
  }));
};

// Иллюстрации для отключённой от сети демонстрации.
const renderLandscape = (number) => {
  const colors = [
    ["#c2d5c3", "#e6d7b9", "#718c73", "#354f46", "#a6c8bf"],
    ["#a6cbd0", "#f0dbb4", "#8aa4a1", "#466d6d", "#d5b58e"],
    ["#e3bb99", "#f1dfb6", "#b58367", "#775d50", "#b5bfa0"],
    ["#bdd4d7", "#e9e5d8", "#86a6ae", "#4e7a80", "#c5d7c4"],
    ["#b5c7bc", "#e4d9c3", "#729275", "#345a4c", "#c9d4bd"],
    ["#bdc1d3", "#eee1d0", "#8b90a4", "#4a5a72", "#c6c5b6"],
  ];
  const [sky, sun, hills, foreground, water] = colors[number % colors.length];
  const picture = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="720" viewBox="0 0 900 720">
  <defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${sun}"/></linearGradient></defs>
  <rect width="900" height="720" fill="url(#g)"/>
  <circle cx="684" cy="162" r="88" fill="${sun}" opacity=".83"/>
  <path d="M0 433 126 285 210 376 360 188 522 409 670 298 900 461V720H0" fill="${hills}"/>
  <path d="M0 535 190 431 352 502 525 374 696 482 900 396V720H0" fill="${foreground}" opacity=".93"/>
  <path d="M0 587Q170 553 315 596T630 590T900 577V720H0Z" fill="${water}" opacity=".95"/>
  <path d="M0 663Q255 619 455 664T900 638V720H0" fill="${foreground}" opacity=".52"/>
  <path d="M80 155c40-13 83-12 126 0M117 181c35-8 72-6 91 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(picture)}`;
};

const seedDemo = () => ({
  user: {
    _id: DEMO_USER_ID,
    name: "Мой атлас",
    about: "Исследую мир и собираю вдохновение",
    avatar: "./src/images/avatar.jpg",
  },
  cards: ["Тихая долина", "Вечер у моря", "Тёплый каньон", "Северное озеро", "Зелёные холмы", "Горный перевал"].map((name, index) => ({
    _id: `atlas-place-${index + 1}`,
    name,
    link: renderLandscape(index),
    owner: { _id: DEMO_USER_ID, name: "Мой атлас" },
    likes: index % 3 === 0 ? [{ _id: DEMO_USER_ID, name: "Мой атлас" }] : [],
    createdAt: new Date(Date.now() - index * 86400000 * 13).toISOString(),
  })),
});

const loadDemo = () => {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.user && Array.isArray(parsed.cards)) return parsed;
    }
  } catch (error) { console.warn("Не удалось прочитать демонстрационные данные:", error); }
  return seedDemo();
};

const saveDemo = (state) => {
  try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { console.warn("Не удалось сохранить демонстрационные данные:", error); }
};

export const enableDemoMode = () => {
  demoMode = true;
  if (!localStorage.getItem(DEMO_STORAGE_KEY)) saveDemo(seedDemo());
};
export const isDemoMode = () => demoMode;

export const getUserInfo = async () => {
  if (demoMode) return copy(loadDemo().user);
  const { userId } = await ensureSession();
  const profiles = await request(`/profiles?id=eq.${encodeURIComponent(userId)}&select=id,name,about,avatar`);
  if (!profiles.length) throw new Error("Профиль не создан: проверьте триггер create_atlas_profile");
  return profileToUser(profiles[0]);
};

export const getCardList = async () => {
  if (demoMode) return copy(loadDemo().cards);
  const [cards, profiles, likes] = await Promise.all([
    request("/cards?select=id,name,link,owner_id,created_at&order=created_at.desc"),
    request("/profiles?select=id,name"),
    request("/likes?select=card_id,user_id"),
  ]);
  return mapCards(cards, profiles, likes);
};

export const setUserInfo = async ({ name, about }) => {
  if (demoMode) {
    const state = loadDemo();
    state.user = { ...state.user, name, about };
    state.cards.forEach((card) => {
      if (card.owner._id === state.user._id) card.owner.name = name;
      card.likes.forEach((user) => { if (user._id === state.user._id) user.name = name; });
    });
    saveDemo(state);
    return copy(state.user);
  }
  const { userId } = await ensureSession();
  const updated = await request(`/profiles?id=eq.${encodeURIComponent(userId)}&select=id,name,about,avatar`, {
    method: "PATCH", body: { name, about }, returnRows: true,
  });
  if (updated.length !== 1) throw new Error("Изменение профиля не разрешено");
  return profileToUser(updated[0]);
};

export const setUserAvatar = async ({ avatar }) => {
  if (demoMode) {
    const state = loadDemo();
    state.user.avatar = avatar;
    saveDemo(state);
    return copy(state.user);
  }
  const { userId } = await ensureSession();
  const updated = await request(`/profiles?id=eq.${encodeURIComponent(userId)}&select=id,name,about,avatar`, {
    method: "PATCH", body: { avatar }, returnRows: true,
  });
  if (updated.length !== 1) throw new Error("Изменение аватара не разрешено");
  return profileToUser(updated[0]);
};

export const addNewCard = async ({ name, link }) => {
  if (demoMode) {
    const state = loadDemo();
    const card = {
      _id: `atlas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name, link,
      owner: { _id: state.user._id, name: state.user.name },
      likes: [], createdAt: new Date().toISOString(),
    };
    state.cards.unshift(card);
    saveDemo(state);
    return copy(card);
  }
  const { userId } = await ensureSession();
  const created = await request("/cards?select=id,name,link,owner_id,created_at", {
    method: "POST", body: { name, link, owner_id: userId }, returnRows: true,
  });
  if (created.length !== 1) throw new Error("Карточка не была создана");
  const owner = await getUserInfo();
  return {
    _id: created[0].id, name: created[0].name, link: created[0].link,
    owner: { _id: userId, name: owner.name }, likes: [], createdAt: created[0].created_at,
  };
};

export const removeCard = async (cardId) => {
  if (demoMode) {
    const state = loadDemo();
    const card = state.cards.find((item) => item._id === cardId);
    if (!card || card.owner._id !== state.user._id) throw new Error("Удаление этой карточки запрещено");
    state.cards = state.cards.filter((item) => item._id !== cardId);
    saveDemo(state);
    return {};
  }
  const { userId } = await ensureSession();
  const removed = await request(`/cards?id=eq.${encodeURIComponent(cardId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id`, {
    method: "DELETE", returnRows: true,
  });
  if (removed.length !== 1) throw new Error("Карточка не найдена или принадлежит другому пользователю");
  return {};
};

export const changeLikeCardStatus = async (cardId, isLiked) => {
  if (demoMode) {
    const state = loadDemo();
    const card = state.cards.find((item) => item._id === cardId);
    if (!card) throw new Error("Карточка не найдена");
    card.likes = isLiked
      ? card.likes.filter((item) => item._id !== state.user._id)
      : [...card.likes, { _id: state.user._id, name: state.user.name }];
    saveDemo(state);
    return copy(card);
  }
  const { userId } = await ensureSession();
  if (isLiked) {
    await request(`/likes?card_id=eq.${encodeURIComponent(cardId)}&user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
  } else {
    await request("/likes", { method: "POST", body: { card_id: cardId, user_id: userId } });
  }
  const cards = await getCardList();
  const card = cards.find((item) => item._id === cardId);
  if (!card) throw new Error("Карточка не найдена");
  return card;
};
