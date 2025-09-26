/**Chat.js */

(() => {
  const sidebar = document.getElementById('sidebar');
  const matchList = document.getElementById('matchList');
  const matchCount = document.getElementById('match-count');
  const placeholder = document.getElementById('placeholder');
  const chatPanel = document.getElementById('chatPanel');
  const chatWindow = document.getElementById('chatWindow');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const paperTitleEl = document.getElementById('paperTitle');
  const paperAvatarEl = document.getElementById('paperAvatar');
  const sessionIdEl = document.getElementById('current-session-id');

  let currentPaper = null;

  // Utility: get paperId from path if present (supports /chat and /chat/:paper)
  function getPaperIdFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // parts e.g. ['chat', 'COMP161'] or ['chat']
    if (parts.length >= 2 && parts[0] === 'chat') {
      return decodeURIComponent(parts[1] || '').replace(/^:/, '');
    }
    return null;
  }

  function setURLForPaper(paperCode, push = true) {
    const url = `/chat/${encodeURIComponent(paperCode)}`;
    if (push) history.pushState({ paper: paperCode }, '', url);
  }

  function escHtml(s) { return (s||'').toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // Render single match card in sidebar
  function makeMatchCard(m) {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'w-full text-left p-3 rounded-lg match-card hover-lift flex gap-3 items-start';
    a.style.display = 'flex';
    a.style.alignItems = 'center';

    const avatar = document.createElement('div');
    avatar.className = 'w-12 h-12 rounded-md flex items-center justify-center text-white font-semibold';
    avatar.style.background = m.color || '#C05A66';
    avatar.textContent = m.avatar || (m.paper_code ? m.paper_code.slice(0,2) : '📚');

    const meta = document.createElement('div');
    meta.className = 'flex-1';

    const title = document.createElement('div');
    title.className = 'font-medium text-sm text-cupidPink';
    title.textContent = `${m.paper_code} — ${m.title || ''}`;

    const preview = document.createElement('div');
    preview.className = 'text-xs text-gray-500 mt-1 truncate';
    preview.textContent = m.lastMessage || (m.description ? m.description.slice(0,80) : '');

    meta.appendChild(title);
    meta.appendChild(preview);

    a.appendChild(avatar);
    a.appendChild(meta);

    // on click open chat
    a.addEventListener('click', () => {
      openChat(m.paper_code, m);
      setURLForPaper(m.paper_code, true);
    });

    return a;
  }

  // Populate sidebar with matches
  async function loadMatches(selectedPaper) {
    matchList.innerHTML = '';
    matchCount.textContent = 'Loading...';
    try {
      const res = await fetch('/api/my-matches', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load matches');
      const matches = await res.json();

      if (!Array.isArray(matches) || matches.length === 0) {
        matchList.innerHTML = '<div class="text-sm text-gray-500 p-3">You have no matches yet. Swipe to add papers.</div>';
        matchCount.textContent = '0 matches';
        return;
      }

      matchCount.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;
      matches.forEach(m => {
        // normalize fields
        const cardData = {
          paper_code: (m.paper_code || m.id || m.code || '').toString().toUpperCase(),
          title: m.title || m.name || m.label || '',
          avatar: m.avatar || m.icon || '',
          description: m.description || m.summary || '',
          color: m.color || '#C05A66',
          lastMessage: m.lastMessage || m.preview || ''
        };
        const el = makeMatchCard(cardData);
        matchList.appendChild(el);

        // If a selectedPaper passed, open it after matches are rendered
        if (selectedPaper && cardData.paper_code === selectedPaper) {
          // small delay to ensure scroll and layout
          setTimeout(() => el.click(), 80);
        }
      });
    } catch (err) {
      console.error(err);
      matchList.innerHTML = '<div class="text-sm text-red-500 p-3">Could not load matches.</div>';
      matchCount.textContent = '0 matches';
    }
  }

  // Render single message bubble
  function appendMessage(sender, text, ts) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'bubble-user self-end' : 'bubble-ai self-start';
    div.innerHTML = `<div>${escHtml(text)}</div><div class="text-xs text-gray-400 mt-1">${ts ? new Date(ts).toLocaleString() : ''}</div>`;
    // note: chatWindow is a flex column
    chatWindow.appendChild(div);
    // scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight + 100;
  }

  // Load message history for paper
  async function loadMessages(paperCode) {
    chatWindow.innerHTML = '<div class="text-sm text-gray-400">Loading messages…</div>';
    try {
      // prefer /api/chat/:paperId/messages then fallback to /api/chat/:paperId/history
      const urlsToTry = [
        `/api/chat/${encodeURIComponent(paperCode)}/messages`,
        `/api/chat/${encodeURIComponent(paperCode)}/history`,
        `/api/chat/${encodeURIComponent(paperCode)}/messages` // repeat safe
      ];
      let data = null;
      for (const u of urlsToTry) {
        const r = await fetch(u, { credentials: 'same-origin' });
        if (!r.ok) continue;
        data = await r.json();
        if (data) {
          // If the API returns { history: [...] } or raw array
          if (Array.isArray(data)) { data = data; break; }
          if (Array.isArray(data.history)) { data = data.history; break; }
          if (Array.isArray(data.messages)) { data = data.messages; break; }
        }
      }
      if (!data || !Array.isArray(data) || data.length === 0) {
        chatWindow.innerHTML = '<div class="text-sm text-gray-500">No conversation yet — say hi!</div>';
        return;
      }
      chatWindow.innerHTML = '';
      data.forEach(m => {
        const sender = (m.sender === 'user' || m.is_user) ? 'user' : 'ai';
        appendMessage(sender, m.content || m.text || m.message || m.reply || '', m.created_at || m.ts || m.ts_created || m.timestamp);
      });
    } catch (err) {
      console.error('loadMessages error', err);
      chatWindow.innerHTML = '<div class="text-sm text-red-500">Error loading messages.</div>';
    }
  }

  // Open chat UI for a paper (paperCode, optional meta)
  async function openChat(paperCode, meta = {}) {
    currentPaper = paperCode;
    // set UI
    placeholder.classList.add('hidden');
    chatPanel.classList.remove('hidden');
    paperTitleEl.textContent = `${paperCode}${meta.title ? ' — ' + meta.title : ''}`;
    paperAvatarEl.textContent = meta.avatar || (paperCode.slice(0,2) || '📚');
    paperAvatarEl.style.background = meta.color || '#C05A66';
    sessionIdEl.textContent = ''; // optional: fill when session created

    // Load message history
    await loadMessages(paperCode);

    // optionally trigger first message if no history
    // we attempt to get an opener if chatWindow shows 'No conversation yet'
    if (!chatWindow.querySelector('.bubble-user') && !chatWindow.querySelector('.bubble-ai')) {
      try {
        const r = await fetch(`/api/chat/${encodeURIComponent(paperCode)}/first`, {
          method: 'POST', credentials: 'same-origin'
        });
        if (r.ok) {
          const j = await r.json();
          if (j.reply) appendMessage('ai', j.reply, new Date().toISOString());
        }
      } catch (e) {
        // ignore if not supported by backend
        console.debug('No opener endpoint or failed to fetch opener', e);
      }
    }
  }

  // Send message flow: append user message, send to backend, append ai reply
  async function sendMessage(messageText) {
    if (!currentPaper) return;
    appendMessage('user', messageText, new Date().toISOString());
    chatInput.value = '';
    chatInput.focus();

    try {
      const r = await fetch(`/api/chat/${encodeURIComponent(currentPaper)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
      if (!r.ok) throw new Error('Chat reply failed');
      const data = await r.json();
      const reply = data.reply || data.ai || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '(no reply)';
      appendMessage('ai', reply, new Date().toISOString());
    } catch (err) {
      console.error('sendMessage error', err);
      appendMessage('ai', '⚠️ Could not reach AI. Try again later.', new Date().toISOString());
    }
  }

  // Form submit
  chatForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const txt = chatInput.value && chatInput.value.trim();
    if (!txt) return;
    sendMessage(txt);
  });

  // Listen to back/forward navigation to reopen correct chat
  window.addEventListener('popstate', (ev) => {
    const p = getPaperIdFromPath();
    if (p) {
      loadMatches(p);
    } else {
      // go home view
      currentPaper = null;
      chatPanel.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }
  });

  // INIT
  (async function init() {
    const initialPaper = getPaperIdFromPath();
    await loadMatches(initialPaper);
    // If initialPaper didn't auto open via loadMatches (e.g., no match), try to open directly if it exists
    if (initialPaper && !currentPaper) {
      // attempt to open even if not matched (useful for dev/testing)
      openChat(initialPaper, {});
      setURLForPaper(initialPaper, false);
    }
  })();

})();