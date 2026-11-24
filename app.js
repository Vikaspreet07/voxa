/**
 * Voxa CaptionRoom Application Engine
 * Real-time classroom live captions, role-based views (Teacher vs Student),
 * split-screen login, Voxa 3D rotating cube loader, raise hand & doubt management,
 * multilingual Indian translation, and Gemma 4 AI integration.
 */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const T0 = Date.now();
const now = () => Date.now();

const esc = s => String(s).replace(/[&<>"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[c]));

const decodeHtmlEntities = str => {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =========================================================
// ROLE MANAGEMENT, APP STATE & MULTI-PAGE SYNC
// =========================================================
let currentUserRole = "teacher"; // 'teacher' or 'student'
let studentHandRaised = false;
let studentDoubtText = "";
let teacherMicActive = false;

// Cross-tab / Cross-page Broadcast Synchronization
let isRemoteSync = false;
const syncChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("voxa_captionroom_sync") : null;

function updateTeacherMicVisuals(active) {
  teacherMicActive = !!active;
  const waveEl = $("#teacherLiveWave");
  if (waveEl) waveEl.style.display = active ? "flex" : "none";

  const banner = $("#studentTeacherSpeakingBanner");
  if (banner) banner.style.display = active ? "flex" : "none";

  if (active) {
    const storyEl = $("#story");
    if (storyEl && !storyEl.textContent.includes("raised a hand")) {
      storyEl.textContent = "🎙️ Ms. Rao is speaking live via microphone... Translating into Indian dialects.";
    }
  }
}

function exportRoomState() {
  const segs = [];
  if (room && room.order) {
    room.order.forEach(id => {
      const s = room.segs.get(id);
      if (s) {
        segs.push({
          id: s.id,
          speaker: s.speaker,
          name: s.name,
          start: s.start,
          end: s.end,
          words: s.words,
          rev: s.rev,
          final: s.final,
          tr: s.tr,
          cors: s.cors
        });
      }
    });
  }
  return {
    segs,
    story: $("#story") ? $("#story").textContent : "",
    progress: $("#demoProgress") ? $("#demoProgress").textContent : "",
    studentHandRaised,
    studentDoubtText,
    teacherMicActive,
    studentTargetLang,
    ts: Date.now()
  };
}

function saveRoomState() {
  try {
    const state = exportRoomState();
    localStorage.setItem("voxa_room_state", JSON.stringify(state));
  } catch (e) { }
}

function importRoomState(state) {
  if (!state || !Array.isArray(state.segs)) return;
  state.segs.forEach(s => {
    if (!room.segs.has(s.id)) {
      room.order.push(s.id);
    }
    room.segs.set(s.id, {
      ...s,
      intr: false,
      ov: new Set(),
      last: 0,
      tok: 0
    });
  });

  if (state.story && $("#story")) $("#story").textContent = state.story;
  if (state.progress && $("#demoProgress")) $("#demoProgress").textContent = state.progress;
  if (typeof state.studentHandRaised === "boolean") studentHandRaised = state.studentHandRaised;
  if (typeof state.studentDoubtText === "string") studentDoubtText = state.studentDoubtText;
  if (typeof state.teacherMicActive === "boolean") updateTeacherMicVisuals(state.teacherMicActive);
  if (typeof state.studentTargetLang === "string" && state.studentTargetLang) {
    studentTargetLang = state.studentTargetLang;
    viewerTargetLang = state.studentTargetLang;
  }

  Object.values(clients).forEach(c => {
    if (c.on) {
      c.view.clear();
      room.order.forEach(id => {
        const s = room.segs.get(id);
        if (s) c.view.set(s.id, pub(s));
      });
      draw(c);
    }
  });
  build();
  stats();

  room.order.forEach(id => {
    const s = room.segs.get(id);
    if (s && !s.tr[studentTargetLang]) translate(s, 0);
  });
}

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    const { type, data } = event.data || {};
    if (!type) return;
    isRemoteSync = true;
    try {
      if (type === "HYP") {
        hyp(data.pid, data.sid, data.text, data.final);
      } else if (type === "CORRECT") {
        correct(data.sid, data.i, data.txt, data.by);
      } else if (type === "MIC_STATE") {
        if (data.speaker === "teacher") {
          updateTeacherMicVisuals(data.active);
        }
      } else if (type === "STORY") {
        const storyEl = $("#story");
        if (storyEl && data.story) storyEl.textContent = data.story;
        const progEl = $("#demoProgress");
        if (progEl && data.progress) progEl.textContent = data.progress;
      } else if (type === "DOUBT_RAISED") {
        studentHandRaised = true;
        studentDoubtText = data.text;
        build();
        const storyEl = $("#story");
        if (storyEl) storyEl.textContent = `✋ Student raised a hand: “${data.text}”`;
        const doubtsPanel = $("#teacherDoubtsPanel");
        if (doubtsPanel) doubtsPanel.style.display = "flex";
        if (typeof Gemma4 !== "undefined" && Gemma4.playChime) Gemma4.playChime("sparkle");
      } else if (type === "DOUBT_ACK") {
        studentHandRaised = false;
        studentDoubtText = "";
        build();
        const storyEl = $("#story");
        if (storyEl) storyEl.textContent = "👩‍🏫 Ms. Rao called on Aman! Aman has the floor to speak.";
        const doubtsPanel = $("#teacherDoubtsPanel");
        if (doubtsPanel) doubtsPanel.style.display = "none";
        if (typeof Gemma4 !== "undefined" && Gemma4.playChime) Gemma4.playChime("pop");
      } else if (type === "HAND_LOWERED") {
        studentHandRaised = false;
        studentDoubtText = "";
        build();
        const doubtsPanel = $("#teacherDoubtsPanel");
        if (doubtsPanel) doubtsPanel.style.display = "none";
      } else if (type === "RESET") {
        resetRoom();
      } else if (type === "LANG_CHANGE") {
        if (data && data.lang) {
          setStudentTargetLanguage(data.lang);
        }
      } else if (type === "STATE_REQ") {
        if (room && room.order && room.order.length > 0) {
          syncChannel.postMessage({ type: "STATE_SNAPSHOT", data: exportRoomState() });
        }
      } else if (type === "STATE_SNAPSHOT") {
        if (data) importRoomState(data);
      }
    } catch (e) {
      console.warn("Sync error:", e);
    } finally {
      isRemoteSync = false;
    }
  };
}

// All Supported Indian Languages + English
const INDIAN_LANGUAGES = [
  { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", native: "বাংলা", flag: "🇮🇳" },
  { code: "te", name: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  { code: "ur", name: "Urdu", native: "اردو", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", flag: "🇮🇳" },
  { code: "as", name: "Assamese", native: "অসমীয়া", flag: "🇮🇳" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्", flag: "🇮🇳" },
  { code: "en", name: "English", native: "English", flag: "🇬🇧" }
];

let studentTargetLang = "hi";
let viewerTargetLang = "hi";

function getLangMeta(code) {
  return INDIAN_LANGUAGES.find(l => l.code === code) || { code, name: code.toUpperCase(), native: code, flag: "🌐" };
}

function getLangName(code) {
  const l = getLangMeta(code);
  return `${l.native} (${l.name})`;
}

// Built-in offline neural fallback dictionary for instant, accurate science translation
const OFFLINE_TRANSLATIONS = {
  "today we will study photosynthesis": {
    hi: "आज हम प्रकाश-संश्लेषण का अध्ययन करेंगे",
    bn: "আজ আমরা সালোকসংশ্লেষ পড়ব",
    te: "ఈరోజు మనం కిరణజన్య సంయోగక్రియ గురించి చదువుకుంటాం",
    mr: "आज आपण प्रकाशसंश्लेषण शिकणार आहोत",
    ta: "இன்று நாம் ஒளிச்சேர்க்கை பற்றி படிப்போம்",
    ur: "آج ہم ضیائی تالیف کا مطالعہ کریں گے",
    gu: "આજે આપણે પ્રકાશસંશ્લેષણનો અભ્યાસ કરીશું",
    kn: "ಇಂದು ನಾವು ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆಯನ್ನು ಅಧ್ಯಯನ ಮಾಡುತ್ತೇವೆ",
    ml: "ഇന്ന് നമ്മൾ പ്രകാശസംശ്ലേഷണം പഠിക്കും",
    pa: "ਅੱਜ ਅਸੀਂ ਪ੍ਰਕਾਸ਼-ਸੰਸਲੇਸ਼ਣ ਪੜ੍ਹਾਂਗੇ",
    or: "ଆଜି ଆମେ ଆଲୋକ ସଂଶ୍ଳେଷଣ ପଢ଼ିବା",
    as: "আজি আমি সালোকসংশ্লেষণ অধ্যয়ন কৰিম",
    sa: "अद्य वयं प्रकाशसंश्लेषणम् अध्येष्यामः",
    en: "Today we will study photosynthesis"
  },
  "photosynthesis ka matlab hai light se food banana": {
    hi: "photosynthesis का मतलब है light से food बनाना",
    bn: "সালোকসংশ্লেষ মানে আলো থেকে খাদ্য তৈরি করা",
    te: "కిరణజన్య సంయోగక్రియ అంటే కాంతి నుండి ఆహారాన్ని తయారు చేయడం",
    mr: "प्रकाशसंश्लेषण म्हणजे प्रकाशापासून अन्न तयार करणे",
    ta: "ஒளிச்சேர்க்கை என்றால் ஒளியிலிருந்து உணவை உருவாக்குதல் என்று பொருள்",
    ur: "فوٹوسنتھیسز کا مطلب ہے روشنی سے خوراک بنانا",
    gu: "પ્રકાશસંશ્લેષણ એટલે પ્રકાશમાંથી ખોરાક બનાવવો",
    kn: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂದರೆ ಬೆಳಕಿನಿಂದ ಆಹಾರವನ್ನು ತಯಾರಿಸುವುದು",
    ml: "പ്രകാശത്തിൽ നിന്ന് ഭക്ഷണം ഉണ്ടാക്കുക എന്നാണ് പ്രകാശസംശ്ലേഷണം കൊണ്ട് അർത്ഥമാക്കുന്നത്",
    pa: "ਪ੍ਰਕਾਸ਼-ਸੰਸਲੇਸ਼ਣ ਦਾ ਮਤਲਬ ਹੈ ਰੌਸ਼ਨੀ ਤੋਂ ਭੋਜਨ ਬਣਾਉਣਾ",
    or: "ଆଲୋକ ସଂଶ୍ଳେଷଣର ଅର୍ଥ ହେଉଛି ଆଲୋକରୁ ଖାଦ୍ୟ ତିଆରି କରିବା",
    as: "সালোকসংশ্লেষণ মানে পোহৰৰ পৰা খাদ্য প্ৰস্তুত কৰা",
    sa: "प्रकाशसंश्लेषणस्य अर्थः प्रकाशात् अन्ननिर्माणम् अस्ति",
    en: "Photosynthesis means synthesizing food from light"
  },
  "any questions so far": {
    hi: "अब तक कोई सवाल?",
    bn: "এখন পর্যন্ত কোনো প্রশ্ন আছে?",
    te: "ఇప్పటివరకు ఏమైనా ప్రశ్నలు ఉన్నాయా?",
    mr: "आतापर्यंत काही प्रश्न आहेत का?",
    ta: "இதுவரை ஏதேனும் கேள்விகள் உள்ளதா?",
    ur: "اب تک کوئی سوال ہے؟",
    gu: "અત્યાર સુધી કોઈ પ્રશ્નો?",
    kn: "ಇಲ್ಲಿಯವರೆಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳಿವೆಯೇ?",
    ml: "ഇതുവരെ എന്തെങ്കിലും ചോദ്യങ്ങളുണ്ടോ?",
    pa: "ਹੁਣ ਤੱਕ ਕੋਈ ਸਵਾਲ?",
    or: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ପ୍ରଶ୍ନ ଅଛି କି?",
    as: "এতিয়ালৈকে কিবা প্ৰশ্ন আছেনে?",
    sa: "अधुना यावत् किमपि प्रश्नम् अस्ति वा?",
    en: "Any questions so far?"
  },
  "any questions": {
    hi: "कोई सवाल?",
    bn: "কোনো প্রশ্ন?",
    te: "ఏవైనా ప్రశ్నలు?",
    mr: "काही प्रश्न?",
    ta: "ஏதேனும் கேள்விகள்?",
    ur: "کوئی سوال؟",
    gu: "કોઈ પ્રશ્ન?",
    kn: "ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳು?",
    ml: "ചോദ്യങ്ങളുണ്ടോ?",
    pa: "ਕੋਈ ਸਵਾਲ?",
    or: "କୌଣସି ପ୍ରଶ୍ନ?",
    as: "কিবা প্ৰশ্ন?",
    sa: "किमपि प्रश्नम्?",
    en: "Any questions?"
  },
  "next topic": {
    hi: "अगला विषय",
    bn: "পরবর্তী বিষয়",
    te: "తదుపరి అంశం",
    mr: "पुढचा विषय",
    ta: "அடுத்த தலைப்பு",
    ur: "اگلا موضوع",
    gu: "આગળનો વિષય",
    kn: "ಮುಂದಿನ ವಿಷಯ",
    ml: "അടുത്ത വിഷയം",
    pa: "ਅਗਲਾ ਵਿਸ਼ਾ",
    or: "ପରବର୍ତ୍ତୀ ବିଷୟ",
    as: "পৰৱৰ্তী বিষয়",
    sa: "अग्रिमः विषयः",
    en: "Next topic"
  },
  "mujhe samajh": {
    hi: "मुझे समझ",
    bn: "আমার বুঝতে",
    te: "నాకు అర్థం",
    mr: "मला समज",
    ta: "எனக்கு புரிதல்",
    ur: "مجھے समझ",
    gu: "મને સમજ",
    kn: "ನನಗೆ ತಿಳುವಳಿಕೆ",
    ml: "എനിക്ക് മനസ്സിലാക്കാൻ",
    pa: "ਮੈਨੂੰ ਸਮਝ",
    or: "ମୋର ବୁଝାମଣା",
    as: "মোৰ বুজা",
    sa: "मम अवगमनम्",
    en: "My understanding"
  },
  "mujhe samajh nahi aaya": {
    hi: "मुझे समझ नहीं आया",
    bn: "আমি বুঝতে পারিনি",
    te: "నాకు అర్థం కాలేదు",
    mr: "मला समजले नाही",
    ta: "எனக்கு புரியவில்லை",
    ur: "مجھے سمجھ نہیں آیا",
    gu: "મને સમજાયું નથી",
    kn: "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ",
    ml: "എനിക്ക് മനസ്സിലായില്ല",
    pa: "ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਇਆ",
    or: "ମୁଁ ବୁଝିପାରିଲି ନାହିଁ",
    as: "মই বুজি নাপালোঁ",
    sa: "मया न ज्ञातम्",
    en: "I did not understand"
  }
};

const translationCache = new Map();
const lang = t => /[\u0900-\u097f]/.test(t) ? "hi" : /[a-z]/i.test(t) ? "en" : null;

// Free API Translation Engine (Google Translate primary + MyMemory/offline fallback)
async function fetchFreeTranslation(text, srcLang, tgtLang) {
  if (!text || !text.trim()) return "";
  const cleanInput = text.trim();
  const normKey = cleanInput.toLowerCase().replace(/[?.,!।]/g, "").trim();

  // 1. Instant check against exact classroom offline translations
  if (normKey && Object.prototype.hasOwnProperty.call(OFFLINE_TRANSLATIONS, normKey)) {
    const map = OFFLINE_TRANSLATIONS[normKey];
    if (map[tgtLang]) return map[tgtLang];
  }

  // 2. Skip network only when text is purely already in the target script
  const hasLatin = /[a-z]/i.test(cleanInput);
  const hasDevanagari = /[\u0900-\u097f]/.test(cleanInput);
  const hasOtherNonAscii = /[^\x00-\x7F]/.test(cleanInput);
  if (tgtLang === "en" && hasLatin && !hasOtherNonAscii) {
    return cleanInput;
  }
  if (tgtLang === "hi" && hasDevanagari && !hasLatin) {
    return cleanInput;
  }

  // 3. Check in-memory cache
  const cacheKey = `${cleanInput}|${tgtLang}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // 4. Primary: Google Translate endpoint (supports auto-detect, Hinglish, and all 14 Indian languages)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tgtLang)}&dt=t&q=${encodeURIComponent(cleanInput)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const trans = data[0].map(part => (Array.isArray(part) ? part[0] : "")).join("").trim();
        if (trans) {
          translationCache.set(cacheKey, trans);
          return trans;
        }
      }
    }
  } catch (err) { }

  // 5. Fallback: MyMemory Translation API
  try {
    const src = srcLang && srcLang !== tgtLang ? srcLang : (hasDevanagari && !hasLatin ? "hi" : "en");
    if (src !== tgtLang) {
      const pair = `${src}|${tgtLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanInput)}&langpair=${pair}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.responseData && data.responseData.translatedText) {
          const trans = decodeHtmlEntities(data.responseData.translatedText);
          if (!trans.includes("PLEASE SELECT TWO DISTINCT") && !trans.includes("MYMEMORY WARNING")) {
            translationCache.set(cacheKey, trans);
            return trans;
          }
        }
      }
    }
  } catch (err) { }

  return fallbackTranslate(cleanInput, srcLang, tgtLang);
}

