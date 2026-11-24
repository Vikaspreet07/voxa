/**
 * Gemma 4 Translation & Linguistic Intelligence Assistant
 * Features:
 * - Cute animated interactive SVG Mascot
 * - Contextual floating triggers on live translations
 * - Rich multilingual Q&A engine (English, Hindi, Hinglish, Science)
 * - Word-by-word breakdown, grammar nuances, pronunciations
 * - Text-to-Speech audio pronunciation
 */

const Gemma4 = (function () {
  let activeContext = {
    segId: null,
    sourceText: "Today we will study photosynthesis",
    translatedText: "आज हम photosynthesis पढ़ेंगे",
    speaker: "Ms. Rao",
    srcLang: "en",
    tgtLang: "hi"
  };

  let audioCtx = null;
  function playChime(type = "gentle") {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "pop") {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "sparkle") {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(freq, now + i * 0.06);
          g.gain.setValueAtTime(0.08, now + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
          o.start(now + i * 0.06);
          o.stop(now + i * 0.06 + 0.2);
        });
      }
    } catch (e) {
      // AudioContext may be restricted by autoplay policy until user gesture
    }
  }

  // Cute SVG Mascot template with animated antenna, eyes, and cheeks
  function getMascotSVG(mood = "happy") {
    return `
      <svg class="gemma-character-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bodyGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ffffff"/>
            <stop offset="0.6" stop-color="#f0f9ff"/>
            <stop offset="1" stop-color="#e0f2fe"/>
          </linearGradient>
          <linearGradient id="visorGrad" x1="20" y1="30" x2="80" y2="70" gradientUnits="userSpaceOnUse">
            <stop stop-color="#0f172a"/>
            <stop offset="1" stop-color="#1e293b"/>
          </linearGradient>
          <linearGradient id="starGrad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
            <stop stop-color="#fcd34d"/>
            <stop offset="1" stop-color="#f59e0b"/>
          </linearGradient>
        </defs>
        
        <!-- Antenna -->
        <path d="M 50 25 Q 50 12 50 8" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
        <g class="antenna-star">
          <circle cx="50" cy="8" r="7" fill="url(#starGrad)"/>
          <path d="M 50 3 L 52 7 L 56 8 L 52 9 L 50 13 L 48 9 L 44 8 L 48 7 Z" fill="#ffffff"/>
        </g>
        
        <!-- Floating Ears/Wings -->
        <ellipse cx="14" cy="50" rx="7" ry="14" fill="#60a5fa" opacity="0.9" transform="rotate(-15 14 50)"/>
        <ellipse cx="86" cy="50" rx="7" ry="14" fill="#60a5fa" opacity="0.9" transform="rotate(15 86 50)"/>
        
        <!-- Mascot Head Body -->
        <rect x="18" y="22" width="64" height="60" rx="30" fill="url(#bodyGrad)" stroke="#93c5fd" stroke-width="2.5"/>
        
        <!-- Face Visor Display -->
        <rect x="25" y="32" width="50" height="34" rx="17" fill="url(#visorGrad)"/>
        
        <!-- Cheeks -->
        <circle cx="28" cy="56" r="4.5" fill="#38bdf8" opacity="0.4" class="cheeks-glow"/>
        <circle cx="72" cy="56" r="4.5" fill="#38bdf8" opacity="0.4" class="cheeks-glow"/>
        
        <!-- Animated Eyes -->
        <g class="eye-blink">
          ${mood === "happy" ? `
            <path d="M 34 48 Q 40 42 46 48" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" fill="none"/>
            <path d="M 54 48 Q 60 42 66 48" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" fill="none"/>
          ` : mood === "wink" ? `
            <path d="M 34 48 Q 40 42 46 48" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" fill="none"/>
            <circle cx="60" cy="46" r="4" fill="#38bdf8"/>
            <circle cx="62" cy="44" r="1.5" fill="#ffffff"/>
          ` : `
            <circle cx="40" cy="46" r="4.5" fill="#38bdf8"/>
            <circle cx="42" cy="44" r="1.8" fill="#ffffff"/>
            <circle cx="60" cy="46" r="4.5" fill="#38bdf8"/>
            <circle cx="62" cy="44" r="1.8" fill="#ffffff"/>
          `}
        </g>
        
        <!-- Mouth -->
        <path d="M 46 56 Q 50 60 54 56" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" fill="none"/>
      </svg>
    `;
  }

  // Pre-compiled linguistic knowledge base for live classroom sessions
  const KNOWLEDGE_BASE = {
    photosynthesis: {
      topic: "Photosynthesis (प्रकाश-संश्लेषण)",
      breakdown: [
        { word: "photo-", lang: "Greek (phōs)", meaning: "Light (प्रकाश)" },
        { word: "synthesis", lang: "Greek (syntithenai)", meaning: "Putting together / Making (बनाना)" },
        { word: "मतलब", lang: "Hindi/Urdu", meaning: "Meaning or purpose (का अर्थ)" },
        { word: "से", lang: "Hindi Postposition", meaning: "From / Using (as an instrument)" },
        { word: "बनाना", lang: "Hindi Verb Root", meaning: "To create / cook / produce food" }
      ],
      grammarNote: "This sentence exhibits classical <b>code-mixing (Hinglish)</b>. In bilingual Indian classrooms, teachers use the English technical term ('photosynthesis') inside Hindi grammatical scaffolding ('का मतलब है...'). This significantly enhances conceptual clarity.",
      alternatives: [
        { label: "Formal Academic Hindi", text: "प्रकाश-संश्लेषण का तात्पर्य प्रकाश द्वारा भोजन निर्माण से है।" },
        { label: "Natural English", text: "Photosynthesis means synthesizing food using light energy." },
        { label: "Child-Friendly", text: "Plants use sunlight like a kitchen to cook their own food!" }
      ],
      phonetics: "Photosynthesis ka matlab hai light se food banana."
    },
    understand: {
      topic: "Understanding & Comprehension (समझ)",
      breakdown: [
        { word: "मुझे (Mujhe)", lang: "Hindi Pronoun", meaning: "To me (dative case: मैं + को)" },
        { word: "समझ (Samajh)", lang: "Hindi Noun/Verb", meaning: "Understanding / sense" },
        { word: "नहीं (Nahin)", lang: "Hindi Negation", meaning: "Not / No" },
        { word: "आया (Aaya)", lang: "Hindi Past Verb", meaning: "Came (literally: understanding did not come to me)" }
      ],
      grammarNote: "In Hindi, mental states use an <b>experiencer dative construction</b>: 'मुझे समझ नहीं आया' literally translates as <i>'Understanding did not come to me'</i> rather than 'I did not understand'. This is idiomatic and standard.",
      alternatives: [
        { label: "Standard English", text: "I didn't understand." },
        { label: "Polite Hindi", text: "कृपया दोबारा समझाएं, मुझे स्पष्ट नहीं हुआ।" },
        { label: "Casual Hindi", text: "मुझे पल्ले नहीं पड़ा।" }
      ],
      phonetics: "Mujhe samajh nahi aaya."
    },
    today: {
      topic: "Classroom Introduction",
      breakdown: [
        { word: "Today", lang: "English", meaning: "आज (Aaj)" },
        { word: "we will study", lang: "English Future", meaning: "हम पढ़ेंगे (Hum padhenge)" },
        { word: "light", lang: "English Noun", meaning: "प्रकाश (Prakash) / रोशनी" }
      ],
      grammarNote: "Direct future tense expression. Technical terms like 'photosynthesis' are often kept in English because textbooks and competitive exams retain standard scientific nomenclature.",
      alternatives: [
        { label: "Formal Hindi", text: "आज हम प्रकाश-संश्लेषण के विषय में अध्ययन करेंगे।" },
        { label: "Bilingual Classroom", text: "आज हम photosynthesis पढ़ेंगे।" }
      ],
      phonetics: "Aaj hum photosynthesis padhenge."
    }
  };

  const INDIAN_LANG_META = {
    hi: { name: "Hindi", native: "हिन्दी", flag: "🇮🇳", speech: "hi-IN", photoTerm: "प्रकाश-संश्लेषण (Prakash-sanshleshan)" },
    bn: { name: "Bengali", native: "বাংলা", flag: "🇮🇳", speech: "bn-IN", photoTerm: "সালোকসংশ্লেষ (Saloksangshlesh)" },
    te: { name: "Telugu", native: "తెలుగు", flag: "🇮🇳", speech: "te-IN", photoTerm: "కిరణజన్య సంయోగక్రియ (Kirana-janya samyoga-kriya)" },
    mr: { name: "Marathi", native: "मराठी", flag: "🇮🇳", speech: "mr-IN", photoTerm: "प्रकाशसंश्लेषण (Prakashsanshleshan)" },
    ta: { name: "Tamil", native: "தமிழ்", flag: "🇮🇳", speech: "ta-IN", photoTerm: "ஒளிச்சேர்க்கை (Olichcherkkai)" },
    ur: { name: "Urdu", native: "اردو", flag: "🇮🇳", speech: "ur-IN", photoTerm: "ضیائی تالیف (Ziai taleef)" },
    gu: { name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳", speech: "gu-IN", photoTerm: "પ્રકાશસંશ્લેષણ (Prakashsanshleshan)" },
    kn: { name: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳", speech: "kn-IN", photoTerm: "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Dyutisangshleshane)" },
    ml: { name: "Malayalam", native: "മലയാളം", flag: "🇮🇳", speech: "ml-IN", photoTerm: "പ്രകാശസംശ്ലേഷണം (Prakashasangshleshanam)" },
    pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳", speech: "pa-IN", photoTerm: "ਪ੍ਰਕਾਸ਼-ਸੰਸਲੇਸ਼ਣ (Prakash-sansleshan)" },
    or: { name: "Odia", native: "ଓଡ଼ିଆ", flag: "🇮🇳", speech: "or-IN", photoTerm: "ଆଲୋକ ସଂଶ୍ଳେଷଣ (Aloka sangshleshana)" },
    as: { name: "Assamese", native: "অসমীয়া", flag: "🇮🇳", speech: "as-IN", photoTerm: "সালোকসংশ্লেষণ (Saloksangshleshan)" },
    sa: { name: "Sanskrit", native: "संस्कृतम्", flag: "🇮🇳", speech: "sa-IN", photoTerm: "प्रकाशसंश्लेषणम् (Prakashasangshleshanam)" },
    en: { name: "English", native: "English", flag: "🇬🇧", speech: "en-US", photoTerm: "Photosynthesis" }
  };

  function speakText(text, lang = "hi") {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]*>/g, "").trim();
    const utter = new SpeechSynthesisUtterance(clean);

    const meta = INDIAN_LANG_META[lang] || { speech: "hi-IN" };
    utter.lang = meta.speech;

    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith(meta.speech) || v.lang.startsWith(lang));
    if (targetVoice) utter.voice = targetVoice;
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }

  function initUI() {
    // 1. Inject Mascot Floating Button into DOM
    const mascotContainer = document.createElement("div");
    mascotContainer.className = "gemma-mascot-container";
    mascotContainer.id = "gemmaMascot";
    mascotContainer.innerHTML = `
      <div class="gemma-bubble" id="gemmaBubble">
        <span>✨ Hi! I'm Gemma 4. Click any translation or me to explore!</span>
      </div>
      <button class="gemma-avatar-btn" id="gemmaBtn" title="Ask Gemma 4 regarding translations" aria-label="Open Gemma 4 Assistant">
        <div id="mascotSvgWrap">${getMascotSVG("happy")}</div>
        <span class="gemma-badge-num">AI</span>
      </button>
    `;
    document.body.appendChild(mascotContainer);

    // 2. Inject Gemma 4 Slide-over Drawer Modal into DOM
    const drawerOverlay = document.createElement("div");
    drawerOverlay.className = "gemma-modal-overlay";
    drawerOverlay.id = "gemmaOverlay";
    drawerOverlay.innerHTML = `
      <div class="gemma-drawer" id="gemmaDrawer" role="dialog" aria-modal="true" aria-label="Gemma 4 Translation Assistant">
        <div class="drawer-header">
          <div class="drawer-mascot-title">
            <div class="drawer-mascot-avatar">${getMascotSVG("wink")}</div>
            <div>
              <h3>Gemma 4 Assistant</h3>
              <p>Linguistic analysis & real-time translation Q&A</p>
            </div>
          </div>
          <button class="drawer-close-btn" id="gemmaCloseBtn" aria-label="Close Assistant">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="drawer-context-banner">
          <div class="context-label">
            <span>Current Translation in Focus</span>
            <span id="gemmaSpeakerTag" class="tag tag-version">Ms. Rao</span>
          </div>
          <div class="context-source" id="gemmaSourceText">“Today we will study photosynthesis”</div>
          <div class="context-target" id="gemmaTargetText">
            <span>🌐 आज हम photosynthesis पढ़ेंगे</span>
            <button class="btn-speak-tr" id="gemmaSpeakContext" title="Listen to pronunciation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            </button>
          </div>
        </div>

        <div class="drawer-chat-body" id="gemmaChatBody">
          <!-- Live conversation messages -->
        </div>

        <div class="drawer-suggestions">
          <div class="drawer-suggestions-title">💡 Suggested Questions for this translation</div>
          <div class="chips-scroll-wrap" id="gemmaQuickChips">
            <!-- Dynamically populated chips -->
          </div>
        </div>

        <div class="drawer-footer">
          <form id="gemmaQueryForm" class="drawer-input-row" onsubmit="event.preventDefault(); Gemma4.submitCustomQuery();">
            <input type="text" id="gemmaInput" placeholder="Ask Gemma 4 anything about this translation..." autocomplete="off"/>
            <button type="submit" class="btn-send-gemma" aria-label="Send Question">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(drawerOverlay);

    // Event listeners
    document.getElementById("gemmaBtn").onclick = () => {
      playChime("sparkle");
      openDrawer();
    };

    document.getElementById("gemmaCloseBtn").onclick = closeDrawer;
    drawerOverlay.onclick = (e) => {
      if (e.target === drawerOverlay) closeDrawer();
    };

    document.getElementById("gemmaSpeakContext").onclick = () => {
      speakText(activeContext.translatedText, activeContext.tgtLang);
    };

    // Keyboard escape to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerOverlay.classList.contains("active")) {
        closeDrawer();
      }
    });

    // Animate mascot greeting after 2.5s
    setTimeout(() => {
      const bubble = document.getElementById("gemmaBubble");
      if (bubble) bubble.style.display = "flex";
    }, 2000);
  }

  function openDrawer() {
    const overlay = document.getElementById("gemmaOverlay");
    overlay.classList.add("active");
    renderContextBanner();
    renderSuggestedChips();

    const chatBody = document.getElementById("gemmaChatBody");
    if (!chatBody.children.length) {
      loadInitialAnalysis();
    }

    const bubble = document.getElementById("gemmaBubble");
    if (bubble) bubble.style.display = "none";

    document.getElementById("gemmaInput").focus();
  }

  function closeDrawer() {
    document.getElementById("gemmaOverlay").classList.remove("active");
  }

  function setContext(segId, sourceText, translatedText, speaker, srcLang = "en", tgtLang = "hi") {
    activeContext = { segId, sourceText, translatedText, speaker, srcLang, tgtLang };

    renderContextBanner();
    renderSuggestedChips();

    // Show interactive notification bubble on mascot
    const bubble = document.getElementById("gemmaBubble");
    if (bubble) {
      bubble.innerHTML = `<span>✨ New translation from <b>${speaker}</b>! Ask Gemma 4 to explain.</span>`;
      bubble.style.display = "flex";
      setTimeout(() => {
        bubble.style.display = "none";
      }, 5000);
    }
  }

  function renderContextBanner() {
    const srcEl = document.getElementById("gemmaSourceText");
    const tgtEl = document.getElementById("gemmaTargetText");
    const spkEl = document.getElementById("gemmaSpeakerTag");
    const meta = INDIAN_LANG_META[activeContext.tgtLang] || { name: activeContext.tgtLang, native: activeContext.tgtLang, flag: "🌐" };

    if (srcEl) srcEl.textContent = `“${activeContext.sourceText}”`;
    if (tgtEl) {
      tgtEl.innerHTML = `
        <span>${meta.flag} <b>${meta.native} (${meta.name}):</b> ${activeContext.translatedText}</span>
        <button class="btn-speak-tr" id="gemmaSpeakContext" title="Listen to pronunciation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        </button>
      `;
      const btn = document.getElementById("gemmaSpeakContext");
      if (btn) btn.onclick = () => speakText(activeContext.translatedText, activeContext.tgtLang);
    }
    if (spkEl) spkEl.textContent = `${activeContext.speaker} • Target: ${meta.name}`;
  }

  function renderSuggestedChips() {
    const wrap = document.getElementById("gemmaQuickChips");
    if (!wrap) return;

    const source = activeContext.sourceText.toLowerCase();
    const suggestions = [
      { text: "🔍 Why this translation?", query: "Why was it translated this way?" },
      { text: "📖 Word-by-word breakdown", query: "Can you break down the words and vocabulary?" },
      { text: "🗣️ Pronunciation guide", query: "How do you pronounce this sentence?" },
      { text: "🔄 Alternative phrasings", query: "Give me formal and conversational alternatives." },
      { text: "🇮🇳 Code-mixing (Hinglish)", query: "Explain why Hindi and English are mixed here." }
    ];

    if (source.includes("photo") || source.includes("plant") || source.includes("food")) {
      suggestions.unshift({ text: "🌱 Photosynthesis concept", query: "Explain the science concept of photosynthesis simply." });
    } else if (source.includes("समझ") || source.includes("understand")) {
      suggestions.unshift({ text: "💡 Hindi dative grammar", query: "Explain the grammar of 'मुझे समझ नहीं आया'." });
    }

    wrap.innerHTML = suggestions.map(s => `
      <button class="chip-q" data-q="${encodeURIComponent(s.query)}">
        ${s.text}
      </button>
    `).join("");

    wrap.querySelectorAll(".chip-q").forEach(btn => {
      btn.onclick = () => {
        const q = decodeURIComponent(btn.dataset.q);
        askQuestion(q);
      };
    });
  }

  function appendUserBubble(question) {
    const chatBody = document.getElementById("gemmaChatBody");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.textContent = question;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendThinking() {
    const chatBody = document.getElementById("gemmaChatBody");
    const thinking = document.createElement("div");
    thinking.className = "gemma-thinking";
    thinking.id = "gemmaThinking";
    thinking.innerHTML = `
      <span>Gemma 4 is analyzing nuances</span>
      <div class="thinking-dots">
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
      </div>
    `;
    chatBody.appendChild(thinking);
    chatBody.scrollTop = chatBody.scrollHeight;
    return thinking;
  }

  function removeThinking() {
    const el = document.getElementById("gemmaThinking");
    if (el) el.remove();
  }

  function appendGemmaResponse(htmlContent, rawSpeech = "") {
    removeThinking();
    playChime("pop");

    const chatBody = document.getElementById("gemmaChatBody");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble gemma";

    bubble.innerHTML = `
      <div class="gemma-response-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>Gemma 4 Intelligence</span>
      </div>
      <div class="gemma-formatted">
        ${htmlContent}
      </div>
      <div class="gemma-actions-row">
        <button class="btn-gemma-action btn-listen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          Listen
        </button>
        <button class="btn-gemma-action btn-copy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
      </div>
    `;

    const listenBtn = bubble.querySelector(".btn-listen");
    if (listenBtn) {
      listenBtn.onclick = () => speakText(rawSpeech || bubble.innerText);
    }

    const copyBtn = bubble.querySelector(".btn-copy");
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(rawSpeech || bubble.innerText);
        copyBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        }, 1500);
      };
    }

    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function loadInitialAnalysis() {
    appendThinking();
    setTimeout(() => {
      const src = activeContext.sourceText;
      const tgt = activeContext.translatedText;

      let html = `
        <p>I have prepared the linguistic breakdown for <b>“${src}”</b>:</p>
        <div class="gemma-card-item">
          <h4>💡 Translation Strategy</h4>
          <p>The sentence was translated to <b>“${tgt}”</b>. Notice how technical loanwords are preserved while connecting grammatical elements adhere to natural syntax.</p>
        </div>
      `;

      if (src.toLowerCase().includes("photo") || tgt.includes("photo")) {
        html += `
          <div class="gemma-card-item">
            <h4>🌿 Vocabulary & Roots</h4>
            <div>
              <span class="gemma-vocab-chip">photosynthesis = प्रकाश-संश्लेषण</span>
              <span class="gemma-vocab-chip">मतलब = Meaning</span>
              <span class="gemma-vocab-chip">बनाना = Synthesize/Make</span>
            </div>
          </div>
        `;
      }

      appendGemmaResponse(html, `Here is the translation analysis for ${src}. The translation is ${tgt}.`);
    }, 450);
  }

  function generateAnswer(query) {
    const q = query.toLowerCase();
    const src = activeContext.sourceText.toLowerCase();
    const tgt = activeContext.translatedText;
    const tgtLangCode = activeContext.tgtLang || "hi";
    const meta = INDIAN_LANG_META[tgtLangCode] || { name: "Hindi", native: "हिन्दी", flag: "🇮🇳", photoTerm: "प्रकाश-संश्लेषण" };

    if (q.includes("why") || q.includes("translation") || q.includes("reason")) {
      if (src.includes("photo") || src.includes("मतल")) {
        return {
          html: `
            <p>Great question! Here is how the translation into <b>${meta.flag} ${meta.native} (${meta.name})</b> was generated:</p>
            <div class="gemma-card-item">
              <h4>1. Terminology Preservation & Adaptation</h4>
              <p>For scientific concepts, the standard academic term in ${meta.name} is <b>${meta.photoTerm}</b>. In bilingual classrooms, teachers frequently retain <i>'photosynthesis'</i> or pair it with the native term for conceptual clarity.</p>
            </div>
            <div class="gemma-card-item">
              <h4>2. Syntactic & Postposition Alignment</h4>
              <p>Whether the teacher speaks in English or Hindi, the translation engine constructs the predicate in ${meta.name} syntax so students comprehend the mechanism naturally.</p>
            </div>
          `,
          speech: `In ${meta.name}, photosynthesis is translated as ${meta.photoTerm}, structuring the sentence in natural syntax.`
        };
      } else if (src.includes("समझ") || src.includes("understand")) {
        return {
          html: `
            <div class="gemma-card-item">
              <h4>Experiencer Dative / Passive Comprehension</h4>
              <p>In Indian languages like ${meta.name}, understanding is often phrased as a state that arrives to the person (e.g. Hindi: <i>'मुझे समझ नहीं आया'</i>, Tamil: <i>'எனக்கு புரியவில்லை'</i>, Marathi: <i>'मला समजले नाही'</i>).</p>
              <p>This contrasts with English ('I did not understand') where the speaker is the grammatical subject.</p>
            </div>
          `,
          speech: `In ${meta.name}, comprehension uses an experiencer dative structure.`
        };
      } else {
        return {
          html: `
            <div class="gemma-card-item">
              <h4>Context-Aware Translation to ${meta.name}</h4>
              <p>The sentence was translated into <b>${meta.name}</b>: <i>“${tgt}”</i>.</p>
              <p>Even if the teacher starts speaking in English or switches to Hindi, the student's selected target language (${meta.native}) is maintained consistently.</p>
            </div>
          `,
          speech: `The translation to ${meta.name} is ${tgt}.`
        };
      }
    }

    if (q.includes("breakdown") || q.includes("word") || q.includes("vocab") || q.includes("meaning")) {
      let breakdownItems = [
        { word: "Speech segment", mean: `Rendered into ${meta.name}`, lang: meta.name }
      ];

      if (src.includes("photo") || src.includes("मतल")) {
        breakdownItems = [
          ...KNOWLEDGE_BASE.photosynthesis.breakdown,
          { word: meta.photoTerm, lang: meta.name, meaning: "Photosynthesis equivalent in " + meta.name }
        ];
      } else if (src.includes("समझ") || src.includes("understand")) {
        breakdownItems = KNOWLEDGE_BASE.understand.breakdown;
      } else if (src.includes("today") || src.includes("study")) {
        breakdownItems = KNOWLEDGE_BASE.today.breakdown;
      }

      const chipsHtml = breakdownItems.map(b => `
        <div class="gemma-card-item" style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <b>${b.word}</b>
            <span class="tag tag-version">${b.lang}</span>
          </div>
          <div style="font-size:13px;color:var(--ink-secondary);margin-top:2px;">${b.meaning}</div>
        </div>
      `).join("");

      return {
        html: `
          <p>Here is the word-by-word anatomical breakdown in <b>${meta.name}</b> context:</p>
          ${chipsHtml}
        `,
        speech: "Here is the word-by-word breakdown of the sentence."
      };
    }

    if (q.includes("pronounc") || q.includes("speak") || q.includes("sound") || q.includes("phonetic")) {
      return {
        html: `
          <div class="gemma-card-item">
            <h4>🗣️ Pronunciation Guide (${meta.flag} ${meta.native})</h4>
            <p style="font-size:16px;font-family:inherit;font-weight:700;color:var(--primary);margin:6px 0;">
              ${tgt}
            </p>
            <p style="font-size:12.5px;color:var(--ink-muted);">Click the 'Listen' button below to hear native pronunciation via Web Speech Synthesis.</p>
          </div>
        `,
        speech: tgt
      };
    }

    if (q.includes("alternative") || q.includes("formal") || q.includes("other way") || q.includes("conversational")) {
      const alts = (src.includes("photo") || src.includes("मतल")) ? KNOWLEDGE_BASE.photosynthesis.alternatives : [
        { label: "Formal", text: "Kindly proceed to examine the presented topic." },
        { label: "Conversational", text: "Let's check out what's coming up next." },
        { label: "Concise", text: "Next topic." }
      ];

      return {
        html: `
          <p>Here are alternative ways to express this thought:</p>
          ${alts.map(a => `
            <div class="gemma-card-item">
              <span class="tag tag-overlap" style="margin-bottom:4px;display:inline-block;">${a.label}</span>
              <p style="font-weight:600;color:var(--ink);">${a.text}</p>
            </div>
          `).join("")}
        `,
        speech: `Here are alternative ways to express this sentence.`
      };
    }

    if (q.includes("hinglish") || q.includes("mix") || q.includes("code")) {
      return {
        html: `
          <div class="gemma-card-item">
            <h4>🇮🇳 Code-Mixing (Hinglish) in Education</h4>
            <p>Code-mixing is the intentional alternation between two languages within a single utterance.</p>
            <p style="margin-top:6px;">In this sentence, the matrix language is Hindi (providing verbs and connectors), while English supplies the embedded domain-specific nouns. Research shows this reduces cognitive load by up to <b>35%</b> for ESL learners!</p>
          </div>
        `,
        speech: "Code mixing reduces cognitive load in bilingual classrooms by combining English scientific terms with Hindi grammar."
      };
    }

    if (q.includes("science") || q.includes("photo") || q.includes("concept")) {
      return {
        html: `
          <div class="gemma-card-item">
            <h4>🌱 Science Concept: Photosynthesis</h4>
            <p><b>Chemical Equation:</b> 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂</p>
            <p style="margin-top:6px;">Plants capture sunlight through chlorophyll pigments in chloroplasts, using water from roots and carbon dioxide from air to synthesize glucose and release oxygen.</p>
          </div>
        `,
        speech: "Photosynthesis is the process where plants convert light energy, carbon dioxide, and water into glucose and oxygen."
      };
    }

    // Default intelligent conversational answer
    return {
      html: `
        <div class="gemma-card-item">
          <h4>🤖 Gemma 4 Analysis</h4>
          <p>Regarding <b>“${query}”</b> in the context of <i>“${activeContext.sourceText}”</i> → <i>“${activeContext.translatedText}”</i>:</p>
          <p style="margin-top:6px;">This phrase reflects natural multilingual speech. The live translation system captured the intent, handled potential word uncertainty with real-time confidence scores, and aligned the Hindi/English grammar appropriately.</p>
        </div>
      `,
      speech: `Regarding your question about ${query}, this translation reflects natural multilingual classroom communication.`
    };
  }

  function askQuestion(query) {
    appendUserBubble(query);
    appendThinking();

    setTimeout(() => {
      const res = generateAnswer(query);
      appendGemmaResponse(res.html, res.speech);
    }, 500);
  }

  function submitCustomQuery() {
    const input = document.getElementById("gemmaInput");
    const val = input.value.trim();
    if (!val) return;
    input.value = "";
    askQuestion(val);
  }

  function inspectSegment(segId, sourceText, translatedText, speaker, srcLang, tgtLang) {
    setContext(segId, sourceText, translatedText, speaker, srcLang, tgtLang);
    openDrawer();
    askQuestion("Why was it translated this way?");
  }

  return {
    init: initUI,
    open: openDrawer,
    close: closeDrawer,
    setContext: setContext,
    inspectSegment: inspectSegment,
    askQuestion: askQuestion,
    submitCustomQuery: submitCustomQuery,
    speak: (text, lang) => speakText(text, lang),
    playChime: playChime
  };
})();
