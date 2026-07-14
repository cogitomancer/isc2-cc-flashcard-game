document.addEventListener("DOMContentLoaded", () => {
    // --- State Variables ---
    let allCards = [];
    let activeDeck = [];
    let currentIndex = 0;
    
    // Study Progress
    let studyProgress = {
        knownIds: [],
        reviewIds: []
    };

    // Match High Score Progress (Indexed by "domain:pairCount")
    let bestScores = {};

    // Match Session Variables
    let matchDeck = []; // The original selected flashcards
    let matchGridCards = []; // The active shuffled visual cards (2N cards)
    let firstCard = null;
    let secondCard = null;
    let lockBoard = false;
    let movesCount = 0;
    let matchedPairs = 0;
    let targetPairs = 0;
    
    // Match Timer
    let timerInterval = null;
    let secondsElapsed = 0;

    // --- DOM Elements ---
    const setupSection = document.getElementById('setup-section');
    const studySection = document.getElementById('study-section');
    const matchSection = document.getElementById('match-section');
    const matchResultsSection = document.getElementById('match-results-section');
    
    const globalStatsHeader = document.getElementById('global-stats-header');
    const domainSelect = document.getElementById('domain-select');
    const modeSelect = document.getElementById('mode-select');
    const matchSetupOptions = document.getElementById('match-setup-options');
    const pairsSelect = document.getElementById('pairs-select');
    const errorMsg = document.getElementById('error-message');
    
    // Study Card Elements
    const flashcard = document.getElementById('flashcard');
    const termEl = document.getElementById('card-term');
    const defEl = document.getElementById('card-definition');
    const domainFrontEl = document.getElementById('card-domain-front');
    const domainBackEl = document.getElementById('card-domain-back');
    const extrasEl = document.getElementById('card-extras');
    
    // Study Stats Elements
    const cardCounterEl = document.getElementById('card-counter');
    const knownCountEl = document.getElementById('known-count');
    const reviewCountEl = document.getElementById('review-count');

    // Match HUD Elements
    const hudPairsCount = document.getElementById('match-pairs-count');
    const hudMovesCount = document.getElementById('match-moves-count');
    const hudTimer = document.getElementById('match-timer');
    const hudBestScore = document.getElementById('match-best-score');
    const matchGrid = document.getElementById('match-grid');

    // Match Results Elements
    const resultTime = document.getElementById('result-time');
    const resultMoves = document.getElementById('result-moves');
    const resultAccuracy = document.getElementById('result-accuracy');
    const newBestAlert = document.getElementById('new-best-alert');

    // Action Buttons
    const startBtn = document.getElementById('start-btn');
    const resetProgressBtn = document.getElementById('reset-progress-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const revealBtn = document.getElementById('reveal-btn');
    const knewBtn = document.getElementById('knew-btn');
    const reviewBtn = document.getElementById('review-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const studyMatchedBtn = document.getElementById('study-matched-btn');
    const changeSetupBtn = document.getElementById('change-setup-btn');

    // --- Initialization ---
    init();

    async function init() {
        loadProgress();
        try {
            const response = await fetch('flashcards.json');
            if (!response.ok) throw new Error('Network response was not ok');
            
            allCards = await response.json();
            populateDomains(allCards);
            updateStudyStatsUI();
        } catch (error) {
            console.error('Failed to load flashcards:', error);
            showError("Could not load flashcards.json. Ensure you are running this on a server and the file is named correctly.");
        }
    }

    // --- Setup UI Management ---
    function populateDomains(cards) {
        const domains = new Set();
        cards.forEach(card => {
            if (card.domainName) {
                domains.add(card.domainName);
            }
        });

        Array.from(domains).sort().forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainSelect.appendChild(option);
        });
    }

    // Toggle showing match parameters based on mode selection
    modeSelect.addEventListener('change', () => {
        if (modeSelect.value === 'match') {
            matchSetupOptions.classList.remove('hidden');
        } else {
            matchSetupOptions.classList.add('hidden');
        }
    });

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }

    // --- Shuffler ---
    function shuffleArray(array) {
        let shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // --- High Score / Saved Progress State ---
    function loadProgress() {
        const savedProgress = localStorage.getItem('isc2_cc_progress');
        if (savedProgress) {
            try {
                studyProgress = JSON.parse(savedProgress);
            } catch (e) {
                console.error("Error parsing studyProgress data", e);
            }
        }
        const savedScores = localStorage.getItem('isc2_cc_best_scores');
        if (savedScores) {
            try {
                bestScores = JSON.parse(savedScores);
            } catch (e) {
                console.error("Error parsing bestScores data", e);
            }
        }
    }

    function saveStudyProgress() {
        localStorage.setItem('isc2_cc_progress', JSON.stringify(studyProgress));
        updateStudyStatsUI();
    }

    function updateStudyStatsUI() {
        knownCountEl.textContent = studyProgress.knownIds.length;
        reviewCountEl.textContent = studyProgress.reviewIds.length;
        
        if (activeDeck.length > 0) {
            cardCounterEl.textContent = `${currentIndex + 1} / ${activeDeck.length}`;
        } else {
            cardCounterEl.textContent = "0 / 0";
        }
    }

    function resetAllProgress() {
        if (confirm("Are you sure you want to completely reset all study progress and Match high scores?")) {
            studyProgress = { knownIds: [], reviewIds: [] };
            bestScores = {};
            localStorage.removeItem('isc2_cc_progress');
            localStorage.removeItem('isc2_cc_best_scores');
            updateStudyStatsUI();
            alert("All browser scores and study states have been reset!");
        }
    }

    // --- Action Switcher: Begin Session ---
    startBtn.addEventListener('click', () => {
        const selectedDomain = domainSelect.value;
        const selectedMode = modeSelect.value;

        // Filter cards matching Domain criteria
        let filtered = (selectedDomain === 'all') 
            ? [...allCards] 
            : allCards.filter(card => card.domainName === selectedDomain);

        if (filtered.length === 0) {
            showError("No cards found for the selected domain.");
            return;
        }

        errorMsg.classList.add('hidden');

        if (selectedMode === 'study') {
            globalStatsHeader.classList.remove('hidden');
            startStudySession(filtered);
        } else {
            globalStatsHeader.classList.add('hidden'); // Clean HUD during match
            startMatchSession(filtered, selectedDomain);
        }
    });

    // --- Study Session Core ---
    function startStudySession(cards) {
        activeDeck = shuffleArray(cards);
        currentIndex = 0;
        
        setupSection.classList.add('hidden');
        matchSection.classList.add('hidden');
        matchResultsSection.classList.add('hidden');
        studySection.classList.remove('hidden');

        renderStudyCard();
    }

    function renderStudyCard() {
        if (activeDeck.length === 0) return;
        
        flashcard.classList.remove('is-flipped');
        
        const card = activeDeck[currentIndex];
        termEl.textContent = card.term || "Unknown Term";
        defEl.textContent = card.definition || "No definition provided.";
        domainFrontEl.textContent = card.domainName || "Domain Unknown";
        domainBackEl.textContent = card.domainName || "Domain Unknown";

        // Handle tags/examples
        let extrasHTML = '';
        if (card.example && card.example.toLowerCase() !== 'nan') {
            extrasHTML += `<p><strong>Example:</strong> ${card.example}</p>`;
        }
        if (card.tags && card.tags.length > 0) {
            extrasHTML += `<p><strong>Tags:</strong> ${card.tags.join(', ')}</p>`;
        }
        
        if (extrasHTML !== '') {
            extrasEl.innerHTML = extrasHTML;
            extrasEl.classList.remove('hidden');
        } else {
            extrasEl.classList.add('hidden');
        }

        updateStudyStatsUI();
    }

    function flipStudyCard() {
        flashcard.classList.toggle('is-flipped');
    }

    function goToNextCard() {
        if (currentIndex < activeDeck.length - 1) {
            currentIndex++;
            renderStudyCard();
        } else {
            alert("You have reviewed all cards in this selected deck!");
        }
    }

    function goToPrevCard() {
        if (currentIndex > 0) {
            currentIndex--;
            renderStudyCard();
        }
    }

    function handleStudyCardState(status) {
        const cardId = activeDeck[currentIndex].id;
        
        // Remove prior matches to maintain array clean states
        studyProgress.knownIds = studyProgress.knownIds.filter(id => id !== cardId);
        studyProgress.reviewIds = studyProgress.reviewIds.filter(id => id !== cardId);

        if (status === 'known') {
            studyProgress.knownIds.push(cardId);
        } else {
            studyProgress.reviewIds.push(cardId);
        }

        saveStudyProgress();
        goToNextCard();
    }


    // --- Match Mode Core ---
    function startMatchSession(cards, domainKey) {
        const requestedPairs = parseInt(pairsSelect.value, 10);
        targetPairs = Math.min(cards.length, requestedPairs);

        // Select exact random pool from the selection domain
        matchDeck = shuffleArray(cards).slice(0, targetPairs);

        setupSection.classList.add('hidden');
        studySection.classList.add('hidden');
        matchResultsSection.classList.add('hidden');
        matchSection.classList.remove('hidden');

        // Hud Reset metrics
        movesCount = 0;
        matchedPairs = 0;
        secondsElapsed = 0;
        firstCard = null;
        secondCard = null;
        lockBoard = false;

        updateMatchHUD(domainKey);
        generateMatchGrid();
        startTimer();
    }

    function updateMatchHUD(domainKey) {
        hudPairsCount.textContent = `0/${targetPairs}`;
        hudMovesCount.textContent = "0";
        hudTimer.textContent = "00:00";

        // Query Match highscore
        const scoreKey = `${domainKey}:${targetPairs}`;
        const record = bestScores[scoreKey];
        if (record) {
            hudBestScore.textContent = `${record.moves} moves (${formatTime(record.time)})`;
        } else {
            hudBestScore.textContent = "None";
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            secondsElapsed++;
            hudTimer.textContent = formatTime(secondsElapsed);
        }, 1000);
    }

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function generateMatchGrid() {
        matchGrid.innerHTML = '';
        matchGridCards = [];

        // Build one Term Card and one Definition Card per item in matchDeck
        matchDeck.forEach(card => {
            matchGridCards.push({
                pairId: card.id,
                type: 'term',
                content: card.term
            });
            matchGridCards.push({
                pairId: card.id,
                type: 'definition',
                content: card.definition
            });
        });

        // Shuffle deck
        matchGridCards = shuffleArray(matchGridCards);

        // Render DOM Elements
        matchGridCards.forEach((cardData, index) => {
            const cardEl = document.createElement('div');
            cardEl.classList.add('match-card', cardData.type);
            cardEl.dataset.pairId = cardData.pairId;
            cardEl.dataset.type = cardData.type;
            cardEl.dataset.index = index;
            cardEl.tabIndex = 0;
            cardEl.setAttribute('role', 'button');
            cardEl.setAttribute('aria-label', `Card ${index + 1}: Hidden ${cardData.type}`);

            cardEl.innerHTML = `
                <div class="match-card-inner">
                    <div class="match-card-front">?</div>
                    <div class="match-card-back">
                        <span class="match-card-badge">${cardData.type}</span>
                        <p class="match-card-text">${cardData.content}</p>
                    </div>
                </div>
            `;

            // Click Handler
            cardEl.addEventListener('click', () => handleCardFlip(cardEl));

            // Space / Enter Handler
            cardEl.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleCardFlip(cardEl);
                }
            });

            matchGrid.appendChild(cardEl);
        });
    }

    function handleCardFlip(cardEl) {
        if (lockBoard) return;
        if (cardEl === firstCard) return; // Prevent double selecting same card
        if (cardEl.classList.contains('is-flipped') || cardEl.classList.contains('is-matched')) return;

        cardEl.classList.add('is-flipped');

        if (!firstCard) {
            // First select
            firstCard = cardEl;
            return;
        }

        // Second Select
        secondCard = cardEl;
        movesCount++;
        hudMovesCount.textContent = movesCount;

        checkMatchResult();
    }

    function checkMatchResult() {
        const id1 = firstCard.dataset.pairId;
        const id2 = secondCard.dataset.pairId;
        const type1 = firstCard.dataset.type;
        const type2 = secondCard.dataset.type;

        // Correct match requirements: Same Card ID, different block type (Term & Definition)
        const isMatch = (id1 === id2 && type1 !== type2);

        if (isMatch) {
            disableMatchedCards();
        } else {
            unflipUnmatchedCards();
        }
    }

    function disableMatchedCards() {
        firstCard.classList.add('is-matched');
        secondCard.classList.add('is-matched');
        
        firstCard.setAttribute('aria-label', `${firstCard.dataset.type} Matched`);
        secondCard.setAttribute('aria-label', `${secondCard.dataset.type} Matched`);

        matchedPairs++;
        hudPairsCount.textContent = `${matchedPairs}/${targetPairs}`;

        resetActiveCardState();

        if (matchedPairs === targetPairs) {
            endMatchRound();
        }
    }

    function unflipUnmatchedCards() {
        lockBoard = true;
        setTimeout(() => {
            firstCard.classList.remove('is-flipped');
            secondCard.classList.remove('is-flipped');
            resetActiveCardState();
        }, 1200); // Allow brief reading interval before turning over
    }

    function resetActiveCardState() {
        firstCard = null;
        secondCard = null;
        lockBoard = false;
    }

    // --- End Match Logic & Scoring ---
    function endMatchRound() {
        clearInterval(timerInterval);

        const domainKey = domainSelect.value;
        const scoreKey = `${domainKey}:${targetPairs}`;
        
        // Calculate accuracy
        // Optimal score would be perfect targets (e.g. 10 moves for 10 pairs = 100% accuracy)
        const accuracy = Math.round((targetPairs / movesCount) * 100);

        // Check against Local High Scores
        let isNewRecord = false;
        const record = bestScores[scoreKey];
        
        if (!record) {
            isNewRecord = true;
        } else {
            // Primary sort: Fewest Moves. Secondary sort: Quickest elapsed time
            if (movesCount < record.moves) {
                isNewRecord = true;
            } else if (movesCount === record.moves && secondsElapsed < record.time) {
                isNewRecord = true;
            }
        }

        if (isNewRecord) {
            bestScores[scoreKey] = {
                moves: movesCount,
                time: secondsElapsed
            };
            localStorage.setItem('isc2_cc_best_scores', JSON.stringify(bestScores));
            newBestAlert.classList.remove('hidden');
        } else {
            newBestAlert.classList.add('hidden');
        }

        // Display results UI page
        resultTime.textContent = formatTime(secondsElapsed);
        resultMoves.textContent = movesCount;
        resultAccuracy.textContent = `${accuracy}%`;

        matchSection.classList.add('hidden');
        matchResultsSection.classList.remove('hidden');
    }

    // --- Button Actions & Navigation ---
    resetProgressBtn.addEventListener('click', resetAllProgress);
    
    // Study navigation triggers
    flashcard.addEventListener('click', flipStudyCard);
    revealBtn.addEventListener('click', flipStudyCard);
    nextBtn.addEventListener('click', goToNextCard);
    prevBtn.addEventListener('click', goToPrevCard);
    
    knewBtn.addEventListener('click', () => handleStudyCardState('known'));
    reviewBtn.addEventListener('click', () => handleStudyCardState('review'));

    // Global back-to-setup buttons
    document.querySelectorAll('.back-btn-action').forEach(btn => {
        btn.addEventListener('click', () => {
            clearInterval(timerInterval);
            studySection.classList.add('hidden');
            matchSection.classList.add('hidden');
            matchResultsSection.classList.add('hidden');
            globalStatsHeader.classList.remove('hidden');
            setupSection.classList.remove('hidden');
        });
    });

    // Match Action Controls
    playAgainBtn.addEventListener('click', () => {
        startMatchSession(allCards.filter(card => domainSelect.value === 'all' || card.domainName === domainSelect.value), domainSelect.value);
    });

    changeSetupBtn.addEventListener('click', () => {
        matchResultsSection.classList.add('hidden');
        setupSection.classList.remove('hidden');
        globalStatsHeader.classList.remove('hidden');
    });

    // "Study These Terms" button
    studyMatchedBtn.addEventListener('click', () => {
        // Carry over the exact flashcards selected during the match game directly into study mode!
        if (matchDeck && matchDeck.length > 0) {
            startStudySession(matchDeck);
        }
    });

    // --- Global Accessibility Handlers ---
    // Keyboard Event Listener for Study Cards
    flashcard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flipStudyCard();
        }
    });

    // Global Swipe navigation hotkeys
    document.addEventListener('keydown', (e) => {
        if (!studySection.classList.contains('hidden')) {
            if (e.key === 'ArrowRight') goToNextCard();
            if (e.key === 'ArrowLeft') goToPrevCard();
        }
    });
});