function fallbackTranslate(txt, srcLang, tgtLang) {
  if (srcLang === tgtLang) return txt;

  const EN_HI_MAP = {
    today: "आज", we: "हम", will: "", study: "पढ़ेंगे", light: "प्रकाश", food: "भोजन",
    question: "सवाल", questions: "सवाल", class: "कक्षा", next: "अगला", topic: "विषय",
    any: "कोई", photosynthesis: "photosynthesis", far: "तक", so: "अब", hello: "नमस्ते"
  };

  const HI_EN_MAP = {
    "का": "of", "मतलब": "meaning", "है": "is", "से": "from", "बनाना": "making",
    "मुझे": "I", "समझ": "understand", "नहीं": "not", "आया": "got", "नमस्ते": "hello"
  };

  if (tgtLang === "hi") {
    return txt.split(" ").map(w => {
      const k = w.toLowerCase().replace(/[.,?!]/g, "");
      return k in EN_HI_MAP ? EN_HI_MAP[k] : w;
    }).filter(Boolean).join(" ");
  }

  if (tgtLang === "en") {
    return txt.split(" ").map(w => {
      const k = w.toLowerCase().replace(/[.,?!]/g, "");
      return k in HI_EN_MAP ? HI_EN_MAP[k] : w;
    }).filter(Boolean).join(" ");
  }

  return txt;
}

