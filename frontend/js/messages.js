document.addEventListener('DOMContentLoaded', async () => {
  const matchList = document.getElementById('matchList');

  try {
    const res = await fetch('/api/my-matches');
    const matches = await res.json();

    if (matches.length === 0) {
      matchList.innerHTML = `<p class="empty">No matches yet. Swipe right on some papers!</p>`;
      return;
    }

    matches.forEach(m => {
      const el = document.createElement('a');
      el.className = 'cc-item';
      el.href = `/chat/${m.paper_code}`;
      el.textContent = `${m.paper_code}`;
      matchList.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load matches:', err);
    matchList.innerHTML = `<p class="error">Could not load matches.</p>`;
  }
});
