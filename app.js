const GRANDSON_DISHES = [
  "豆豉鯪魚蒸排骨",
  "娃娃菜煲",
  "餃子",
  "水蛋",
  "豉油雞",
];

const SON_DISHES = [
  "節瓜粉絲豬肉",
  "蕃茄豬肉",
  "煎蛋餅",
  "三色豆豬肉",
  "梅菜蒸豬肉",
  "土魷肉餅",
  "士蜜味豆",
  "咕嚕肉",
  "娃娃菜煲",
];

const HOUSE_DISHES = [
  "蒜蓉炒菜心",
  "鹹蛋蒸肉餅",
  "冬瓜瘦肉湯",
  "粟米魚肚羹",
  "蝦米粉絲節瓜",
  "薯仔炆雞翼",
  "蠔油生菜",
  "菜脯煎蛋",
  "豆腐蒸肉碎",
  "蒜蓉蒸茄子",
  "粟米紅蘿蔔炒肉粒",
  "紫菜蛋花湯",
  "南瓜炆排骨",
  "豉汁蒸魚柳",
  "雜菜炒肉片",
  "紅蘿蔔粟米湯",
];

const SUPABASE_URL = "https://gdwtbmjxtgfwmtosacvp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wPxn9VdJsgRdvj1QNfij6A_KuUAd_gp";
const SUPABASE_TABLE = "menus";
const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;

const dishGrid = document.querySelector("#dish-grid");
const historyList = document.querySelector("#history-list");
const dateLabel = document.querySelector("#today-date");
const drawButton = document.querySelector("#draw-button");
const redrawButton = document.querySelector("#redraw-button");
const refreshButton = document.querySelector("#refresh-button");
const dishTemplate = document.querySelector("#dish-card-template");

let menusCache = [];

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function displayDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function normalizeMenu(row) {
  return {
    date: row.menu_date,
    dishes: row.dishes,
  };
}

async function fetchMenus() {
  const response = await fetch(`${SUPABASE_REST_URL}?select=*&order=menu_date.desc&limit=10`, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error("讀取 Supabase 菜單失敗");
  }

  const rows = await response.json();
  menusCache = rows.map(normalizeMenu);
  return menusCache;
}

async function saveTodayMenu(menu) {
  const response = await fetch(`${SUPABASE_REST_URL}?on_conflict=menu_date`, {
    method: "POST",
    headers: supabaseHeaders({
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify({
      menu_date: menu.date,
      dishes: menu.dishes,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("儲存 Supabase 菜單失敗");
  }

  return fetchMenus();
}

function randomItem(list, blocked = new Set()) {
  const choices = list.filter((item) => !blocked.has(item));
  const pool = choices.length ? choices : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createMenu() {
  const used = new Set();
  const grandsonPick = randomItem(GRANDSON_DISHES, used);
  used.add(grandsonPick);

  const sonPick = randomItem(SON_DISHES, used);
  used.add(sonPick);

  const suggestedOne = randomItem(HOUSE_DISHES, used);
  used.add(suggestedOne);

  const suggestedTwo = randomItem(HOUSE_DISHES, used);

  return [
    { label: "肥孫子心水", name: grandsonPick },
    { label: "帥兒子心水", name: sonPick },
    { label: "婆婆穩陣加餸", name: suggestedOne },
    { label: "家常平衡款", name: suggestedTwo },
  ];
}

async function upsertTodayMenu() {
  const date = todayKey();
  setBusy(true);

  try {
    const nextMenus = await saveTodayMenu({ date, dishes: createMenu() });
    render(nextMenus);
  } catch (error) {
    renderError("暫時儲存不到共用菜單，請檢查 Supabase 設定。");
  } finally {
    setBusy(false);
  }
}

function renderDishes(menu) {
  dishGrid.innerHTML = "";

  if (!menu) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "今日未抽餸。按一下紅色按鈕，今晚就有方向。";
    dishGrid.append(empty);
    return;
  }

  menu.dishes.forEach((dish) => {
    const card = dishTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".dish-tag").textContent = dish.label;
    card.querySelector("h3").textContent = dish.name;
    dishGrid.append(card);
  });
}

function renderHistory(menus) {
  historyList.innerHTML = "";

  if (!menus.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暫時未有紀錄，抽完今晚菜單就會自動保存。";
    historyList.append(empty);
    return;
  }

  menus.forEach((menu) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const date = document.createElement("div");
    date.className = "history-date";
    date.textContent = displayDate(menu.date);

    const dishes = document.createElement("div");
    dishes.className = "history-dishes";
    menu.dishes.forEach((dish) => {
      const chip = document.createElement("span");
      chip.textContent = dish.name;
      dishes.append(chip);
    });

    item.append(date, dishes);
    historyList.append(item);
  });
}

function render(menus = menusCache) {
  const date = todayKey();
  const sortedMenus = [...menus].sort((a, b) => b.date.localeCompare(a.date));
  const todayMenu = sortedMenus.find((menu) => menu.date === date);

  dateLabel.textContent = displayDate(date);
  drawButton.textContent = todayMenu ? "已抽好今晚餸" : "抽今晚餸";
  renderDishes(todayMenu);
  renderHistory(sortedMenus);
}

function renderLoading() {
  dishGrid.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "empty-state";
  loading.textContent = "正在載入共用菜單...";
  dishGrid.append(loading);
}

function renderError(message) {
  dishGrid.innerHTML = "";
  const error = document.createElement("div");
  error.className = "empty-state";
  error.textContent = message;
  dishGrid.append(error);
}

function setBusy(isBusy) {
  drawButton.disabled = isBusy;
  redrawButton.disabled = isBusy;
  refreshButton.disabled = isBusy;
}

async function initialize() {
  renderLoading();
  setBusy(true);

  try {
    const menus = await fetchMenus();
    render(menus);
  } catch (error) {
    renderError("暫時連不到共用菜單，請稍後再試。");
    renderHistory([]);
  } finally {
    setBusy(false);
  }
}

drawButton.addEventListener("click", async () => {
  const date = todayKey();
  const existing = menusCache.some((menu) => menu.date === date);
  if (!existing) await upsertTodayMenu();
});

redrawButton.addEventListener("click", upsertTodayMenu);

refreshButton.addEventListener("click", async () => {
  await initialize();
});

initialize();