// Room State and Participants
let room, clients;
const NAMES = [
  ["teacher", "Ms. Rao", "speaker", 30],
  ["student", "Aman", "speaker", 70],
  ["viewer", "Projector View", "viewer", 40]
];

function fresh() {
  room = {
    seq: 0,
    segs: new Map(),
    order: [],
    m: { delay: [], tdelay: [], rev: 0, cor: 0, rej: 0, dup: 0 }
  };
  clients = {};
  NAMES.forEach(([id, name, role, lat]) => {
    clients[id] = {
      id,
      name,
      role,
      lat,
      on: false,
      last: -1,
      view: new Map(),
      hl: {},
      open: null,
      fix: null,
      synced: null,
      recognizing: false
    };
  });
}

const pub = s => ({
  id: s.id,
  speaker: s.speaker,
  name: s.name,
  start: s.start,
  end: s.end,
  rev: s.rev,
  final: s.final,
  intr: s.intr,
  words: s.words.map(w => ({ ...w })),
  ov: [...s.ov],
  tr: JSON.parse(JSON.stringify(s.tr)),
  cors: [...s.cors]
});

function emit(type, seg, extra = {}) {
  const ev = { seq: ++room.seq, type, ...extra };
  if (seg) {
    seg.last = ev.seq;
    ev.seg = pub(seg);
  }
  Object.values(clients).forEach(c => {
    if (c.on) {
      setTimeout(() => {
        if (c.on) recv(c, ev);
      }, c.lat);
    }
  });
}

function recv(c, ev) {
  c.last = Math.max(c.last, ev.seq);
  if (ev.seg) {
    c.view.set(ev.seg.id, ev.seg);
    if (ev.revised && ev.revised.length) {
      c.hl[ev.seg.id] = ev.revised;
      setTimeout(() => {
        delete c.hl[ev.seg.id];
        draw(c);
      }, 1800);
    }
    if (c.id === "viewer" && ev.type === "segment" && ev.t0) {
      room.m.delay.push(now() - ev.t0);
    }
  }
  draw(c);
  stats();
}

function connect(id, rejoin) {
  const c = clients[id];
  if (!c || c.on) return;
  const snap = room.order.map(i => room.segs.get(i)).filter(s => s.last > c.last);
  c.on = true;
  if (rejoin) room.m.rej++;
  snap.forEach(s => c.view.set(s.id, pub(s)));
  c.last = room.seq;
  room.order.forEach(i => {
    const s = room.segs.get(i);
    if (s.speaker === id && s.intr) {
      s.intr = false;
      emit("segment", s);
    }
  });
  c.synced = rejoin ? snap.length : null;
  draw(c);
}

function disconnect(id) {
  const c = clients[id];
  if (!c) return;
  c.on = false;
  if (c.recognizing) stopSpeechRecognition(id);
  room.order.forEach(i => {
    const s = room.segs.get(i);
    if (s.speaker === id && !s.final && !s.intr) {
      s.intr = true;
      emit("segment", s);
    }
  });
  draw(c);
}

function parse(text) {
  let prev = "en";
  return text.trim().split(/\s+/).filter(Boolean).map(t => {
    const low = t.endsWith("?") && t.length > 1;
    const w = low ? t.slice(0, -1) : t;
    const l = lang(w) || prev;
    prev = l;
    return { t: w, c: low ? 0.4 : 1, l, u: low };
  });
}

