document.getElementById('quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const answers = [
        form.querySelector('input[name="q1"]:checked')?.value,
        form.querySelector('input[name="q2"]:checked')?.value,
        form.querySelector('input[name="q3"]:checked')?.value,
        form.querySelector('input[name="q4"]:checked')?.value,
        form.querySelector('input[name="q5"]:checked')?.value,
        form.querySelector('input[name="q6"]:checked')?.value,
        form.querySelector('input[name="q7"]:checked')?.value,
        form.querySelector('input[name="q8"]:checked')?.value,
        form.querySelector('input[name="q9"]:checked')?.value,
        form.querySelector('input[name="q10"]:checked')?.value,
        form.querySelector('textarea[name="q11"]')?.value.trim()
    ];

    document.getElementById('quizForm').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');

    try {
        const response = await fetch('/api/quiz-recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answers }),
        });

        const data = await response.json();
        document.getElementById('loading').classList.add('hidden');

        if (data.recommendedCourses && data.recommendedCourses.length > 0) {
            const cardContainer = document.getElementById('cardContainer');
            data.recommendedCourses.forEach((course, index) => {
                const card = createCardElement(course, index);
                cardContainer.appendChild(card);
            });
            cardContainer.classList.remove('hidden');

            updateCardButtons(cardContainer.querySelector('.card:first-child'));

        }else{
            document.getElementById('noMoreCards').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('quizForm').classList.remove('hidden');
    }
});

function createCardElement(course, index) {
    const card = document.createElement('div');
    card.className = `absolute w-full h-full bg-white p-6 rounded-lg shadow-md transition-all duration-300 card ${index > 0 ? 'hidden' : ''}`;
    const similarityScore = (course.similarity *100).toFixed(2);
    card.innerHTML = `
            <div class="h-full flex flex-col justify-between">
            <div>
                <h3 class="font-semibold text-lg text-cupidPink">${course.code} - ${course.name}</h3>
                <p class="text-sm text-gray-600 mt-2">${course.description}</p>
                <p class="mt-4 text-sm text-gray-800 font-medium">Similarity: ${similarityScore}%</p>
            </div>
            <div class="flex justify-between items-center mt-4 space-x-4">
                <button class="bg-red-500 text-white rounded-full p-3 shadow-md dislike-btn" aria-label="Dislike">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <button class="bg-green-500 text-white rounded-full p-3 shadow-md like-btn" aria-label="Like">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    return card;
}

async function handleSwipe(action, card) {
    card.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';
    card.style.transform = action === 'like' ? 'translateX(100%) rotate(20deg)' : 'translateX(-100%) rotate(-20deg)';
    card.style.opacity = '0';

    // NEW: record a match if action = like
    if (action === 'like') {
        const courseCode = card.querySelector('h3').textContent.split(" - ")[0];
        try {
            await fetch('/api/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paper_code: courseCode })
            });
        } catch (err) {
            console.error('Failed to save match:', err);
        }
    }

    setTimeout(() => {
        card.remove();
        showNextCard();
    }, 500);
}

function showNextCard() {
    const cardContainer = document.getElementById('cardContainer');
    const remainingCards = cardContainer.querySelectorAll('.card');
    if (remainingCards.length > 0) {
        const nextCard = remainingCards[0];
        nextCard.classList.remove('hidden');
        updateCardButtons(nextCard);
    } else {
        cardContainer.classList.add('hidden');
        document.getElementById('noMoreCards').classList.remove('hidden');
    }
}

function updateCardButtons(card) {
    const dislikeBtn = card.querySelector('.dislike-btn');
    const likeBtn = card.querySelector('.like-btn');

    if(dislikeBtn){
        dislikeBtn.onclick = () => handleSwipe('dislike', card);
    }
    if(likeBtn){
        likeBtn.onclick = () => handleSwipe('like', card);
    }
}