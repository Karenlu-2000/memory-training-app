const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = { mode: 'mixed', difficulty: 'medium', phase: 'setup', memorySeconds: 720, answerSeconds: 480, remaining: 720, question: {}, timerId: null };
const words = ['流星', '書桌', '珊瑚', '雨傘', '月亮', '地圖', '檸檬', '燈塔', '風箏', '森林', '車票', '海浪', '雲朵', '鑰匙', '河流', '火山', '日曆', '鏡子', '花園', '船錨'];
const strategies = ['瞞天過海', '圍魏救趙', '借刀殺人', '以逸待勞', '趁火打劫', '聲東擊西', '無中生有', '暗度陳倉', '隔岸觀火', '笑裡藏刀'];
const suits = [{ symbol: '♠', red: false }, { symbol: '♥', red: true }, { symbol: '♦', red: true }, { symbol: '♣', red: false }];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const difficultyLevels = {
  simple: { label: '簡單', numbers: 20, words: 8, cards: 8, strategies: 3 },
  medium: { label: '中等', numbers: 30, words: 12, cards: 10, strategies: 5 },
  hard: { label: '困難', numbers: 40, words: 16, cards: 12, strategies: 7 },
};
const landingScreen = $('#landing-screen');
const setupScreen = $('#setup-screen');
const sessionScreen = $('#session-screen');
const resultScreen = $('#result-screen');