function hyp(pid, sid, text, final) {
  const c = clients[pid];
  if (!c || !c.on) return "offline";
  const t0 = now();
  const rel = t0 - T0;
  let s = room.segs.get(sid);
  const words = parse(text);

  if (s && s.final) {
    room.m.dup++;
    stats();
    return "ignored";
  }

  if (!s) {
    s = {
      id: sid,
      speaker: pid,
      name: c.name,
      start: rel,
      end: rel,
      words: [],
      rev: 0,
      final: false,
      intr: false,
      tr: {},
      cors: [],
      ov: new Set(),
      last: 0,
      tok: 0
    };
    room.segs.set(sid, s);
    room.order.push(sid);
  }

  const old = s.words;
  for (let i = 0; i < Math.min(old.length, words.length); i++) {
    if (old[i].cor) words[i] = old[i];
  }

  const chg = words.map((w, i) => (i >= old.length || old[i].t !== w.t ? i : -1)).filter(i => i >= 0);
  const flip = final && !s.final;
  s.end = Math.max(s.end, rel);

  if (!chg.length && !flip && words.length === old.length) {
    room.m.dup++;
    stats();
    return "ignored";
  }

  const revised = chg.filter(i => i < old.length);
  if (revised.length) room.m.rev++;

  s.words = words;
  s.rev++;
  s.rt = t0;
  s.final = s.final || final;

  // Detect overlapping speech segments
  room.order.forEach(oid => {
    const o = room.segs.get(oid);
    if (o.id !== s.id && o.speaker !== s.speaker && s.start < o.end && o.start < s.end && !s.ov.has(o.id)) {
      s.ov.add(o.id);
      o.ov.add(s.id);
      emit("segment", o);
    }
  });

  emit("segment", s, { revised, t0 });
  translate(s, s.final ? 0 : 120);

  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "HYP", data: { pid, sid, text, final } });
  }
  saveRoomState();
  return "ok";
}

// Multilingual translation: ensures target language for Teacher, Student, and Viewer
async function translate(s, delay) {
  const tok = ++s.tok;
  const rev = s.rev;
  if (delay) await sleep(delay);
  if (s.tok !== tok || s.rev !== rev) return;

  const rawSentence = s.words.map(w => w.t).join(" ");
  if (!rawSentence.trim()) return;
  const srcLang = s.words.some(w => w.l === "hi") ? "hi" : "en";

  const targetLangs = [...new Set([studentTargetLang, viewerTargetLang, "hi", "en"])];

  await Promise.all(targetLangs.map(async tgt => {
    const translated = await fetchFreeTranslation(rawSentence, srcLang, tgt);
    if (s.tok !== tok || s.rev !== rev) return;

    s.tr[tgt] = {
      text: translated || rawSentence,
      src: rev,
      unsure: s.words.some(w => w.u)
    };
    room.m.tdelay.push(now() - s.rt);
    emit("translation", s);

    if (s.final && s.words.length > 0 && tgt === studentTargetLang) {
      Gemma4.setContext(s.id, rawSentence, s.tr[tgt].text, s.name, srcLang, tgt);
    }
  }));

  if (s.tok === tok && s.rev === rev) {
    stats();
    saveRoomState();
  }
}

async function setStudentTargetLanguage(newLang) {
  studentTargetLang = newLang;
  viewerTargetLang = newLang;

  const studentLabel = $("#studentLangLabel");
  if (studentLabel) studentLabel.textContent = getLangName(newLang);
  const viewerLabel = $("#viewerLangLabel");
  if (viewerLabel) viewerLabel.textContent = getLangName(newLang);

  Object.values(clients).forEach(c => {
    if (c.on) draw(c);
  });

  room.order.forEach(id => {
    const s = room.segs.get(id);
    if (s) translate(s, 0);
  });

  closeLangModal();
  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "LANG_CHANGE", data: { lang: newLang } });
  }
  saveRoomState();
}

function correct(sid, i, txt, by) {
  const s = room.segs.get(sid);
  if (!s || !txt) return;
  const w = s.words[i];
  s.cors.push({ i, old: w.t, nw: txt, by, at: now() - T0 });
  Object.assign(w, { t: txt, c: 1, u: false, cor: true });
  s.rev++;
  s.rt = now();
  room.m.cor++;
  emit("segment", s, { revised: [i] });
  translate(s, 0);

  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "CORRECT", data: { sid, i, txt, by } });
  }
  saveRoomState();
}

// =========================================================
// ENHANCED SPEECH RECOGNITION (Ultra-smooth teacher listening)
// =========================================================
let recognizers = {};

function toggleSpeech(pid) {
  const c = clients[pid];
  if (!c || !c.on) {
    alert("Please connect " + (c ? c.name : pid) + " first!");
    return;
  }
  if (c.recognizing) {
    stopSpeechRecognition(pid);
  } else {
    startSpeechRecognition(pid);
  }
}

function startSpeechRecognition(pid) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert("Web Speech API is not supported in this browser. Please type into the input field or use the quick chips.");
    return;
  }

  const rec = new SpeechRec();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = pid === "student" ? (studentTargetLang === "hi" ? "hi-IN" : "en-US") : "en-US";

  const c = clients[pid];
  c.recognizing = true;
  recognizers[pid] = rec;

  const micBtn = $(`#mic-${pid}`);
  if (micBtn) micBtn.classList.add("recording");

  // Show live wave indicator if teacher
  if (pid === "teacher") {
    updateTeacherMicVisuals(true);
    if (!isRemoteSync && syncChannel) {
      syncChannel.postMessage({ type: "MIC_STATE", data: { speaker: "teacher", active: true } });
    }
  }

  rec.onresult = (event) => {
    let interim = "";
    let finalStr = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalStr += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    const inp = $(`#p-${pid} .input-row input`);
    if (inp) inp.value = finalStr || interim;

    if (!c.open) c.open = pid + "-" + (++n);
    if (finalStr) {
      hyp(pid, c.open, finalStr, true);
      c.open = null;
      if (inp) inp.value = "";
    } else if (interim) {
      hyp(pid, c.open, interim, false);
    }
  };

  rec.onerror = (e) => {
    console.warn("Speech error:", e.error);
    if (e.error !== "no-speech") {
      stopSpeechRecognition(pid);
    }
  };

  // Auto-restart for smooth continuous listening unless explicitly stopped
  rec.onend = () => {
    if (c.recognizing) {
      try {
        rec.start();
      } catch (e) {
        stopSpeechRecognition(pid);
      }
    } else {
      stopSpeechRecognition(pid);
    }
  };

  try {
    rec.start();
  } catch (err) {
    console.error("Mic start failed", err);
    stopSpeechRecognition(pid);
  }
}

function stopSpeechRecognition(pid) {
  const c = clients[pid];
  if (c) c.recognizing = false;
  if (recognizers[pid]) {
    try { recognizers[pid].stop(); } catch (e) { }
    delete recognizers[pid];
  }
  const micBtn = $(`#mic-${pid}`);
  if (micBtn) micBtn.classList.remove("recording");

  if (pid === "teacher") {
    updateTeacherMicVisuals(false);
    if (!isRemoteSync && syncChannel) {
      syncChannel.postMessage({ type: "MIC_STATE", data: { speaker: "teacher", active: false } });
    }
  }
}

// Exports
const ts = (ms, sep) => [ms / 3600000 | 0, (ms / 60000) % 60 | 0, (ms / 1000) % 60 | 0].map(n => String(n).padStart(2, "0")).join(":") + sep + String(ms % 1000).padStart(3, "0");
const disp = s => s.words.map(w => w.u ? `[${w.t}?]` : w.t).join(" ");

