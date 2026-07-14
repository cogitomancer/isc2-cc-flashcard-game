document.addEventListener("DOMContentLoaded", () => {
    // --- State Variables ---
    let allCards = [];
    let activeDeck = [];
    let currentIndex = 0;
    
    // Progress tracking objects
    let progress = {
        knownIds: [],
        reviewIds: []
    };

    // --- DOM Elements ---
    const setupSection = document.getElementById('setup-section');
    const studySection = document.getElementById('study-section');
    const domainSelect = document.getElementById('domain-select');
    const errorMsg = document.getElementById('error-message');
    
    // Card Elements
    const flashcard = document.getElementById('flashcard');
    const termEl = document.getElementById('card-term');
    const defEl = document.getElementById('card-definition');
    const domainFrontEl = document.getElementById('card-domain-front');
    const domainBackEl = document.getElementById('card-domain-back');
    const extrasEl = document.getElementById('card-extras');
    
    // Stats Elements
    const cardCounterEl = document.getElementById('card-counter');
    const knownCountEl = document.getElementById('known-count');
    const reviewCountEl = document.getElementById('review-count');

    // Buttons
    const startBtn = document.getElementById('start-btn');
    const resetProgressBtn = document.getElementById('reset-progress-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const revealBtn = document.getElementById('reveal-btn');
    const knewBtn = document.getElementById('knew-btn');
    const reviewBtn = document.getElementById('review-btn');
    const backBtn = document.getElementById('back-to-setup-btn');

    // --- Initialization ---
    init();

    async function init() {
        loadProgress();
        try {
            const response = await fetch('flashcards.json');
            if (!response.ok) throw new Error('Network response was not ok');
            
            allCards = await response.json();
            populateDomains(allCards);
            updateStatsUI();
        } catch (error) {
            console.error('Failed to load flashcards:', error);
            showError("Could not load flashcards.json. Please ensure you are running this on a local server and the file exists.");
        }
    }

    // --- Setup & Utilities ---
    function populateDomains(cards) {
        const domains = new Set();
        cards.forEach(card => {
            if (card.domainName) {
                domains.add(card.domainName);
            }
        });

        // Convert Set to Array and sort alphabetically
        Array.from(domains).sort().forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainSelect.appendChild(option);
        });
    }

    function shuffleArray(array) {
        let shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }

    // --- Local Storage Management ---
    function loadProgress() {
        const saved = localStorage.getItem('isc2_cc_progress');
        if (saved) {
            try {
                progress = JSON.parse(saved);
            } catch (e) {
                console.error("Error parsing localStorage data", e);
            }
        }
    }

    function saveProgress() {
        localStorage.setItem('isc2_cc_progress', JSON.stringify(progress));
        updateStatsUI();
    }

    function resetProgress() {
        if(confirm("Are you sure you want to reset all study stats?")) {
            progress = { knownIds: [], reviewIds: [] };
            saveProgress();
            alert("Progress reset successfully.");
        }
    }

    function updateStatsUI() {
        knownCountEl.textContent = progress.knownIds.length;
        reviewCountEl.textContent = progress.reviewIds.length;
        
        if (activeDeck.length > 0) {
            cardCounterEl.textContent = `${currentIndex + 1} / ${activeDeck.length}`;
        } else {
            cardCounterEl.textContent = "0 / 0";
        }
    }

    // --- Study Logic ---
    function startStudySession() {
        const selectedDomain = domainSelect.value;
        
        if (selectedDomain === 'all') {
            activeDeck = [...allCards];
        } else {
            activeDeck = allCards.filter(card => card.domainName === selectedDomain);
        }

        if (activeDeck.length === 0) {
            showError("No cards found for the selected criteria.");
            return;
        }

        activeDeck = shuffleArray(activeDeck);
        currentIndex = 0;
        
        setupSection.classList.add('hidden');
        studySection.classList.remove('hidden');
        errorMsg.classList.add('hidden');

        renderCard();
    }

    function renderCard() {
        if (activeDeck.length === 0) return;
        
        // Ensure card is showing front
        flashcard.classList.remove('is-flipped');
        
        const card = activeDeck[currentIndex];
        
        // Populate Data safely
        termEl.textContent = card.term || "Unknown Term";
        defEl.textContent = card.definition || "No definition provided.";
        domainFrontEl.textContent = card.domainName || "Domain Unknown";
        domainBackEl.textContent = card.domainName || "Domain Unknown";

        // Handle optional fields
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

        updateStatsUI();
    }

    function flipCard() {
        flashcard.classList.toggle('is-flipped');
    }

    function goToNextCard() {
        if (currentIndex < activeDeck.length - 1) {
            currentIndex++;
            renderCard();
        } else {
            alert("You've reached the end of the deck!");
        }
    }

    function goToPrevCard() {
        if (currentIndex > 0) {
            currentIndex--;
            renderCard();
        }
    }

    function handleCardInteraction(status) {
        const currentCardId = activeDeck[currentIndex].id;
        
        // Remove from both lists to prevent duplicates if user changes mind
        progress.knownIds = progress.knownIds.filter(id => id !== currentCardId);
        progress.reviewIds = progress.reviewIds.filter(id => id !== currentCardId);

        // Add to selected list
        if (status === 'known') {
            progress.knownIds.push(currentCardId);
        } else if (status === 'review') {
            progress.reviewIds.push(currentCardId);
        }

        saveProgress();
        goToNextCard();
    }

    // --- Event Listeners ---
    startBtn.addEventListener('click', startStudySession);
    resetProgressBtn.addEventListener('click', resetProgress);
    backBtn.addEventListener('click', () => {
        studySection.classList.add('hidden');
        setupSection.classList.remove('hidden');
        flashcard.classList.remove('is-flipped');
        activeDeck = [];
        updateStatsUI();
    });

    flashcard.addEventListener('click', flipCard);
    revealBtn.addEventListener('click', flipCard);
    nextBtn.addEventListener('click', goToNextCard);
    prevBtn.addEventListener('click', goToPrevCard);
    
    knewBtn.addEventListener('click', () => handleCardInteraction('known'));
    reviewBtn.addEventListener('click', () => handleCardInteraction('review'));

    // Keyboard Accessibility
    flashcard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flipCard();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!studySection.classList.contains('hidden')) {
            if (e.key === 'ArrowRight') goToNextCard();
            if (e.key === 'ArrowLeft') goToPrevCard();
        }
    });
});