function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function generateCards(count) { return shuffle(ranks.flatMap(rank => suits.map(suit => ({ rank, ...suit })))).slice(0, count); }
function generateNumbers(count) {
  const digits = [];
  while (digits.length < count) {
    const last = digits.at(-1);
    const allowPair = Boolean(last) && Math.random() < 0.07;
    const candidates = allowPair ? ['0','1','2','3','4','5','6','7','8','9'] : ['0','1','2','3','4','5','6','7','8','9'].filter(digit => digit !== last);
    digits.push(pick(candidates));
  }
  return digits;
}
function generateQuestion() {
  const level = difficultyLevels[state.difficulty];
  const numbers = generateNumbers(level.numbers);
  const wordList = shuffle(words).slice(0, level.words);
  const cards = generateCards(level.cards);
  const planList = shuffle(strategies).slice(0, level.strategies);
  if (state.mode === 'numbers') return { numbers };
  if (state.mode === 'words') return { words: wordList };
  if (state.mode === 'cards') return { cards };
  return { numbers, words: wordList, cards, strategies: planList };
}
function cardText(card) { return `${card.rank}${card.symbol}`; }
function showScreen(screen) { [landingScreen, setupScreen, sessionScreen, resultScreen].forEach(node => node.classList.add('is-hidden')); screen.classList.remove('is-hidden'); }
function setHeader(session) { $('#back-button').classList.toggle('is-hidden', !session); $('#brand-text').textContent = session ? '第一階段:極速記憶' : '記憶訓練練習系統'; }
function formatTime(seconds) { return `${String(Math.max(0, Math.floor(seconds / 60))).padStart(2, '0')}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`; }
function updateTimer() { $('#timer').textContent = formatTime(state.remaining); $('#timer').dateTime = `PT${state.remaining}S`; }
function renderNumbers(numbers, compact = false) { return `<div class="number-grid">${numbers.map(number => `<span class="number-token">${number}</span>`).join('')}</div>`; }
function renderWords(wordList) { return `<div class="word-grid">${wordList.map(word => `<span class="word-token">${word}</span>`).join('')}</div>`; }
function renderCards(cards) { return `<div class="card-grid">${cards.map(card => `<span class="card-token ${card.red ? 'is-red' : ''}">${cardText(card)}</span>`).join('')}</div>`; }
function renderPlans(planList) { return `<div class="plan-grid">${planList.map(item => `<span class="plan-token">${item}</span>`).join('')}</div>`; }
function renderMemory() {
  const q = state.question;
  if (state.mode === 'numbers') $('#question-stage').innerHTML = renderNumbers(q.numbers);
  if (state.mode === 'words') $('#question-stage').innerHTML = renderWords(q.words);
  if (state.mode === 'cards') $('#question-stage').innerHTML = renderCards(q.cards);
  if (state.mode === 'mixed') $('#question-stage').innerHTML = `<div class="mixed-memory"><section class="mixed-section"><h3>數字記憶 · ${q.numbers.length} 個</h3>${renderNumbers(q.numbers, true)}</section><section class="mixed-section"><h3>文字記憶 · ${q.words.length} 個</h3>${renderWords(q.words)}</section><section class="mixed-section"><h3>撲克牌記憶 · ${q.cards.length} 張</h3>${renderCards(q.cards)}</section><section class="mixed-section"><h3>三十六計記憶 · ${q.strategies.length} 個</h3>${renderPlans(q.strategies)}</section></div>`;
}
function inputBlock(key, label, hint) { return `<div class="answer-block"><label for="answer-${key}">${label}</label><input class="answer-input" id="answer-${key}" autocomplete="off" placeholder="${hint}" /><p class="answer-hint">${hint}</p></div>`; }
function renderAnswer() {
  const blocks = [];
  if (state.question.numbers) blocks.push(inputBlock('numbers', '數字答案', `連續輸入 ${state.question.numbers.length} 個數字，例如：2765717030…`));
  if (state.question.words) blocks.push(inputBlock('words', '文字答案', `依順序以空格或逗號分隔 ${state.question.words.length} 個詞語`));
  if (state.question.cards) blocks.push(inputBlock('cards', '撲克牌答案', '依順序以空格或逗號分隔，例如：A♠, 7♥, K♦'));
  if (state.question.strategies) blocks.push(inputBlock('strategies', '三十六計答案', '輸入記得的成語，以空格或逗號分隔'));
  $('#question-stage').innerHTML = `<div class="answer-form">${blocks.join('')}</div>`;
  setTimeout(() => $('.answer-input')?.focus(), 20);
}
function normalizedList(value) { return value.trim().split(/[\s,，、\n]+/).filter(Boolean).map(item => item.toUpperCase()); }
function scoreOrdered(key, expected) {
  const value = $(`#answer-${key}`)?.value ?? '';
  const actual = key === 'numbers' ? value.replace(/\s/g, '').split('') : normalizedList(value);
  const answer = expected.map(item => String(item).toUpperCase());
  return { correct: answer.reduce((total, item, index) => total + Number(actual[index] === item), 0), total: answer.length };
}
function scoreStrategies(expected) {
  const actual = normalizedList($('#answer-strategies')?.value ?? '');
  const correct = expected.reduce((total, item) => total + Number(actual.includes(item.toUpperCase())), 0);
  return { correct, total: expected.length };
}
function submittedItems(key) {
  const value = $(`#answer-${key}`)?.value ?? '';
  return key === 'numbers' ? value.replace(/\s/g, '').split('') : normalizedList(value);
}
function comparisonBlock(title, expected, submitted) {
  const answerClass = title === '文字' ? 'answer-line is-word-answer' : 'answer-line';
  return `<section class="answer-comparison"><h2>${title} · 原始題目（正確答案）:</h2><div class="${answerClass}">${expected.map(item => `<span>${item}</span>`).join('')}</div><h2>${title} · 您的提交答案:</h2><div class="${answerClass}">${submitted.map(item => `<span>${item}</span>`).join('') || '<em>尚未填寫</em>'}</div></section>`;
}
function submitAnswer() {
  clearInterval(state.timerId);
  const results = [];
  if (state.question.numbers) results.push(['數字（依順序）', scoreOrdered('numbers', state.question.numbers)]);
  if (state.question.words) results.push(['文字（依順序）', scoreOrdered('words', state.question.words)]);
  if (state.question.cards) results.push(['撲克牌（依順序）', scoreOrdered('cards', state.question.cards.map(cardText))]);
  if (state.question.strategies) results.push(['三十六計', scoreStrategies(state.question.strategies)]);
  const correct = results.reduce((total, [, score]) => total + score.correct, 0);
  const total = results.reduce((sum, [, score]) => sum + score.total, 0);
  const percentage = Math.round(correct / total * 100);
  $('#score-percent').textContent = `${percentage}%`;
  $('#score-summary').textContent = `（${correct} / ${total} 題正確）`;
  const comparisons = [];
  if (state.question.numbers) comparisons.push(comparisonBlock('數字', state.question.numbers, submittedItems('numbers')));
  if (state.question.words) comparisons.push(comparisonBlock('文字', state.question.words, submittedItems('words')));
  if (state.question.cards) comparisons.push(comparisonBlock('撲克牌', state.question.cards.map(cardText), submittedItems('cards')));
  if (state.question.strategies) comparisons.push(comparisonBlock('三十六計', state.question.strategies, submittedItems('strategies')));
  const resultScores = results.map(([label, score]) => `<div class="result-detail"><span>${label}</span><strong>${score.correct} / ${score.total} 題正確 · ${Math.round(score.correct / score.total * 100)}%</strong></div>`).join('');
  $('#result-details').innerHTML = `${resultScores}${comparisons.join('')}`;
  $('#result-title').textContent = state.mode === 'numbers' ? '練習結果' : '本次練習完成';
  showScreen(resultScreen);
}
function setPhase(phase) {
  state.phase = phase;
  clearInterval(state.timerId);
  state.remaining = phase === 'memory' ? state.memorySeconds : state.answerSeconds;
  $('#session-title').textContent = phase === 'memory' ? '記憶階段' : '作答階段';
  $('#timer-caption').childNodes[0].nodeValue = phase === 'memory' ? '剩餘時間:' : '作答剩餘時間:';
  $('#memory-tip').textContent = phase === 'memory' ? '準備好後，可隨時提前開始作答。' : '數字、文字、撲克牌請依原本順序作答；完成後可隨時提交。';
  $('#phase-button').textContent = phase === 'memory' ? '開始回答' : '提交答案';
  if (phase === 'memory') renderMemory(); else renderAnswer();
  updateTimer();
  state.timerId = setInterval(() => { state.remaining -= 1; updateTimer(); if (state.remaining <= 0) phase === 'memory' ? setPhase('answer') : submitAnswer(); }, 1000);
}
function startPractice() { state.question = generateQuestion(); setHeader(true); showScreen(sessionScreen); setPhase('memory'); }
function goHome() { clearInterval(state.timerId); setHeader(false); showScreen(landingScreen); }
function showSetup() { setHeader(true); showScreen(setupScreen); renderModeDetail(); }
function renderModeDetail() {
  const level = difficultyLevels[state.difficulty];
  const copy = {
    numbers: { title: '數字記憶練習', description: `記憶 ${level.numbers} 個數字,按照順序作答`, count: `數字記憶:${level.numbers} 個` },
    words: { title: '文字記憶練習', description: `記憶 ${level.words} 個詞語,按照順序作答`, count: `文字記憶:${level.words} 個` },
    cards: { title: '撲克牌記憶練習', description: `記憶 ${level.cards} 張牌的花色與順序`, count: `撲克牌記憶:${level.cards} 張` },
  };
  const selector = `<label class="difficulty-label" for="difficulty">難易度</label><select class="difficulty-select" id="difficulty">${Object.entries(difficultyLevels).map(([key, item]) => `<option value="${key}" ${key === state.difficulty ? 'selected' : ''}>${item.label}</option>`).join('')}</select>`;
  const mixedCounts = [`數字記憶:${level.numbers} 個`, `文字記憶:${level.words} 個`, `撲克牌記憶:${level.cards} 張`, `三十六計記憶:${level.strategies} 個`];
  const detail = state.mode === 'mixed' ? { title: '⚙　綜合練習設定', description: '選擇難易度後開始完整模擬考核', counts: mixedCounts } : { ...copy[state.mode], counts: [copy[state.mode].count] };
  $('#mode-detail').innerHTML = `<h2>${detail.title}</h2><p>${detail.description}</p>${selector}<div class="difficulty-box"><strong>${level.label}難度</strong><ul>${detail.counts.map(count => `<li>${count}</li>`).join('')}</ul><hr /><strong>記憶時間:12 分鐘｜作答時間:8 分鐘</strong></div>`;
  $('#difficulty').addEventListener('change', event => { state.difficulty = event.target.value; renderModeDetail(); });
}

$('#enter-setup-button').addEventListener('click', showSetup);
$('#start-button').addEventListener('click', startPractice);
$('#phase-button').addEventListener('click', () => state.phase === 'memory' ? setPhase('answer') : submitAnswer());
$('#back-button').addEventListener('click', goHome);
$('#home-button').addEventListener('click', goHome);
$('#retry-button').addEventListener('click', startPractice);
$$('.mode-tab').forEach(button => button.addEventListener('click', () => { state.mode = button.dataset.mode; $$('.mode-tab').forEach(tab => { const selected = tab === button; tab.classList.toggle('is-selected', selected); tab.setAttribute('aria-checked', selected); }); renderModeDetail(); }));
renderModeDetail();