function exportAs(f) {
  const ss = room.order.map(i => room.segs.get(i));
  if (f === "json") {
    return JSON.stringify(ss.map(s => ({
      id: s.id,
      speaker: s.name,
      start_ms: s.start,
      end_ms: s.end,
      rev: s.rev,
      text: disp(s),
      translations: s.tr,
      corrections: s.cors,
      overlaps: [...s.ov],
      interrupted: s.intr
    })), null, 2);
  }
  const out = ss.map((s, n) => {
    if (f === "txt") {
      return `[${ts(s.start, ".").slice(3, -4)}] ${s.name}: ${disp(s)}${s.ov.size ? " (overlap)" : ""}${s.intr ? " (interrupted)" : ""}` +
        Object.entries(s.tr).map(([l, t]) => `\n    -> ${l.toUpperCase()} (${getLangMeta(l).name}): ${t.text}`).join("") +
        s.cors.map(c => `\n    * corrected "${c.old}" to "${c.nw}" by ${c.by}`).join("");
    }
    const e = Math.max(s.end, s.start + 1200);
    const sp = f === "srt" ? "," : ".";
    return (f === "srt" ? `${n + 1}\n` : "") +
      `${ts(s.start, sp)} --> ${ts(e, sp)}\n${s.name}: ${disp(s)}${Object.values(s.tr).map(t => "\n" + t.text).join("")}\n`;
  });
  return (f === "vtt" ? "WEBVTT\n\n" : "") + (out.join("\n") || "Nothing recorded yet.");
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const pct = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.round((p / 100) * (a.length - 1)))] : "–";

function stats() {
  const m = room.m;
  const metricsEl = $("#metrics");
  if (!metricsEl) return;
  metricsEl.innerHTML = [
    ["Caption Latency (Median)", pct(m.delay, 50) + (pct(m.delay, 50) !== "–" ? " ms" : "")],
    ["Caption Latency (95th %ile)", pct(m.delay, 95) + (pct(m.delay, 95) !== "–" ? " ms" : "")],
    ["Translation Latency (Median)", pct(m.tdelay, 50) + (pct(m.tdelay, 50) !== "–" ? " ms" : "")],
    ["Dynamic Word Revisions", m.rev],
    ["Corrections Preserved", m.cor],
    ["Seamless Network Rejoins", m.rej],
    ["Duplicate Packets Blocked", m.dup]
  ].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");
}

// =========================================================
// UI PANE RENDERING (ROLE-AWARE)
// =========================================================
function build() {
  const grid = $("#grid");
  if (!grid) return;

  grid.innerHTML = Object.values(clients).map(c => `
    <section class="pane ${c.on ? "" : "off"}" id="p-${c.id}" aria-label="${c.name}">
      <div class="pane-header">
        <div class="pane-user-info">
          <div class="pane-avatar ${c.id}">
            ${c.id === "teacher" ? "👩‍🏫" : c.id === "student" ? "👨‍🎓" : "📽️"}
            <span class="avatar-status-dot"></span>
          </div>
          <div class="pane-user-meta">
            <b>${c.name}</b>
            <small>${c.role === "viewer" ? "Shared Projection Screen" : (c.id === "teacher" ? "Educator / Host" : "Student / Learner")}</small>
          </div>
        </div>
        <div class="pane-actions">
          ${c.id === "teacher" ? `
            <!-- Live voice listening indicator -->
            <div class="mic-live-indicator" id="teacherLiveWave" style="${teacherMicActive ? 'display:flex;' : 'display:none;'}">
              <div class="mic-bars-wave"><span></span><span></span><span></span><span></span><span></span></div>
              <span>Listening</span>
            </div>
          ` : ""}

          ${c.id === "student" ? `
            <!-- Raise Hand / Doubt Button -->
            <button class="btn-raise-hand ${studentHandRaised ? 'active' : ''}" id="studentRaiseHandBtn" onclick="toggleRaiseHandModal()" title="Raise hand or ask doubt to Ms. Rao">
              <span class="hand-waving-icon">✋</span>
              <span>${studentHandRaised ? "Hand Raised" : "Raise Doubt"}</span>
            </button>
          ` : ""}

          ${c.id === "student" || c.id === "viewer" ? `
            <!-- Language selector button -->
            <button class="btn-translate" id="${c.id}LangBtn" onclick="openLangModal()" title="Change language to translate to">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Translate: <b class="lang-name-label" id="${c.id}LangLabel">${getLangName(c.id === "student" ? studentTargetLang : viewerTargetLang)}</b> ▾</span>
            </button>
          ` : ""}
          <button class="btn btn-sm" data-tog="${c.id}">${c.on ? "Disconnect" : "Connect"}</button>
        </div>
      </div>

      <!-- Live Speaking Banner on Teacher stream -->
      ${c.id === "teacher" ? `
        <div class="teacher-speaking-banner" id="studentTeacherSpeakingBanner" style="${teacherMicActive ? 'display:flex;' : 'display:none;'}">
          <span class="live-dot-pulse"></span>
          <span>🎙️ Ms. Rao is speaking live via microphone</span>
        </div>
      ` : ""}

      <!-- Teacher Doubts Notification Panel -->
      ${c.id === "teacher" ? `
        <div class="teacher-doubts-panel" id="teacherDoubtsPanel" ${studentHandRaised ? "" : "style='display:none;'"}>
          <div class="doubts-panel-header">
            <span>✋ Active Student Doubt Raised:</span>
            <span class="tag tag-overlap">1 Pending</span>
          </div>
          <div class="doubt-item">
            <div class="doubt-text">
              <b>Aman:</b> “${esc(studentDoubtText || "Could you please explain Photosynthesis again?")}”
            </div>
            <div class="doubt-actions">
              <button class="btn btn-sm btn-primary" onclick="acknowledgeDoubt()">Call on Aman</button>
              <button class="btn btn-sm" onclick="answerDoubtWithGemma()">Ask Gemma 4</button>
            </div>
          </div>
        </div>
      ` : ""}

      <!-- Student Hand Raised Banner -->
      ${c.id === "student" && studentHandRaised ? `
        <div class="student-hand-banner">
          <span>✋ You raised hand: “<b>${esc(studentDoubtText)}</b>” (Waiting for teacher)</span>
          <button class="btn btn-sm" onclick="lowerHand()">Lower Hand</button>
        </div>
      ` : ""}

      <div class="fix-bar" hidden></div>
      <div class="caps" aria-live="polite"></div>

      ${c.role === "speaker" ? `
        <div class="pane-input-bar">
          <div class="quick-prompts-row">
            ${c.id === "teacher" ? `
              <span class="quick-chip" data-fill="teacher" data-txt="Today we will study photosynthesis?">Today we will study photosynthesis?</span>
              <span class="quick-chip" data-fill="teacher" data-txt="photosynthesis का मतलब है light से food बनाना">photosynthesis का मतलब...</span>
              <span class="quick-chip" data-fill="teacher" data-txt="Any questions so far?">Any questions so far?</span>
            ` : `
              <span class="quick-chip" data-fill="student" data-txt="मुझे समझ नहीं आया">मुझे समझ नहीं आया</span>
              <span class="quick-chip" data-fill="student" data-txt="photosynthesis का मतलम? है">photosynthesis का मतलम?</span>
              <span class="quick-chip" data-fill="student" data-txt="Light energy से क्या होता है?">Light energy से क्या होता है?</span>
            `}
          </div>
          <div class="input-row">
            <button class="btn-mic" id="mic-${c.id}" onclick="toggleSpeech('${c.id}')" title="Hold/click to speak with microphone">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
            <input type="text" aria-label="What ${c.name} says" placeholder="Speak with microphone or type..."/>
            <button class="btn" data-send="${c.id}">Update</button>
            <button class="btn btn-primary" data-fin="${c.id}">Finish</button>
          </div>
        </div>
      ` : ""}
    </section>
  `).join("");

  Object.values(clients).forEach(draw);
}

function fillInput(id, text) {
  const inp = $(`#p-${id} .input-row input`);
  if (inp) {
    inp.value = text;
    inp.focus();
  }
}

