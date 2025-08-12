// ======= SETTINGS =======
// List of blocked domains
const blockedDomains = [
  // Adult sites
  "youtube.com", "instagram.com", "reddit.com",
  "pornhub.com", "xvideos.com", "xnxx.com", "redtube.com", "youporn.com", "brazzers.com", "spankwire.com", "tnaflix.com", "tube8.com", "porn.com",
  "hclips.com", "pornone.com", "porn300.com", "pornhd.com", "porndig.com", "pornhat.com", "fapvid.com", "xxx.com", "youjizz.com", "sex.com",

  // Gambling sites
  "bet365.com", "betfair.com", "1xbet.com", "pokerstars.com", "888casino.com", "royalvegascasino.com", "leovegas.com", "casumo.com", "unibet.com", "bovada.com",

  // Drugs
  "weedmaps.com", "leafly.com", "grasscity.com", "marijuanapackaging.com", "herb.co", "ilovegrowingmarijuana.com", "cannabis.net", "smokersguide.com", "weed-seeds.com", "420magazine.com",

  // Misc explicit
  "xhamster.com", "efukt.com", "motherless.com", "fapdu.com", "slutload.com", "sexvid.com", "hentaiporn.tv", "3movs.com", "sunporno.com", "xtube.com"
];

// List of blocked keywords (lowercase, no spaces)
const blockedKeywords = [
    
    // Explicit / Adult content
  "porn", "sex", "nude", "xxx", "hot", "adult", "hardcore", "erotic", "boobs", "breasts",
  "naked", "bikini", "lingerie", "fetish", "bdsm", "milf", "orgy", "threesome", "blowjob", "handjob",
  "cumshot", "anal", "pussy", "vagina", "penis", "sexy", "escort", "camgirl", "camsex", "strip",
  "stripper", "lust", "deepthroat", "horny", "incest", "taboo", "masturbate", "masturbation", "ejaculation",
  "hooker", "prostitute", "hentai", "sexcam", "kamasutra", "desiporn", "softcore", "gayporn", "lesbian", "transporn",

  // Drugs / Addiction
  "drug", "drugs", "weed", "marijuana", "cocaine", "heroin", "opium", "meth", "lsd", "hashish",
  "ecstasy", "piet" ,"crack", "psychedelic", "stoned", "joint", "ganja", "bhang", "charas", "inject", "overdose",

  // Gambling
  "gambling", "casino", "bet", "betting", "poker", "roulette", "blackjack", "lottery", "slots", "jackpot",

  // Hindi abusive words (50+)
  "chutiya", "harami" , "chut" ,"madarchod", "behenchod", "bhosdike", "gaand", "randi", "haraami", "kutte", "kamine", "launde",
  "jhatu", "tatti", "gandu", "ullu", "ullu ka pattha", "lodu", "bhadwe", "kanjar", "suvar", "chhakka",
  "hijra", "jhant", "jhant ke baal", "kutti", "kuttiya", "bakchod", "chinal", "rakhail", "teri maa", "teri behen",
  "maa chod", "behen chod", "choot", "choot ka", "choot ke baal", "jhant marunga", "gaand mara", "gaand marunga",
  "suar ki aulad", "khotte", "tatte", "lawda", "lode", "lulli", "bhosda", "randi rona", "bhen di takke", "lund", "gandfat"
];

// Normalize function to remove spaces and special characters
function normalizeText(text) {
  return text.toLowerCase().replace(/[\s\W_]+/g, "");
}

// Detect navigation
chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
  const url = details.url.toLowerCase();
  const normalizedUrl = normalizeText(url);

  // Check blocked domains
  if (blockedDomains.some(domain => url.includes(domain))) {
    chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("blocked.html") });
    return;
  }

  // Check blocked keywords
  if (blockedKeywords.some(keyword => normalizedUrl.includes(normalizeText(keyword)))) {
    chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("blocked.html") });
    return;
  }
});

const STORAGE_KEY = "blockerSettings";
const LOG_KEY = "blockerLogs";

// ======= NORMALIZATION =======
const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '2': 'z', '6': 'g', '8': 'b', '9': 'g' };

function applyLeet(s) {
  return s.replace(/[0-9]/g, ch => LEET_MAP[ch] || ch);
}

function normalizeText(text) {
  if (!text) return "";
  try {
    return applyLeet(
      text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
    );
  } catch {
    return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
  }
}

