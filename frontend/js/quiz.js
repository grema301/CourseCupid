document.getElementById('quizForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const answers = [
        form.querySelector('input[name="q1"]:checked')?.value,
        form.querySelector('input[name="q2"]:checked')?.value,
        form.querySelector('input[name="q3"]:checked')?.value
    ];

    try {
        const response = await fetch('/api/quiz-recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answers }),
        });

        const data = await response.json();
        const courseList = document.getElementById('courseList');
        courseList.innerHTML = '';

        if (data.recommendedCourses && data.recommendedCourses.length > 0) {
            data.recommendedCourses.forEach(course => {
                const li = document.createElement('li');
                li.className = 'p-4 bg-gray-100 rounded-lg';
                const similarityScore = (course.similarity * 100).toFixed(2);
                li.innerHTML = `
                    <h3 class="font-semibold text-lg">${course.code} - ${course.name}</h3>
                    <p class="text-sm text-gray-600">${course.description}</p>
                    <p class="mt-2 text-sm text-gray-800 font-medium">Similarity: ${similarityScore}%</p>
                `;
                courseList.appendChild(li);
            });
            document.getElementById('results').classList.remove('hidden');
        } else {
            courseList.innerHTML = '<p class="text-red-500">No recommendations found. Please try again.</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }
});