function draw(c) {
  const p = $("#p-" + c.id);
  if (!p) return;
  p.classList.toggle("off", !c.on);

  const togBtn = p.querySelector("[data-tog]");
  if (togBtn) {
    togBtn.textContent = c.on ? "Disconnect" : (c.last >= 0 || c.view.size ? "Rejoin" : "Connect");
  }

  const segs = [...c.view.values()].sort((a, b) => a.start - b.start);
  const capsContainer = p.querySelector(".caps");

  const paneTargetLang = c.id === "viewer" ? viewerTargetLang : studentTargetLang;

  capsContainer.innerHTML = (c.synced != null ? `<div class="tag tag-version" style="margin-bottom:8px;">✨ Reconnected: caught up on ${c.synced} changed sentence(s) without duplication</div>` : "") +
    (segs.length ? segs.map(s => {
      const hl = c.hl[s.id] || [];
      const origText = s.words.map(w => w.t).join(" ");

      let trLang = paneTargetLang;
      let trObj = s.tr[trLang];
      const isPendingTarget = !trObj;
      if (!trObj) {
        const fallbackKey = ["hi", "en", ...Object.keys(s.tr)].find(k => s.tr[k]);
        if (fallbackKey) {
          trLang = fallbackKey;
          trObj = s.tr[fallbackKey];
        }
      }
      const trText = trObj ? trObj.text : `Translating to ${getLangMeta(paneTargetLang).name}...`;
      const langMeta = getLangMeta(trObj ? trLang : paneTargetLang);

      return `
        <div class="seg ${s.final ? "" : "partial"}" id="seg-${c.id}-${s.id}">
          <div class="seg-meta">
            <span class="who-badge">${esc(s.name)}</span>
            <div class="tag-list">
              ${s.ov.length ? '<span class="tag tag-overlap">⚡ Overlap</span>' : ""}
              ${s.intr ? '<span class="tag tag-interrupted">⚠️ Interrupted</span>' : ""}
              ${s.rev > 1 ? `<span class="tag tag-version">v${s.rev}</span>` : ""}
            </div>
          </div>

          <div class="txt">
            ${s.words.map((w, i) => `
              <span class="w ${w.u ? "u" : ""} ${w.cor ? "c" : ""} ${hl.includes(i) ? "chg" : ""}"
                ${w.u ? `tabindex="0" role="button" data-fix="${c.id}|${s.id}|${i}" title="Unsure word. Click to correct"` : ""}>
                ${esc(w.t)}
              </span>
            `).join(" ")}
          </div>

          ${trObj ? `
            <div class="tr-row">
              <div class="tr-box ${trObj.src !== s.rev ? "stale" : ""}">
                <div class="tr-text-wrap">
                  <span class="tr-lang-badge" title="${langMeta.name}">${langMeta.flag} ${langMeta.native}</span>
                  <span class="tr-content">${esc(trText)}</span>
                  <button class="btn-speak-tr" data-speak-seg="${s.id}" data-speak-lang="${trLang}" title="Listen to pronunciation">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  </button>
                </div>
                
                <!-- Floating Gemma 4 Option during Translation -->
                <button class="gemma-floating-trigger" data-gemma-seg="${s.id}" data-gemma-lang="${trLang}" title="Ask Gemma 4 questions regarding this translation">
                  <svg class="gemma-sparkle-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z"/></svg>
                  <span>Ask Gemma 4</span>
                </button>
              </div>
            </div>
          ` : ""}
        </div>
      `;
    }).join("") : `
      <div class="caps-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" style="width:36px;height:36px;max-width:36px;max-height:36px;min-width:36px;min-height:36px;display:block;margin:0 auto;" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>${c.on ? (c.id === "student" ? "Waiting for Ms. Rao's speech... Captions will translate here in real time." : "Waiting for speech... Speak with the mic or type below.") : "Disconnected. Click Connect to join."}</p>
      </div>
    `);

  capsContainer.scrollTop = capsContainer.scrollHeight;

  const f = p.querySelector(".fix-bar");
  if (c.fix) {
    f.hidden = false;
    f.innerHTML = `
      <span>Correct “<b>${esc(c.fix.word)}</b>” to:</span>
      <input value="${esc(c.fix.word)}" aria-label="Corrected word"/>
      <button class="btn btn-sm btn-primary" data-apply="${c.id}">Save Correction</button>
      <button class="btn btn-sm" data-cancel="${c.id}">Cancel</button>
    `;
    const inp = f.querySelector("input");
    if (inp) {
      inp.focus();
      inp.select();
    }
  } else {
    f.hidden = true;
  }
}

let n = 0;
function send(id, final) {
  const c = clients[id];
  const inp = $(`#p-${id} .input-row input`);
  const text = inp ? inp.value : "";
  if (!text.trim() || !c.on) return;

  if (!c.open) c.open = id + "-" + (++n);
  hyp(id, c.open, text, final);
  if (final) {
    c.open = null;
    inp.value = "";
  }
}

// =========================================================
// ROLE SELECTION & LOGIN SYSTEM
// =========================================================
function openRoleSelect() {
  const roleModal = $("#roleSelectModal");
  if (roleModal) roleModal.classList.remove("hidden");
  const loginModal = $("#loginModal");
  if (loginModal) loginModal.classList.add("hidden");
}

function switchLoginRole(role) {
  currentUserRole = role;

  const tabTeacher = $("#tabTeacher");
  const tabStudent = $("#tabStudent");
  if (tabTeacher) tabTeacher.classList.toggle("active", role === "teacher");
  if (tabStudent) tabStudent.classList.toggle("active", role === "student");

  const badge = $("#loginRoleBadge");
  const heading = $("#loginHeading");
  const subtext = $("#loginSubtext");
  const emailInp = $("#loginEmail");
  const submitBtn = $("#loginSubmitBtn");
  const quickBtn = $("#loginQuickBtn");
  const roomChip = $("#loginRoomChip");

  if (role === "teacher") {
    if (badge) {
      badge.innerHTML = "👩‍🏫 Educator Portal";
      badge.className = "login-role-tag teacher";
    }
    if (heading) heading.textContent = "Teacher Sign In";
    if (subtext) subtext.textContent = "Host live speech broadcast, stream to classroom projector & resolve doubts.";
    if (emailInp) emailInp.value = "teacher@voxa.edu";
    if (submitBtn) submitBtn.innerHTML = `<span>Start Teaching (Host)</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
    if (quickBtn) quickBtn.innerHTML = `⚡ Quick 1-Click Launch (Teacher Mode)`;
    if (roomChip) roomChip.innerHTML = `<span class="room-dot online"></span> Room BIO-101 · Host Session`;
  } else {
    if (badge) {
      badge.innerHTML = "👨‍🎓 Student Desk";
      badge.className = "login-role-tag student";
    }
    if (heading) heading.textContent = "Student Sign In";
    if (subtext) subtext.textContent = "Listen to live captions in your Indian dialect & ask doubts.";
    if (emailInp) emailInp.value = "aman.student@voxa.edu";
    if (submitBtn) submitBtn.innerHTML = `<span>Join Student Desk</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
    if (quickBtn) quickBtn.innerHTML = `⚡ Quick 1-Click Launch (Student Mode)`;
    if (roomChip) roomChip.innerHTML = `<span class="room-dot online"></span> Room BIO-101 · Connected to Ms. Rao`;
  }
}

function selectRole(role) {
  switchLoginRole(role);
  const roleModal = $("#roleSelectModal");
  if (roleModal) roleModal.classList.add("hidden");

  const loginModal = $("#loginModal");
  if (loginModal) loginModal.classList.remove("hidden");
}

function closeLoginModal() {
  const loginModal = $("#loginModal");
  if (loginModal) loginModal.classList.add("hidden");
  applyUserRole(currentUserRole);
}

