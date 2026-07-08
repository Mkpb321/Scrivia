(() => {
  "use strict";

  const STORAGE_KEY = "scrivia_settings_v4";
  const DIFFICULTY_ORDER = ["leicht", "mittel", "schwer"];
  const TESTAMENT_LABEL = { at: "AT", nt: "NT" };
  const BOOK_SCOPE_CHAPTER = "__book";
  const SOFT_A = 0.35;
  const STRONG_A = 1;

  const BOOK_ORDER = [
    "gen", "exo", "lev", "num", "deu", "jos", "jdg", "rut", "1sa", "2sa", "1ki", "2ki",
    "1ch", "2ch", "ezr", "neh", "est", "job", "psa", "pro", "ecc", "sng", "isa", "jer",
    "lam", "ezk", "dan", "hos", "jol", "amo", "oba", "jon", "mic", "nah", "nam", "hab",
    "zep", "hag", "zec", "mal", "mat", "mar", "luk", "joh", "act", "rom", "1co", "2co",
    "gal", "eph", "phi", "col", "1th", "2th", "1ti", "2ti", "tit", "phm", "heb", "jam",
    "1pe", "2pe", "1jo", "2jo", "3jo", "jud", "rev"
  ];
  const BOOK_ORDER_INDEX = new Map(BOOK_ORDER.map((id, index) => [id, index]));

  const GROUP_RGB = {
    "Gesetz": [140, 192, 255],
    "AT Geschichte": [122, 230, 185],
    "Weisheit": [255, 195, 120],
    "Große Propheten": [188, 150, 255],
    "Kleine Propheten": [255, 145, 195],
    "Evangelien": [120, 220, 255],
    "NT Geschichte": [255, 225, 140],
    "Paulusbriefe": [150, 160, 255],
    "Allgemeine Briefe": [180, 255, 150],
    "Prophetie": [255, 160, 140],
  };

  const BOOK_GROUP_BY_ID = (() => {
    const map = new Map();
    const put = (group, ids) => ids.forEach((id) => map.set(id, group));
    put("Gesetz", ["gen", "exo", "lev", "num", "deu"]);
    put("AT Geschichte", ["jos", "jdg", "rut", "1sa", "2sa", "1ki", "2ki", "1ch", "2ch", "ezr", "neh", "est"]);
    put("Weisheit", ["job", "psa", "pro", "ecc", "sng"]);
    put("Große Propheten", ["isa", "jer", "lam", "ezk", "dan"]);
    put("Kleine Propheten", ["hos", "jol", "amo", "oba", "jon", "mic", "nah", "nam", "hab", "zep", "hag", "zec", "mal"]);
    put("Evangelien", ["mat", "mar", "luk", "joh"]);
    put("NT Geschichte", ["act"]);
    put("Paulusbriefe", ["rom", "1co", "2co", "gal", "eph", "phi", "col", "1th", "2th", "1ti", "2ti", "tit", "phm"]);
    put("Allgemeine Briefe", ["heb", "jam", "1pe", "2pe", "1jo", "2jo", "3jo", "jud"]);
    put("Prophetie", ["rev"]);
    return map;
  })();

  const els = {};
  const app = {
    view: "home",
    questions: [],
    books: [],
    categoriesByBook: new Map(),
    chaptersByBook: new Map(),
    settings: null,
    settingsLoaded: false,
    quiz: null,
    currentQuestion: null,
    answered: false,
    lastChoice: null,
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    app.settings = loadSettings();
    bindEvents();
    setView("home");
    loadQuestions();
  }

  function bindElements() {
    const ids = [
      "topbar", "btnBack", "btnAbort", "topTitle", "topSub",
      "viewHome", "viewSetup", "viewQuiz", "viewResult",
      "btnNewQuiz", "loadHint", "setupForm", "availableLine", "questionCount",
      "difficultyChips", "btnDifficultyAll", "bookGrid", "btnBooksAll", "btnBooksAT", "btnBooksNT", "btnBooksNone",
      "chapterAccordions", "categoryChips", "btnCategoriesAll", "btnCategoriesNone", "setupError", "btnSetupCancel", "btnStartQuiz",
      "questionKicker", "questionText", "choices", "feedback", "feedbackTitle", "feedbackText", "referenceLine", "btnNext",
      "resultText", "resultStats", "btnResultSetup", "btnResultAgain", "resultBadge"
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`Element fehlt: #${id}`);
      els[id] = el;
    });
  }

  function bindEvents() {
    els.btnNewQuiz.addEventListener("click", () => {
      renderSetup();
      setView("setup");
    });

    els.btnBack.addEventListener("click", () => {
      if (app.view === "setup") setView("home");
      else if (app.view === "quiz") confirmAbortQuiz();
      else if (app.view === "result") setView("setup");
    });

    els.btnAbort.addEventListener("click", confirmAbortQuiz);
    els.btnSetupCancel.addEventListener("click", () => setView("home"));

    els.questionCount.addEventListener("input", () => {
      app.settings.questionCount = cleanQuestionCount(els.questionCount.value);
      saveSettings();
      updateAvailablePreview();
    });

    els.btnDifficultyAll.addEventListener("click", () => {
      app.settings.selectedDifficulties = [...DIFFICULTY_ORDER];
      saveSettings();
      renderDifficultyChips();
      updateAvailablePreview();
    });

    els.setupForm.addEventListener("click", (e) => {
      const countBtn = e.target.closest("[data-count]");
      if (countBtn) {
        app.settings.questionCount = cleanQuestionCount(countBtn.dataset.count);
        els.questionCount.value = String(app.settings.questionCount);
        saveSettings();
        updateAvailablePreview();
        return;
      }

      const diffBtn = e.target.closest("[data-difficulty]");
      if (diffBtn) {
        toggleDifficulty(diffBtn.dataset.difficulty);
        return;
      }

      const bookBtn = e.target.closest("[data-book]");
      if (bookBtn) {
        toggleBook(bookBtn.dataset.book);
        return;
      }

      const chapterAllBtn = e.target.closest("[data-chapter-all]");
      if (chapterAllBtn) {
        setChaptersForBook(chapterAllBtn.dataset.chapterAll, true);
        return;
      }

      const chapterNoneBtn = e.target.closest("[data-chapter-none]");
      if (chapterNoneBtn) {
        setChaptersForBook(chapterNoneBtn.dataset.chapterNone, false);
        return;
      }

      const chapterBtn = e.target.closest("[data-chapter]");
      if (chapterBtn) {
        toggleChapter(chapterBtn.dataset.chapterBook, chapterBtn.dataset.chapter);
        return;
      }

      const categoryBtn = e.target.closest("[data-category]");
      if (categoryBtn) {
        toggleCategory(categoryBtn.dataset.category);
      }
    });

    els.btnBooksAll.addEventListener("click", () => setBooksByMode("all"));
    els.btnBooksAT.addEventListener("click", () => setBooksByMode("at"));
    els.btnBooksNT.addEventListener("click", () => setBooksByMode("nt"));
    els.btnBooksNone.addEventListener("click", () => setBooksByMode("none"));

    els.btnCategoriesAll.addEventListener("click", () => {
      app.settings.categoryMode = "all";
      app.settings.categoryDefaultSelected = true;
      availableCategoriesForSelectedBooks().forEach((category) => {
        app.settings.categorySelections[category] = true;
      });
      reconcileCategories();
      saveSettings();
      renderCategoryChips();
      updateAvailablePreview();
    });

    els.btnCategoriesNone.addEventListener("click", () => {
      app.settings.categoryMode = "custom";
      app.settings.categoryDefaultSelected = false;
      availableCategoriesForSelectedBooks().forEach((category) => {
        app.settings.categorySelections[category] = false;
      });
      reconcileCategories();
      saveSettings();
      renderCategoryChips();
      updateAvailablePreview();
    });

    els.setupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      startQuizFromSettings();
    });

    els.choices.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-choice]");
      if (!btn || app.answered || !app.currentQuestion) return;
      submitAnswer(btn.dataset.choice);
    });

    els.btnNext.addEventListener("click", showNextQuestion);

    els.btnResultSetup.addEventListener("click", () => {
      renderSetup();
      setView("setup");
    });

    els.btnResultAgain.addEventListener("click", startQuizFromSettings);

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      if (app.view === "home" && !els.btnNewQuiz.disabled) {
        e.preventDefault();
        els.btnNewQuiz.click();
      } else if (app.view === "setup") {
        e.preventDefault();
        if (!els.btnStartQuiz.disabled) startQuizFromSettings();
      } else if (app.view === "quiz" && app.answered && !els.feedback.classList.contains("hidden")) {
        e.preventDefault();
        showNextQuestion();
      } else if (app.view === "result") {
        e.preventDefault();
        els.btnResultAgain.click();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (app.view !== "quiz" || app.answered) return;
      if (!/^[1-9]$/.test(e.key)) return;
      const index = Number(e.key) - 1;
      const btn = els.choices.querySelectorAll("[data-choice]")[index];
      if (!btn) return;
      e.preventDefault();
      btn.click();
    });

    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  }

  async function loadQuestions() {
    try {
      const response = await fetch("./questions.csv", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
      const rows = parseCsv(text);
      app.questions = normalizeQuestions(rows);
      buildIndexes();
      reconcileSettings({ firstLoad: true });
      saveSettings();

      els.loadHint.classList.add("hidden");
      els.loadHint.textContent = "";
      els.btnNewQuiz.disabled = app.questions.length === 0;
      updateTopbar();
    } catch (err) {
      console.error(err);
      els.btnNewQuiz.disabled = true;
      els.loadHint.textContent = "CSV-Fehler";
      els.loadHint.classList.remove("hidden");
    }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    row.push(field);
    if (row.length > 1 || row.some(Boolean)) rows.push(row);
    if (rows.length === 0) return [];

    const headers = rows.shift().map((h) => h.trim());
    return rows
      .filter((r) => r.some((cell) => String(cell || "").trim() !== ""))
      .map((r) => Object.fromEntries(headers.map((h, index) => [h, r[index] ?? ""])));
  }

  function normalizeQuestions(rows) {
    const seenIds = new Set();
    const result = [];

    rows.forEach((row, index) => {
      const q = {};
      Object.entries(row).forEach(([key, value]) => {
        q[key] = String(value ?? "").trim();
      });

      if (q.type !== "multiple_choice") return;
      if (!q.id || seenIds.has(q.id)) return;

      const choices = String(q.choices || "")
        .split("||")
        .map((choice) => choice.trim())
        .filter(Boolean);

      if (choices.length < 2) return;
      if (!q.correct_answer || !choices.includes(q.correct_answer)) return;
      if (!q.question || !q.explanation) return;

      q.rowNumber = index + 2;
      q.testament = normalizeToken(q.testament);
      q.book_id = normalizeToken(q.book_id);
      q.book_name = q.book_name || q.book_id;
      q.scope = normalizeToken(q.scope || "book");
      q.category = q.category || "Allgemein";
      q.difficulty = normalizeToken(q.difficulty || "mittel");
      q.chapter = q.chapter ? String(q.chapter).trim() : "";
      q.chapterKey = chapterKey(q.chapter, q.scope);
      q.choicesList = choices;

      seenIds.add(q.id);
      result.push(q);
    });

    return result;
  }

  function buildIndexes() {
    const bookMap = new Map();
    const categoryMap = new Map();
    const chapterMap = new Map();

    app.questions.forEach((q) => {
      if (!bookMap.has(q.book_id)) {
        bookMap.set(q.book_id, {
          id: q.book_id,
          name: q.book_name,
          short: shortBookName(q.book_name),
          testament: q.testament,
        });
      }

      if (!categoryMap.has(q.book_id)) categoryMap.set(q.book_id, new Set());
      categoryMap.get(q.book_id).add(q.category);

      if (!chapterMap.has(q.book_id)) chapterMap.set(q.book_id, new Set());
      chapterMap.get(q.book_id).add(q.chapterKey);
    });

    app.books = [...bookMap.values()].sort((a, b) => {
      const ai = BOOK_ORDER_INDEX.has(a.id) ? BOOK_ORDER_INDEX.get(a.id) : 999;
      const bi = BOOK_ORDER_INDEX.has(b.id) ? BOOK_ORDER_INDEX.get(b.id) : 999;
      if (ai !== bi) return ai - bi;
      const testamentOrder = (a.testament === "at" ? 0 : 1) - (b.testament === "at" ? 0 : 1);
      if (testamentOrder !== 0) return testamentOrder;
      return a.name.localeCompare(b.name, "de", { numeric: true, sensitivity: "base" });
    });

    app.categoriesByBook = new Map(
      [...categoryMap.entries()].map(([bookId, categories]) => [bookId, [...categories].sort(sortDe)])
    );

    app.chaptersByBook = new Map(
      [...chapterMap.entries()].map(([bookId, chapters]) => [bookId, [...chapters].sort(sortChapters)])
    );
  }

  function loadSettings() {
    const defaults = {
      questionCount: 10,
      selectedDifficulties: [...DIFFICULTY_ORDER],
      selectedBooks: [],
      selectedCategories: [],
      categorySelections: {},
      categoryDefaultSelected: true,
      categoryMode: "all",
      chapterSelections: {},
    };

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      app.settingsLoaded = true;

      const selectedCategories = Array.isArray(parsed.selectedCategories) ? parsed.selectedCategories : [];
      let categorySelections = normalizeSelectionMap(parsed.categorySelections);
      let categoryDefaultSelected = typeof parsed.categoryDefaultSelected === "boolean"
        ? parsed.categoryDefaultSelected
        : parsed.categoryMode !== "custom";

      if (Object.keys(categorySelections).length === 0 && selectedCategories.length > 0) {
        categoryDefaultSelected = parsed.categoryMode === "custom" ? false : true;
        selectedCategories.forEach((cat) => { categorySelections[String(cat)] = true; });
      }

      return {
        ...defaults,
        ...parsed,
        questionCount: cleanQuestionCount(parsed.questionCount),
        selectedDifficulties: Array.isArray(parsed.selectedDifficulties) ? parsed.selectedDifficulties : defaults.selectedDifficulties,
        selectedBooks: Array.isArray(parsed.selectedBooks) ? parsed.selectedBooks : [],
        selectedCategories,
        categorySelections,
        categoryDefaultSelected,
        categoryMode: parsed.categoryMode === "custom" ? "custom" : "all",
        chapterSelections: normalizeNestedSelectionMap(parsed.chapterSelections),
      };
    } catch {
      return defaults;
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(app.settings));
    } catch {
      // Storage may be disabled. The app still works without persistence.
    }
  }

  function reconcileSettings({ firstLoad = false } = {}) {
    const allBookIds = app.books.map((b) => b.id);
    const validBookSet = new Set(allBookIds);
    const validDiffSet = new Set(DIFFICULTY_ORDER);

    app.settings.questionCount = cleanQuestionCount(app.settings.questionCount);
    app.settings.selectedDifficulties = unique(app.settings.selectedDifficulties).filter((d) => validDiffSet.has(d));
    if (firstLoad && !app.settingsLoaded && app.settings.selectedDifficulties.length === 0) {
      app.settings.selectedDifficulties = [...DIFFICULTY_ORDER];
    }

    app.settings.selectedBooks = unique(app.settings.selectedBooks).filter((id) => validBookSet.has(id));
    if (firstLoad && !app.settingsLoaded && app.settings.selectedBooks.length === 0) {
      app.settings.selectedBooks = [...allBookIds];
    }
    if (firstLoad && app.settingsLoaded && app.settings.selectedBooks.length === 0) {
      // Keep an intentionally empty saved selection.
    }

    reconcileChapters();
    reconcileCategories();
  }

  function reconcileChapters() {
    if (!app.settings.chapterSelections || typeof app.settings.chapterSelections !== "object" || Array.isArray(app.settings.chapterSelections)) {
      app.settings.chapterSelections = {};
    }

    app.settings.selectedBooks.forEach((bookId) => {
      const available = app.chaptersByBook.get(bookId) || [];
      if (!app.settings.chapterSelections[bookId] || typeof app.settings.chapterSelections[bookId] !== "object" || Array.isArray(app.settings.chapterSelections[bookId])) {
        app.settings.chapterSelections[bookId] = {};
      }

      available.forEach((chapter) => {
        if (!Object.prototype.hasOwnProperty.call(app.settings.chapterSelections[bookId], chapter)) {
          app.settings.chapterSelections[bookId][chapter] = true;
        }
      });
    });
  }

  function reconcileCategories() {
    const available = availableCategoriesForSelectedBooks();
    if (!app.settings.categorySelections || typeof app.settings.categorySelections !== "object") {
      app.settings.categorySelections = {};
    }
    if (typeof app.settings.categoryDefaultSelected !== "boolean") {
      app.settings.categoryDefaultSelected = app.settings.categoryMode !== "custom";
    }

    available.forEach((category) => {
      if (!Object.prototype.hasOwnProperty.call(app.settings.categorySelections, category)) {
        app.settings.categorySelections[category] = app.settings.categoryDefaultSelected;
      }
    });

    app.settings.selectedCategories = available.filter((category) => app.settings.categorySelections[category] !== false);
  }

  function renderSetup() {
    reconcileSettings();
    els.setupError.textContent = "";
    els.questionCount.value = String(app.settings.questionCount);
    renderDifficultyChips();
    renderBookGrid();
    renderChapterAccordions();
    renderCategoryChips();
    updateAvailablePreview();
    updateTopbar();
  }

  function renderDifficultyChips() {
    const selected = new Set(app.settings.selectedDifficulties);
    els.difficultyChips.innerHTML = DIFFICULTY_ORDER.map((difficulty) => chipHtml({
      label: labelDifficulty(difficulty),
      value: difficulty,
      attr: "difficulty",
      selected: selected.has(difficulty),
    })).join("");
  }

  function renderBookGrid() {
    const selected = new Set(app.settings.selectedBooks);
    els.bookGrid.innerHTML = app.books.map((book) => {
      const rgb = bookGroupRgb(book.id, book.testament);
      const style = `--bookSoft:${rgba(rgb, SOFT_A)};--bookStrong:${rgba(rgb, STRONG_A)};`;
      return `
        <button type="button" class="bookBtn" data-book="${escapeAttr(book.id)}" aria-checked="${selected.has(book.id) ? "true" : "false"}" title="${escapeAttr(book.name)}" style="${style}">
          ${escapeHtml(book.short)}
        </button>
      `;
    }).join("");
  }

  function renderChapterAccordions() {
    reconcileChapters();
    const openBookIds = new Set([...els.chapterAccordions.querySelectorAll(".chapterGroup")].filter((details) => details.open).map((details) => details.dataset.bookChapters));
    const selectedBookIds = app.settings.selectedBooks.filter((id) => app.chaptersByBook.has(id));

    if (selectedBookIds.length === 0) {
      els.chapterAccordions.innerHTML = `<div class="formError">Keine Bücher</div>`;
      return;
    }

    els.chapterAccordions.innerHTML = selectedBookIds.map((bookId, index) => {
      const book = app.books.find((b) => b.id === bookId);
      const chapters = app.chaptersByBook.get(bookId) || [];
      const selections = app.settings.chapterSelections[bookId] || {};
      const selectedCount = chapters.filter((chapter) => selections[chapter] !== false).length;
      const rgb = bookGroupRgb(bookId, book ? book.testament : "at");
      const style = `--bookSoft:${rgba(rgb, SOFT_A)};--bookStrong:${rgba(rgb, STRONG_A)};`;
      const shouldOpen = openBookIds.size > 0 ? openBookIds.has(bookId) : selectedBookIds.length === 1 || index === 0;
      const openAttr = shouldOpen ? " open" : "";
      const buttons = chapters.map((chapter) => `
        <button type="button" class="chapterBtn" data-chapter-book="${escapeAttr(bookId)}" data-chapter="${escapeAttr(chapter)}" aria-checked="${selections[chapter] !== false ? "true" : "false"}">
          ${escapeHtml(chapterLabel(chapter))}
        </button>
      `).join("");

      return `
        <details class="chapterGroup" data-book-chapters="${escapeAttr(bookId)}" style="${style}"${openAttr}>
          <summary class="chapterSummary">
            <span>${escapeHtml(book ? book.name : bookId)}</span>
            <span class="chapterMeta">${selectedCount}/${chapters.length}</span>
          </summary>
          <div class="chapterToolbar">
            <button type="button" class="miniBtn" data-chapter-all="${escapeAttr(bookId)}">Alle</button>
            <button type="button" class="miniBtn ghost" data-chapter-none="${escapeAttr(bookId)}">Keine</button>
          </div>
          <div class="chapterGrid">${buttons}</div>
        </details>
      `;
    }).join("");
  }

  function renderCategoryChips() {
    reconcileCategories();
    const available = availableCategoriesForSelectedBooks();
    const selected = new Set(app.settings.selectedCategories);

    els.categoryChips.innerHTML = available.map((category) => chipHtml({
      label: category,
      value: category,
      attr: "category",
      selected: selected.has(category),
    })).join("");

    if (available.length === 0) {
      els.categoryChips.innerHTML = `<div class="formError">Keine Kategorien</div>`;
    }
  }

  function chipHtml({ label, value, attr, selected }) {
    return `
      <button type="button" class="chipBtn" data-${attr}="${escapeAttr(value)}" aria-checked="${selected ? "true" : "false"}">
        ${escapeHtml(label)}
      </button>
    `;
  }

  function toggleDifficulty(difficulty) {
    const selected = new Set(app.settings.selectedDifficulties);
    if (selected.has(difficulty)) selected.delete(difficulty);
    else selected.add(difficulty);
    app.settings.selectedDifficulties = DIFFICULTY_ORDER.filter((d) => selected.has(d));
    saveSettings();
    renderDifficultyChips();
    updateAvailablePreview();
  }

  function toggleBook(bookId) {
    const selected = new Set(app.settings.selectedBooks);
    if (selected.has(bookId)) selected.delete(bookId);
    else selected.add(bookId);

    app.settings.selectedBooks = app.books.map((b) => b.id).filter((id) => selected.has(id));
    reconcileChapters();
    reconcileCategories();
    saveSettings();
    renderBookGrid();
    renderChapterAccordions();
    renderCategoryChips();
    updateAvailablePreview();
  }

  function toggleCategory(category) {
    app.settings.categoryMode = "custom";
    if (!app.settings.categorySelections || typeof app.settings.categorySelections !== "object") {
      app.settings.categorySelections = {};
    }
    const selected = app.settings.categorySelections[category] !== false;
    app.settings.categorySelections[category] = !selected;
    reconcileCategories();
    saveSettings();
    renderCategoryChips();
    updateAvailablePreview();
  }

  function toggleChapter(bookId, chapter) {
    if (!bookId || !chapter) return;
    if (!app.settings.chapterSelections[bookId] || typeof app.settings.chapterSelections[bookId] !== "object") {
      app.settings.chapterSelections[bookId] = {};
    }

    const selected = app.settings.chapterSelections[bookId][chapter] !== false;
    app.settings.chapterSelections[bookId][chapter] = !selected;
    reconcileChapters();
    saveSettings();
    renderChapterAccordions();
    updateAvailablePreview();
  }

  function setChaptersForBook(bookId, selected) {
    if (!bookId) return;
    const chapters = app.chaptersByBook.get(bookId) || [];
    if (!app.settings.chapterSelections[bookId] || typeof app.settings.chapterSelections[bookId] !== "object") {
      app.settings.chapterSelections[bookId] = {};
    }

    chapters.forEach((chapter) => {
      app.settings.chapterSelections[bookId][chapter] = !!selected;
    });

    reconcileChapters();
    saveSettings();
    renderChapterAccordions();
    updateAvailablePreview();
  }

  function setBooksByMode(mode) {
    if (mode === "all") {
      app.settings.selectedBooks = app.books.map((b) => b.id);
    } else if (mode === "at") {
      app.settings.selectedBooks = app.books.filter((b) => b.testament === "at").map((b) => b.id);
    } else if (mode === "nt") {
      app.settings.selectedBooks = app.books.filter((b) => b.testament === "nt").map((b) => b.id);
    } else {
      app.settings.selectedBooks = [];
    }

    reconcileChapters();
    reconcileCategories();
    saveSettings();
    renderBookGrid();
    renderChapterAccordions();
    renderCategoryChips();
    updateAvailablePreview();
  }

  function isChapterSelected(bookId, chapter) {
    const chapters = app.chaptersByBook.get(bookId) || [];
    if (chapters.length === 0) return true;
    const key = chapter || BOOK_SCOPE_CHAPTER;
    const selections = app.settings.chapterSelections?.[bookId];
    if (!selections || typeof selections !== "object") return true;
    return selections[key] !== false;
  }

  function availableCategoriesForSelectedBooks() {
    const categories = new Set();
    app.settings.selectedBooks.forEach((bookId) => {
      const bookCategories = app.categoriesByBook.get(bookId) || [];
      bookCategories.forEach((cat) => categories.add(cat));
    });
    return [...categories].sort(sortDe);
  }

  function updateAvailablePreview() {
    const pool = getFilteredQuestions();
    const count = cleanQuestionCount(app.settings.questionCount);
    const usable = Math.min(count, pool.length);

    els.availableLine.textContent = `${usable}/${pool.length}`;
    els.btnStartQuiz.disabled = pool.length === 0 || count < 1;

    if (pool.length === 0) {
      els.setupError.textContent = "Keine Treffer";
    } else {
      els.setupError.textContent = "";
    }

    updateTopbar();
  }

  function getFilteredQuestions() {
    const selectedBooks = new Set(app.settings.selectedBooks);
    const selectedDifficulties = new Set(app.settings.selectedDifficulties);
    const selectedCategories = new Set(app.settings.selectedCategories);

    return app.questions.filter((q) => (
      selectedBooks.has(q.book_id)
      && selectedDifficulties.has(q.difficulty)
      && selectedCategories.has(q.category)
      && isChapterSelected(q.book_id, q.chapterKey)
    ));
  }

  function startQuizFromSettings() {
    els.setupError.textContent = "";
    app.settings.questionCount = cleanQuestionCount(els.questionCount.value);
    reconcileSettings();
    saveSettings();

    const pool = shuffle(getFilteredQuestions());
    const selected = pool.slice(0, Math.min(app.settings.questionCount, pool.length));

    if (selected.length === 0) {
      els.setupError.textContent = "Keine Treffer";
      renderDifficultyChips();
      renderBookGrid();
      renderChapterAccordions();
      renderCategoryChips();
      updateAvailablePreview();
      return;
    }

    const stats = new Map(selected.map((q) => [q.id, {
      id: q.id,
      seen: 0,
      wrongs: 0,
      correctOnce: false,
      dueStep: 0,
    }]));

    app.quiz = {
      questions: selected,
      byId: new Map(selected.map((q) => [q.id, q])),
      remainingNew: [...selected],
      stats,
      reviewIds: [],
      mastered: new Set(),
      step: 0,
      totalAnswers: 0,
      wrongAnswers: 0,
      correctAnswers: 0,
      startedAt: Date.now(),
      lastQuestionId: null,
    };

    app.currentQuestion = null;
    app.answered = false;
    setView("quiz");
    showNextQuestion();
  }

  function showNextQuestion() {
    if (!app.quiz) return;

    if (app.quiz.mastered.size >= app.quiz.questions.length) {
      showResult();
      return;
    }

    const next = pickNextQuestion();
    if (!next) {
      showResult();
      return;
    }

    app.quiz.step += 1;
    app.quiz.lastQuestionId = next.id;
    app.currentQuestion = next;
    app.answered = false;
    app.lastChoice = null;

    const stat = app.quiz.stats.get(next.id);
    stat.seen += 1;

    els.questionKicker.textContent = "Wähle eine Antwort";
    els.questionText.textContent = next.question;
    els.choices.innerHTML = shuffle(next.choicesList).map((choice, index) => `
      <button type="button" class="choiceBtn" data-choice="${escapeAttr(choice)}">
        ${index + 1}. ${escapeHtml(choice)}
      </button>
    `).join("");

    els.feedback.className = "feedback panel hidden";
    els.feedbackTitle.textContent = "";
    els.feedbackText.textContent = "";
    els.referenceLine.textContent = "";
    updateTopbar();
  }

  function pickNextQuestion() {
    const quiz = app.quiz;
    const lastId = quiz.lastQuestionId;
    const dueReviews = quiz.reviewIds
      .map((id) => quiz.stats.get(id))
      .filter((stat) => stat && !stat.correctOnce && stat.dueStep <= quiz.step)
      .sort((a, b) => a.dueStep - b.dueStep || b.wrongs - a.wrongs);

    const dueNotLast = dueReviews.find((stat) => stat.id !== lastId);
    if (dueNotLast && (quiz.remainingNew.length === 0 || Math.random() < 0.68)) {
      return quiz.byId.get(dueNotLast.id);
    }

    while (quiz.remainingNew.length > 0) {
      const candidate = quiz.remainingNew.shift();
      if (!quiz.mastered.has(candidate.id) && candidate.id !== lastId) return candidate;
      if (!quiz.mastered.has(candidate.id) && quiz.remainingNew.length === 0) return candidate;
    }

    const nextReview = dueNotLast || dueReviews[0] || quiz.reviewIds
      .map((id) => quiz.stats.get(id))
      .filter((stat) => stat && !stat.correctOnce)
      .sort((a, b) => a.dueStep - b.dueStep || b.wrongs - a.wrongs)
      .find((stat) => stat.id !== lastId)
      || quiz.reviewIds.map((id) => quiz.stats.get(id)).find((stat) => stat && !stat.correctOnce);

    return nextReview ? quiz.byId.get(nextReview.id) : null;
  }

  function submitAnswer(choice) {
    if (!app.currentQuestion || !app.quiz || app.answered) return;

    app.answered = true;
    app.lastChoice = choice;
    const q = app.currentQuestion;
    const quiz = app.quiz;
    const stat = quiz.stats.get(q.id);
    const isCorrect = choice === q.correct_answer;

    quiz.totalAnswers += 1;

    if (isCorrect) {
      quiz.correctAnswers += 1;
      stat.correctOnce = true;
      quiz.mastered.add(q.id);
      quiz.reviewIds = quiz.reviewIds.filter((id) => id !== q.id);
    } else {
      quiz.wrongAnswers += 1;
      stat.wrongs += 1;
      stat.dueStep = quiz.step + spacedDelay(stat.wrongs, quiz.questions.length - quiz.mastered.size);
      if (!quiz.reviewIds.includes(q.id)) quiz.reviewIds.push(q.id);
    }

    [...els.choices.querySelectorAll(".choiceBtn")].forEach((btn) => {
      const btnChoice = btn.dataset.choice;
      btn.disabled = true;
      if (btnChoice === q.correct_answer) btn.classList.add("correct");
      else if (btnChoice === choice) btn.classList.add("wrong");
      else btn.classList.add("dimmed");
    });

    els.feedback.className = `feedback panel ${isCorrect ? "good" : "bad"}`;
    els.feedbackTitle.textContent = isCorrect ? "Richtig" : "Falsch";
    els.feedbackText.textContent = q.explanation;
    renderReference(q.reference);
    updateTopbar();
  }

  function renderReference(reference) {
    const label = String(reference || "").trim();
    if (!label) {
      els.referenceLine.textContent = "";
      return;
    }

    const url = bibleServerUrl(label);
    els.referenceLine.innerHTML = `
      <a class="referenceLink" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(label)}
      </a>
    `;
  }

  function bibleServerUrl(reference) {
    const compactRef = String(reference || "")
      .trim()
      .replace(/\s+/g, "");

    return `https://www.bibleserver.com/SLT/${encodeURIComponent(compactRef)}`;
  }

  function spacedDelay(wrongs, openCount) {
    if (openCount <= 2) return 1;
    if (openCount <= 5) return Math.min(3, 1 + wrongs);
    return Math.min(8, 2 + wrongs * 2);
  }

  function showResult() {
    if (!app.quiz) return;
    const seconds = Math.max(1, Math.round((Date.now() - app.quiz.startedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    const restSeconds = seconds % 60;
    const timeLabel = minutes > 0 ? `${minutes}:${String(restSeconds).padStart(2, "0")}` : `${seconds}s`;
    const stars = calculateStars(app.quiz.questions.length, app.quiz.totalAnswers);

    els.resultText.textContent = "";
    els.resultStats.innerHTML = [
      statTile(app.quiz.questions.length, "Fragen"),
      statTile(app.quiz.wrongAnswers, "Fehler"),
      statTile(timeLabel, "Zeit"),
    ].join("");
    els.resultBadge.innerHTML = starRatingHtml(stars);
    setView("result");
  }

  function confirmAbortQuiz() {
    if (app.view !== "quiz") return;
    const ok = window.confirm("Quiz abbrechen?");
    if (ok) setView("setup");
  }

  function setView(view) {
    app.view = view;
    els.viewHome.classList.toggle("hidden", view !== "home");
    els.viewSetup.classList.toggle("hidden", view !== "setup");
    els.viewQuiz.classList.toggle("hidden", view !== "quiz");
    els.viewResult.classList.toggle("hidden", view !== "result");

    els.topbar.classList.toggle("hidden", view === "home");
    els.btnBack.classList.toggle("hidden", view === "home");
    els.btnAbort.classList.toggle("hidden", view !== "quiz");

    updateTopbar();
  }

  function updateTopbar() {
    let title = "Scrivia";
    let sub = "";
    let pct = 0;

    if (app.view === "setup") {
      title = "Quiz erstellen";
      sub = `${getFilteredQuestions().length}`;
    } else if (app.view === "quiz" && app.quiz) {
      title = "Scrivia";
      sub = `${app.quiz.mastered.size}/${app.quiz.questions.length}`;
      pct = app.quiz.questions.length ? Math.round((app.quiz.mastered.size / app.quiz.questions.length) * 100) : 0;
    } else if (app.view === "result") {
      title = "Fertig";
      pct = 100;
    }

    els.topTitle.textContent = title;
    els.topSub.textContent = sub;
    els.topbar.style.setProperty("--barPct", `${pct}%`);
  }

  function calculateStars(questionCount, totalAnswers) {
    if (!questionCount || !totalAnswers) return 0;
    const raw = (questionCount / totalAnswers) * 5;
    return Math.max(0.5, Math.min(5, Math.round(raw * 2) / 2));
  }

  function starRatingHtml(stars) {
    const safeStars = Math.max(0, Math.min(5, stars));
    const label = Number.isInteger(safeStars) ? String(safeStars) : String(safeStars).replace(".", ",");
    const items = Array.from({ length: 5 }, (_, index) => {
      const fill = Math.max(0, Math.min(1, safeStars - index));
      return starSvgHtml(Math.round(fill * 100));
    }).join("");

    return `
      <div class="starRating" role="img" aria-label="${escapeAttr(label)} von 5 Sternen">${items}</div>
      <div class="starScore">${escapeHtml(label)}/5</div>
    `;
  }

  function starSvgHtml(fillPct) {
    const path = "M12 1.8l3.05 6.18 6.82.99-4.94 4.82 1.17 6.79L12 17.38l-6.1 3.2 1.17-6.79-4.94-4.82 6.82-.99L12 1.8z";
    const width = Math.max(0, Math.min(100, fillPct));

    return `
      <span class="starBox" aria-hidden="true">
        <svg class="starSvg starEmpty" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="${path}" fill="currentColor"></path>
        </svg>
        <span class="starClip" style="width:${width}%">
          <svg class="starSvg starFull" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="${path}" fill="currentColor"></path>
          </svg>
        </span>
      </span>
    `;
  }

  function statTile(value, label) {
    return `
      <div class="statTile">
        <div class="statValue">${escapeHtml(String(value))}</div>
        <div class="statLabel">${escapeHtml(label)}</div>
      </div>
    `;
  }

  function bookGroupRgb(bookId, testament) {
    const group = BOOK_GROUP_BY_ID.get(bookId) || (testament === "at" ? "AT Geschichte" : "Evangelien");
    return GROUP_RGB[group] || [200, 200, 200];
  }

  function rgba(rgb, alpha) {
    const [r, g, b] = rgb;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function labelDifficulty(value) {
    if (value === "leicht") return "Leicht";
    if (value === "mittel") return "Mittel";
    if (value === "schwer") return "Schwer";
    return value;
  }

  function shortBookName(name) {
    const map = new Map([
      ["1. Mose", "Gen"], ["2. Mose", "Ex"], ["3. Mose", "Lev"], ["4. Mose", "Num"], ["5. Mose", "Dtn"],
      ["Josua", "Jos"], ["Richter", "Ri"], ["1. Samuel", "1 Sam"], ["2. Samuel", "2 Sam"],
      ["1. Könige", "1 Kön"], ["2. Könige", "2 Kön"], ["1. Chronik", "1 Chr"], ["2. Chronik", "2 Chr"],
      ["Psalmen", "Ps"], ["Sprüche", "Spr"], ["Prediger", "Pred"], ["Hoheslied", "Hld"],
      ["Jesaja", "Jes"], ["Jeremia", "Jer"], ["Klagelieder", "Klgl"], ["Hesekiel", "Hes"], ["Daniel", "Dan"],
      ["Matthäus", "Mt"], ["Markus", "Mk"], ["Lukas", "Lk"], ["Johannes", "Joh"],
      ["Apostelgeschichte", "Apg"], ["Römer", "Röm"], ["1. Korinther", "1 Kor"], ["2. Korinther", "2 Kor"],
      ["Galater", "Gal"], ["Epheser", "Eph"], ["Philipper", "Phil"], ["Kolosser", "Kol"],
      ["1. Thessalonicher", "1 Thess"], ["2. Thessalonicher", "2 Thess"], ["1. Timotheus", "1 Tim"], ["2. Timotheus", "2 Tim"],
      ["Hebräer", "Hebr"], ["Jakobus", "Jak"], ["1. Petrus", "1 Petr"], ["2. Petrus", "2 Petr"],
      ["1. Johannes", "1 Joh"], ["2. Johannes", "2 Joh"], ["3. Johannes", "3 Joh"], ["Offenbarung", "Offb"],
    ]);
    return map.get(name) || name;
  }

  function chapterKey(chapter, scope) {
    const value = String(chapter || "").trim();
    if (!value || normalizeToken(scope) === "book") return value || BOOK_SCOPE_CHAPTER;
    return value;
  }

  function chapterLabel(chapter) {
    return chapter === BOOK_SCOPE_CHAPTER ? "Allgemein" : String(chapter);
  }

  function sortChapters(a, b) {
    if (a === BOOK_SCOPE_CHAPTER && b !== BOOK_SCOPE_CHAPTER) return -1;
    if (b === BOOK_SCOPE_CHAPTER && a !== BOOK_SCOPE_CHAPTER) return 1;
    const an = Number(String(a).match(/^\d+/)?.[0]);
    const bn = Number(String(b).match(/^\d+/)?.[0]);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    if (Number.isFinite(an) && !Number.isFinite(bn)) return -1;
    if (!Number.isFinite(an) && Number.isFinite(bn)) return 1;
    return sortDe(a, b);
  }

  function normalizeNestedSelectionMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result = {};
    Object.entries(value).forEach(([outerKey, innerValue]) => {
      const key = String(outerKey).trim();
      if (!key || !innerValue || typeof innerValue !== "object" || Array.isArray(innerValue)) return;
      result[key] = normalizeSelectionMap(innerValue);
    });
    return result;
  }

  function normalizeSelectionMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, val]) => [String(key).trim(), val !== false])
        .filter(([key]) => key)
    );
  }

  function cleanQuestionCount(value) {
    const parsed = Number.parseInt(String(value ?? "10"), 10);
    if (!Number.isFinite(parsed)) return 10;
    return Math.max(1, Math.min(999, parsed));
  }

  function normalizeToken(value) {
    return String(value || "").trim().toLowerCase();
  }

  function unique(arr) {
    return [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean))];
  }

  function sortDe(a, b) {
    return String(a).localeCompare(String(b), "de", { numeric: true, sensitivity: "base" });
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