// ======= STORAGE =======
async function getSettingsFromStorage() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || DEFAULT_SETTINGS;
}

async function saveSettingsToStorage(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

async function addLog(entry) {
  const r = await chrome.storage.local.get(LOG_KEY);
  const arr = r[LOG_KEY] || [];
  arr.unshift(entry);
  if (arr.length > 1000) arr.length = 1000;
  await chrome.storage.local.set({ [LOG_KEY]: arr });
}

// ======= HELPERS =======
function urlIsExtensionPage(url) {
  if (!url) return false;
  return url.startsWith(chrome.runtime.getURL(""));
}

function findBlockedWordsInString(str, wordsList) {
  const norm = normalizeText(str);
  return (wordsList || []).filter(w => norm.includes(normalizeText(w)));
}

function findBlockedSiteMatch(url, siteList) {
  try {
    const u = new URL(url);
    const hostAndPath = (u.hostname + u.pathname).toLowerCase();
    return (siteList || []).find(s => hostAndPath.includes(s.toLowerCase())) || null;
  } catch {
    const low = (url || "").toLowerCase();
    return (siteList || []).find(s => low.includes(s.toLowerCase())) || null;
  }
}

function blockedPageUrl(originalUrl, type = "word", found = []) {
  const args = new URLSearchParams();
  if (originalUrl) args.set("url", originalUrl);
  args.set("type", type);
  args.set("words", JSON.stringify(found || []));
  return chrome.runtime.getURL("blocked.html") + "?" + args.toString();
}

// ======= MESSAGES =======
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "blockNow") {
      const settings = await getSettingsFromStorage();
      const tabId = sender?.tab?.id;
      const pageUrl = msg.pageUrl || sender?.tab?.url || "";
      const found = msg.found || findBlockedWordsInString(pageUrl, settings.words);
      if (urlIsExtensionPage(pageUrl)) return sendResponse({ ok: false, reason: "extension-page" });

      const redirect = blockedPageUrl(pageUrl, "word", found);
      await addLog({ url: pageUrl, type: "realtime-word", reason: "matched_word_realtime", details: { found }, time: Date.now() });

      if (typeof tabId === "number") {
        chrome.tabs.update(tabId, { url: redirect }, () => sendResponse({ ok: true }));
      } else {
        chrome.tabs.create({ url: redirect }, () => sendResponse({ ok: true }));
      }
      return;
    }

    if (msg.type === "logAttempt") {
      const e = msg.entry || {};
      await addLog({ url: e.url || (sender?.tab?.url || ""), type: e.type || "unknown", reason: e.reason || "", details: e.details || null, time: Date.now() });
      return sendResponse({ ok: true });
    }

    if (msg.type === "getSettings") return sendResponse({ settings: await getSettingsFromStorage() });

    if (msg.type === "updateSettings") {
      await saveSettingsToStorage(msg.settings || DEFAULT_SETTINGS);
      return sendResponse({ ok: true });
    }

    if (msg.type === "clearLogs") {
      await chrome.storage.local.set({ [LOG_KEY]: [] });
      return sendResponse({ ok: true });
    }

    sendResponse({ ok: false, error: "unknown-type" });
  })();
  return true;
});

// ======= INSTANT BLOCKING ON NAVIGATION =======
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const url = changeInfo.url;
  if (urlIsExtensionPage(url)) return;

  const settings = await getSettingsFromStorage();
  if (!settings.enabled) return;

  const foundWords = findBlockedWordsInString(url, settings.words);
  if (foundWords.length) {
    await addLog({ url, type: "url-word", reason: "word_in_url", details: { found: foundWords }, time: Date.now() });
    return chrome.tabs.update(tabId, { url: blockedPageUrl(url, "word", foundWords) });
  }

  const siteMatch = findBlockedSiteMatch(url, settings.sites);
  if (siteMatch) {
    await addLog({ url, type: "url-site", reason: "site_match", details: { site: siteMatch }, time: Date.now() });
    return chrome.tabs.update(tabId, { url: blockedPageUrl(url, "site", [siteMatch]) });
  }
});

// ======= FIRST INSTALL =======
chrome.runtime.onInstalled.addListener(async () => {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  if (!r[STORAGE_KEY]) await saveSettingsToStorage(DEFAULT_SETTINGS);
});