function togglePasswordVisibility() {
  const pwd = $("#loginPassword");
  const eye = $("#togglePwdIcon");
  if (!pwd) return;
  if (pwd.type === "password") {
    pwd.type = "text";
    if (eye) eye.textContent = "🙈";
  } else {
    pwd.type = "password";
    if (eye) eye.textContent = "👁️";
  }
}

function submitLogin(isDemo = false) {
  const loginModal = $("#loginModal");
  if (loginModal) loginModal.classList.add("hidden");

  // Launch Voxa 3D Rotating Cube Loader
  const loader = $("#voxaLoaderScreen");
  if (loader && !isDemo) {
    loader.classList.remove("hidden");
    cycleVoxaStatus();

    setTimeout(() => {
      loader.classList.add("hidden");
      applyUserRole(currentUserRole);
    }, 1200);
  } else {
    if (loader) loader.classList.add("hidden");
    applyUserRole(currentUserRole);
  }
}

function cycleVoxaStatus() {
  const wrap = $("#voxaStatusWrap");
  if (!wrap) return;
  const items = Array.from(wrap.querySelectorAll(".status"));
  let idx = 0;
  items.forEach(el => el.classList.remove("show"));
  if (items[0]) items[0].classList.add("show");

  const interval = setInterval(() => {
    items.forEach(el => el.classList.remove("show"));
    idx = (idx + 1) % items.length;
    if (items[idx]) items[idx].classList.add("show");
  }, 450);

  setTimeout(() => clearInterval(interval), 2400);
}

function applyUserRole(role) {
  currentUserRole = role;
  document.body.classList.remove("role-teacher", "role-student");
  document.body.classList.add("role-" + role);

  const nameEl = $("#headerUserName");
  const avatarEl = $("#headerUserAvatar");
  const badge = $("#headerUserBadge");
  if (badge) {
    badge.className = "user-role-badge " + role;
  }
  if (role === "teacher") {
    if (nameEl) nameEl.textContent = "Ms. Rao (Teacher)";
    if (avatarEl) avatarEl.textContent = "👩‍🏫";
    // Connect teacher & projector
    connect("teacher", false);
    connect("viewer", false);
  } else {
    if (nameEl) nameEl.textContent = "Aman (Student)";
    if (avatarEl) avatarEl.textContent = "👨‍🎓";
    // Connect teacher & student, projector stays hidden for student
    connect("teacher", false);
    connect("student", false);
  }

  build();
  stats();
}

// =========================================================
// STUDENT RAISE HAND & DOUBT MANAGEMENT
// =========================================================
function toggleRaiseHandModal() {
  if (studentHandRaised) {
    lowerHand();
  } else {
    openDoubtModal();
  }
}

function openDoubtModal() {
  const modal = $("#doubtModal");
  if (modal) {
    modal.classList.add("active");
    const inp = $("#doubtCustomInput");
    if (inp) {
      inp.value = "";
      inp.focus();
    }
  }
}

function closeDoubtModal() {
  const modal = $("#doubtModal");
  if (modal) modal.classList.remove("active");
}

function submitDoubt(text) {
  studentHandRaised = true;
  studentDoubtText = text;
  closeDoubtModal();

  Gemma4.playChime("sparkle");
  build();

  $("#story").textContent = `✋ Aman raised a hand: “${text}”`;

  // Show alert on teacher side
  const doubtsPanel = $("#teacherDoubtsPanel");
  if (doubtsPanel) {
    doubtsPanel.style.display = "flex";
  }

  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "DOUBT_RAISED", data: { text } });
  }
  saveRoomState();
}

function submitCustomDoubt() {
  const inp = $("#doubtCustomInput");
  const val = inp ? inp.value.trim() : "";
  if (!val) {
    alert("Please select a suggested doubt or type your question.");
    return;
  }
  submitDoubt(val);
}

function lowerHand() {
  studentHandRaised = false;
  studentDoubtText = "";
  build();
  $("#story").textContent = "Aman lowered their hand.";

  const doubtsPanel = $("#teacherDoubtsPanel");
  if (doubtsPanel) doubtsPanel.style.display = "none";

  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "HAND_LOWERED" });
  }
  saveRoomState();
}

function acknowledgeDoubt() {
  Gemma4.playChime("pop");
  studentHandRaised = false;
  const ackText = studentDoubtText;
  studentDoubtText = "";
  build();

  const storyEl = $("#story");
  if (storyEl) storyEl.textContent = `👩‍🏫 Ms. Rao called on Aman! Aman has the floor to speak.`;
  const doubtsPanel = $("#teacherDoubtsPanel");
  if (doubtsPanel) doubtsPanel.style.display = "none";

  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "DOUBT_ACK", data: { text: ackText } });
  }
  saveRoomState();
}

function answerDoubtWithGemma() {
  Gemma4.open();
  Gemma4.askQuestion(studentDoubtText || "Explain Photosynthesis mechanism in simple terms");
  acknowledgeDoubt();
}

// =========================================================
// GLOBAL CLICK HANDLERS
// =========================================================
document.addEventListener("click", e => {
  const gemmaBtn = e.target.closest("[data-gemma-seg]");
  if (gemmaBtn) {
    const sid = gemmaBtn.dataset.gemmaSeg;
    const langKey = gemmaBtn.dataset.gemmaLang;
    const seg = room.segs.get(sid);
    if (seg) {
      const origText = seg.words.map(w => w.t).join(" ");
      const transText = seg.tr[langKey] ? seg.tr[langKey].text : "";
      Gemma4.inspectSegment(sid, origText, transText, seg.name, seg.words[0]?.l || "en", langKey);
    }
    return;
  }

  const speakBtn = e.target.closest("[data-speak-seg]");
  if (speakBtn) {
    const sid = speakBtn.dataset.speakSeg;
    const langKey = speakBtn.dataset.speakLang;
    const seg = room.segs.get(sid);
    if (seg && seg.tr[langKey]) {
      Gemma4.speak(seg.tr[langKey].text, langKey);
    }
    return;
  }

  const chip = e.target.closest("[data-fill]");
  if (chip) {
    fillInput(chip.dataset.fill, chip.dataset.txt);
    return;
  }

  const t = e.target.closest("[data-tog],[data-send],[data-fin],[data-fix],[data-apply],[data-cancel],[data-ex],[data-dl]");
  if (!t) return;
  const d = t.dataset;

  if (d.tog) {
    const c = clients[d.tog];
    c.on ? disconnect(d.tog) : connect(d.tog, c.last >= 0);
  } else if (d.send) {
    send(d.send, false);
  } else if (d.fin) {
    send(d.fin, true);
  } else if (d.fix) {
    const [cid, sid, i] = d.fix.split("|");
    clients[cid].fix = { sid, i: +i, word: clients[cid].view.get(sid).words[+i].t };
    draw(clients[cid]);
  } else if (d.apply) {
    const c = clients[d.apply];
    const v = $(`#p-${c.id} .fix-bar input`).value.trim();
    correct(c.fix.sid, c.fix.i, v, c.name);
    c.fix = null;
    draw(c);
  } else if (d.cancel) {
    clients[d.cancel].fix = null;
    draw(clients[d.cancel]);
  } else if (d.ex) {
    $("#export").textContent = exportAs(d.ex);
  } else if (d.dl) {
    const fmt = d.dl;
    const content = exportAs(fmt);
    const mime = fmt === "json" ? "application/json" : "text/plain";
    downloadFile(content, `lesson-transcript.${fmt}`, mime);
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches(".input-row input")) {
    const pane = e.target.closest(".pane");
    if (pane) send(pane.id.slice(2), true);
  }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".w.u")) {
    e.preventDefault();
    e.target.click();
  }
});

// =========================================================
// LANGUAGE PICKER MODAL
// =========================================================
function renderLangGrid(filter = "") {
  const grid = $("#langGrid");
  if (!grid) return;
  const q = filter.toLowerCase().trim();

  const filtered = INDIAN_LANGUAGES.filter(l =>
    !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
  );

  grid.innerHTML = filtered.map(l => `
    <button class="lang-option-btn ${l.code === studentTargetLang ? "active" : ""}" onclick="setStudentTargetLanguage('${l.code}')">
      <div class="lang-opt-main">
        <span class="lang-opt-name">${l.flag} ${l.name}</span>
        <span class="lang-opt-native">${l.native}</span>
      </div>
      <svg class="lang-opt-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
  `).join("");
}

function openLangModal() {
  const modal = $("#langModal");
  if (modal) {
    modal.classList.add("active");
    renderLangGrid();
    const input = $("#langSearchInput");
    if (input) {
      input.value = "";
      input.focus();
    }
  }
}

function closeLangModal() {
  const modal = $("#langModal");
  if (modal) modal.classList.remove("active");
}

function resetRoom() {
  demoRun++;
  fresh();
  Object.keys(clients).forEach(i => connect(i, false));
  Object.values(clients).forEach(c => c.synced = null);
  studentHandRaised = false;
  studentDoubtText = "";
  updateTeacherMicVisuals(false);
  build();
  stats();
  $("#story").textContent = "Room reset. Speak or type in a pane, or launch the guided demo.";
  $("#demoProgress").textContent = "Ready";
  $("#export").textContent = "Choose a format above to preview or download the transcript.";

  if (!isRemoteSync && syncChannel) {
    syncChannel.postMessage({ type: "RESET" });
  }
  saveRoomState();
}

// Guided Demo
let demoRun = 0;
async function demo() {
  resetRoom();
  const me = demoRun;
  const story = $("#story");
  const prog = $("#demoProgress");

  const say = async (m, stepStr, ms) => {
    if (me !== demoRun) throw 0;
    story.textContent = m;
    prog.textContent = stepStr;
    if (!isRemoteSync && syncChannel) {
      syncChannel.postMessage({ type: "STORY", data: { story: m, progress: stepStr } });
    }
    saveRoomState();
    await sleep(ms);
  };

  try {
    updateTeacherMicVisuals(true);
    if (!isRemoteSync && syncChannel) {
      syncChannel.postMessage({ type: "MIC_STATE", data: { speaker: "teacher", active: true } });
    }
    await say("1. Ms. Rao starts speaking in English. Notice the live audio listening wave!", "Step 1 / 7", 500);
    hyp("teacher", "t1", "Today we will study photo-cent-this?", false);
    await say(`Unsure word highlighted; translated to ${getLangMeta(studentTargetLang).name} in real time!`, "Step 1 / 7", 1800);

    hyp("teacher", "t1", "Today we will study photosynthesis", true);
    await say(`2. More speech arrives! Word revised in-place to 'photosynthesis', translation syncs to ${getLangMeta(studentTargetLang).name}.`, "Step 2 / 7", 2200);

    hyp("teacher", "t2", "photosynthesis का मतलम? है light से food बनाना", true);
    await say(`3. Teacher now speaks in Hindi! Translation to ${getLangMeta(studentTargetLang).name} continues seamlessly!`, "Step 3 / 7", 2500);

    correct("t2", 2, "मतलब", "Aman");
    await say("4. Aman corrects the typo inline. The revision is locked across all screens.", "Step 4 / 7", 2000);

    // Aman raises a hand
    submitDoubt("Could you please explain Photosynthesis mechanism again?");
    await say("5. Aman raises a hand with a doubt! Ms. Rao gets an instant chime and notification.", "Step 5 / 7", 2400);

    updateTeacherMicVisuals(false);
    if (!isRemoteSync && syncChannel) {
      syncChannel.postMessage({ type: "MIC_STATE", data: { speaker: "teacher", active: false } });
    }

    acknowledgeDoubt();
    await say("6. Ms. Rao acknowledges the doubt and invites Aman to speak.", "Step 6 / 7", 1800);

    disconnect("student");
    await say("7. Aman temporarily drops off. Ms. Rao continues instructing.", "Step 7 / 7", 1000);

    hyp("teacher", "t3", "Any questions so far", true);
    connect("student", true);
    await say("Aman reconnects with zero duplicate packets! Click 'Ask Gemma 4' to explore linguistic Q&A.", "Complete ✨", 2000);

    $("#export").textContent = exportAs("txt");
  } catch (e) { }
}

function initTheme() {
  const saved = localStorage.getItem("captionroom_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", cur);
  localStorage.setItem("captionroom_theme", cur);
  updateThemeIcon(cur);
}

function updateThemeIcon(t) {
  const icon = $("#themeIcon");
  if (!icon) return;
  if (t === "dark") {
    icon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

// Window OnLoad
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  fresh();
  Object.keys(clients).forEach(i => connect(i, false));
  Object.values(clients).forEach(c => c.synced = null);

  // Auto-detect role from URL, pathname, or body dataset
  const path = window.location.pathname.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const dedicatedRole = document.body.dataset.defaultRole || 
    (path.includes("teacher") ? "teacher" : path.includes("student") ? "student" : urlParams.get("role"));

  if (dedicatedRole === "teacher") {
    // Dedicated Teacher Page
    const roleModal = $("#roleSelectModal");
    if (roleModal) roleModal.classList.add("hidden");
    const loginModal = $("#loginModal");
    if (loginModal) loginModal.classList.remove("hidden");
    selectRole("teacher");
    applyUserRole("teacher");
  } else if (dedicatedRole === "student") {
    // Dedicated Student Page
    const roleModal = $("#roleSelectModal");
    if (roleModal) roleModal.classList.add("hidden");
    const loginModal = $("#loginModal");
    if (loginModal) loginModal.classList.remove("hidden");
    selectRole("student");
    applyUserRole("student");
  } else {
    // Default Portal with role selection
    applyUserRole("teacher");
  }

  // Restore synced room state from localStorage if recent
  try {
    const saved = localStorage.getItem("voxa_room_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Date.now() - (parsed.ts || 0) < 6 * 3600 * 1000) {
        importRoomState(parsed);
      }
    }
  } catch (e) {
    console.warn("Storage restore error:", e);
  }

  // Request fresh live snapshot from any open tab
  if (syncChannel) {
    syncChannel.postMessage({ type: "STATE_REQ" });
  }

  // Initialize Gemma 4 Assistant
  Gemma4.init();

  // Language modal close & search
  const modalClose = $("#langModalClose");
  const modalOverlay = $("#langModal");
  if (modalClose) modalClose.onclick = closeLangModal;
  if (modalOverlay) {
    modalOverlay.onclick = e => {
      if (e.target === modalOverlay) closeLangModal();
    };
  }
  const searchInp = $("#langSearchInput");
  if (searchInp) {
    searchInp.oninput = e => renderLangGrid(e.target.value);
  }

  // Tour button triggers 3D cube loader preview
  const tourBtn = $("#welcomeTourBtn");
  if (tourBtn) {
    tourBtn.onclick = () => {
      const loader = $("#voxaLoaderScreen");
      if (loader) {
        loader.classList.remove("hidden");
        cycleVoxaStatus();
        setTimeout(() => loader.classList.add("hidden"), 3400);
      }
    };
  }

  $("#demo").onclick = demo;
  $("#reset").onclick = resetRoom;
  $("#themeBtn").onclick = toggleTheme;
  $("#meetGemmaBtn").onclick = () => Gemma4.open();
});
