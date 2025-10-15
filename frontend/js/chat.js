/**
 * Chat.js - Course Cupid Chat Interface
 * Handles chat UI, message display, and navigation for both paper
 * */

(() => {
  const sidebar = document.getElementById('sidebar');
  const matchList = document.getElementById('matchList');
  const cupidChatList = document.getElementById('cupidChatList');
  const matchCount = document.getElementById('match-count');
  const placeholder = document.getElementById('placeholder');
  const chatPanel = document.getElementById('chatPanel');
  const chatWindow = document.getElementById('chatWindow');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const paperTitleEl = document.getElementById('paperTitle');
  const paperAvatarEl = document.getElementById('paperAvatar');
  const sessionIdEl = document.getElementById('current-session-id');

  let currentPaper = null; // Currently open paper code (e.g., "COMP161")
  let currentSessionId = null;  // Currently open Cupid session UUID
  let currentChatType = null;  // Either 'paper' or 'cupid'

  /**
   * Extract identifier from URL path and determine if it's a paper code or Cupid session
   * URL format: /chat/:identifier where identifier is either paper code or session UUID
   * @returns {Object} { id: string|null, type: 'paper'|'cupid'|null }
   */  
  function getPaperIdFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'chat') {
      const id = decodeURIComponent(parts[1]);
      // Paper codes follow format: 4 letters + 3 numbers (e.g., COMP161)
      const isPaper = /^[A-Z]{4}\d{3}$/i.test(id);
      return { id, type: isPaper ? 'paper' : 'cupid' };
    }
    // No identifier in URL - user is on base /chat page
    return { id: null, type: null };
  }

  /**
   * Updates browser URL for paper chat navigation
   * @param {string} paperCode - Paper code to set in URL
   * @param {boolean} push - Whether to add new history entry (true) or replace current (false)
   */
  function setURLForPaper(paperCode, push = true) {
    const url = `/chat/${encodeURIComponent(paperCode)}`;
    if (push) history.pushState({ paper: paperCode }, '', url);
  }

  /**
   * Escapes HTML special characters to prevent XSS
   * @param {string} s - String to escape
   * @returns {string} HTML-safe string
   */
  function escHtml(s) { 
    return (s||'').toString().replace(/[&<>"]/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
    }[c])); 
  }

  /**
   * Creates a clickable card element for a paper match in the sidebar
   * @param {Object} m - Match data object with paper_code, title, description, etc.
   * @returns {HTMLElement} Button element representing the match card
   */
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

    // Paper metadata (title and preview)
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

    // Click handler - opens paper chat and updates URL
    a.addEventListener('click', () => {
      openChat(m.paper_code, m);
      setURLForPaper(m.paper_code, true);
    });

    return a;
  }

  /**
   * Creates a clickable card element for a Cupid chat session in the sidebar
   * @param {Object} session - Session data object with session_id, title, created_at, etc.
   * @returns {HTMLElement} Button element representing the chat card
   */
  function makeCupidChatCard(session) {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'w-full text-left p-3 rounded-lg match-card hover-lift flex gap-3 items-start';
    a.style.display = 'flex';
    a.style.alignItems = 'center';

    // Cupid heart avatar
    const avatar = document.createElement('div');
    avatar.className = 'w-12 h-12 rounded-md flex items-center justify-center text-white font-semibold';
    avatar.style.background = session.color || '#DA9F93';
    avatar.textContent = '💘';

    // Session metadata (title and date)
    const meta = document.createElement('div');
    meta.className = 'flex-1';

    const title = document.createElement('div');
    title.className = 'font-medium text-sm text-cupidPink';
    title.textContent = session.title || `Chat ${session.session_id.slice(0, 8)}...`;

    const preview = document.createElement('div');
    preview.className = 'text-xs text-gray-500 mt-1 truncate';
    const date = session.created_at ? new Date(session.created_at).toLocaleDateString() : '';
    preview.textContent = session.lastMessage || `Created ${date}`;

    meta.appendChild(title);
    meta.appendChild(preview);
    a.appendChild(avatar);
    a.appendChild(meta);

    // Click handler - opens Cupid chat and updates URL
    a.addEventListener('click', () => {
      openCupidChat(session);
      // Update URL for session
      const url = `/chat/${encodeURIComponent(session.session_id)}`;
      history.pushState({ session: session.session_id }, '', url);
    });

    return a;
  }

  /**
   * Fetches and displays user's paper matches in the sidebar
   * @param {string} selectedPaper - Optional paper code to auto-select after loading
   */
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
        // Normalize fields from various possible API response formats
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

        // Auto-select paper if specified (used for navigation/reload)
        if (selectedPaper && cardData.paper_code === selectedPaper) {
          setTimeout(() => el.click(), 80); // Small delay for layout
        }
      });
    } catch (err) {
      console.error(err);
      matchList.innerHTML = '<div class="text-sm text-red-500 p-3">Could not load matches.</div>';
      matchCount.textContent = '0 matches';
    }
  }

  /**
   * Fetches and displays Cupid chat sessions in the sidebar
   * Shows all sessions for logged-in users, or only current session for anonymous users
   */  
  async function loadCupidChats() {
    cupidChatList.innerHTML = '';

    try {
      const { id, type } = getPaperIdFromPath();

      // Only pass session ID to backend if we're currently viewing a Cupid chat
      // This allows anonymous users to see their current session in the sidebar
      const url = (id && type === 'cupid')
      ? `/api/chat-sessions?currentSessionId=${encodeURIComponent(id)}`
      : '/api/chat-sessions';

      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load chat sessions');
      const sessions = await res.json();

      if (!Array.isArray(sessions) || sessions.length === 0) {
        cupidChatList.innerHTML = '<div class="text-sm text-gray-500 p-3">No Cupid chats yet. Create one below!</div>';
        return;
      }

      // Render each session as a clickable card
      sessions.forEach(session => {
        const el = makeCupidChatCard(session);
        cupidChatList.appendChild(el);
      });
    } catch (err) {
      console.error(err);
      cupidChatList.innerHTML = '<div class="text-sm text-red-500 p-3">Could not load Cupid chats.</div>';
    }
  }

  /**
   * Appends a message bubble to the chat window
   * @param {string} sender - Either 'user' or 'ai'
   * @param {string} text - Message content
   * @param {string} ts - ISO timestamp string
   */  
  function appendMessage(sender, text, ts) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'bubble-user self-end' : 'bubble-ai self-start';
    
    div.innerHTML = `<div>${escHtml(text)}</div><div class="text-xs text-gray-400 mt-1">${ts ? new Date(ts).toLocaleString() : ''}</div>`;
    chatWindow.appendChild(div);

    // Auto-scroll to bottom to show new message
    chatWindow.scrollTop = chatWindow.scrollHeight + 100;
  }

  /**
   * Fetches and displays message history for a chat (paper or Cupid session)
   * @param {string} identifier - Paper code or session UUID
   */  
  async function loadMessages(paperCode) {
    chatWindow.innerHTML = '<div class="text-sm text-gray-400">Loading messages…</div>';
    try {
      // Try multiple endpoints for compatibility with different API versions
      const urlsToTry = [
        `/api/chat/${encodeURIComponent(paperCode)}/messages`,
        `/api/chat/${encodeURIComponent(paperCode)}/history`      
      ];

      let data = null;
      for (const u of urlsToTry) {
        const r = await fetch(u, { credentials: 'same-origin' });
        if (!r.ok) continue;

        data = await r.json();
        if (data) {
          // Handle different response formats: raw array, {history: []}, or {messages: []}
          if (Array.isArray(data)) { data = data; break; }
          if (Array.isArray(data.history)) { data = data.history; break; }
          if (Array.isArray(data.messages)) { data = data.messages; break; }
        }
      }
      if (!data || !Array.isArray(data) || data.length === 0) {
        chatWindow.innerHTML = '<div class="text-sm text-gray-500">No conversation yet — say hi!</div>';
        return;
      }

      // Display all messages
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

  /**
   * Opens a paper chat and loads its message history
   * @param {string} paperCode - Paper code (e.g., "COMP161")
   * @param {Object} meta - Optional metadata (title, avatar, color, etc.)
   */
  async function openChat(paperCode, meta = {}) {
    // Update state
    currentPaper = paperCode;
    currentChatType = 'paper';
    currentSessionId = null; 

    // Update UI
    placeholder.classList.add('hidden');
    chatPanel.classList.remove('hidden');

    paperTitleEl.textContent = `${paperCode}${meta.title ? ' — ' + meta.title : ''}`;
    paperAvatarEl.textContent = meta.avatar || (paperCode.slice(0,2) || '📚');
    paperAvatarEl.style.background = meta.color || '#C05A66';
    sessionIdEl.textContent = ''; // optional: fill when session created

    // Load message history
    await loadMessages(paperCode);

    // If no messages exist, request an opening message from AI
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

  /**
   * Opens a Cupid chat session and loads its message history
   * @param {Object} session - Session object with session_id, title, etc.
   */
  async function openCupidChat(session) {
    // Update state
    currentSessionId = session.session_id;
    currentPaper = null;
    currentChatType = 'cupid';
    
    // Update UI
    placeholder.classList.add('hidden');
    chatPanel.classList.remove('hidden');

    sessionIdEl.textContent = currentSessionId;
    paperAvatarEl.textContent = '💘';
    paperAvatarEl.style.background = '#DA9F93';

    const displayName = session.title || ('Chat ' + session.session_id.slice(0, 8));
    paperTitleEl.textContent = displayName;

    // Load message history
    await loadMessages(session.session_id);
  }

  /**
   * Sends a user message and receives AI reply
   * Works for both paper chats and Cupid sessions
   * @param {string} messageText - User's message content
   */
  async function sendMessage(messageText) {
    const identifier = currentPaper || currentSessionId;
    if (!identifier) return;

    // Display user message immediately
    appendMessage('user', messageText, new Date().toISOString());
    chatInput.value = '';
    chatInput.focus();

    try {
      const r = await fetch(`/api/chat/${encodeURIComponent(identifier)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });

      if (!r.ok) throw new Error('Chat reply failed');

      const data = await r.json();

      // Handle different response formats
      const reply = data.reply || data.ai || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '(no reply)';
      appendMessage('ai', reply, new Date().toISOString());
    } catch (err) {
      console.error('sendMessage error', err);
      appendMessage('ai', '⚠️ Could not reach AI. Try again later.', new Date().toISOString());
    }
  }

  /**
   * Enables inline editing of Cupid chat titles
   * Click on title → input field → Enter/blur to save, Escape to cancel
   */
  paperTitleEl.addEventListener('click', () => {
    // Only allow renaming for Cupid chats with a valid session ID
    if (currentChatType !== 'cupid' || !currentSessionId) return;

    const oldTitle = paperTitleEl.textContent;

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldTitle;
    input.className = 'border border-cupidPink/30 rounded px-2 py-1 text-sm text-cupidPink font-medium focus:outline-none focus:ring-2 focus:ring-cupidPink/30';
    input.style.width = '80%';

    paperTitleEl.replaceWith(input);
    input.focus();


    /**
     * Saves the new title to backend and updates UI
     */
    async function save() {
      const newTitle = input.value.trim();

      // No change - restore original title
      if (!newTitle || newTitle === oldTitle) {
        input.replaceWith(paperTitleEl);
        paperTitleEl.textContent = oldTitle;
        return;
      }

      try {
        const res = await fetch(`/api/chat-sessions/${encodeURIComponent(currentSessionId)}/title`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ title: newTitle })
        });

        if (!res.ok) throw new Error('Failed to update title');

        // Update chat header with new title
        input.replaceWith(paperTitleEl);
        paperTitleEl.textContent = newTitle;

        // Update sidebar card title (more efficient than reloading entire sidebar)
        const sidebarCards = cupidChatList.querySelectorAll('.match-card');
        sidebarCards.forEach(card => {
          const titleEl = card.querySelector('.font-medium.text-sm.text-cupidPink');
          // Match by session ID prefix in default title
          if (titleEl && titleEl.textContent.includes(currentSessionId.slice(0, 8))) {
            titleEl.textContent = newTitle;
          }
        });

      } catch (err) {
        console.error(err);
        alert('⚠️ Could not update title. Try again later.');
        input.replaceWith(paperTitleEl);
        paperTitleEl.textContent = oldTitle;
      }
    }

    // Save on blur (click away) or Enter key
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        // Cancel editing - restore original title
        input.replaceWith(paperTitleEl);
        paperTitleEl.textContent = oldTitle;
      }
    });
  });

  /**
   * Handle form submission - send message when user presses Enter or clicks send
   */  
  chatForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const txt = chatInput.value && chatInput.value.trim();
    if (!txt) return;
    sendMessage(txt);
  });

  /**
   * Handle browser back/forward navigation
   * Reopens the appropriate chat based on URL
   */
  window.addEventListener('popstate', async (ev) => {
    
    const { id, type } = getPaperIdFromPath();

    // No chat in URL - show empty placeholder
    if (!id) {
      currentPaper = null;
      currentSessionId = null;
      currentChatType = null;
      chatPanel.classList.add('hidden');
      placeholder.classList.remove('hidden');
      return;
    }

    // Route to appropriate chat type
    if (type === 'paper') {
      await loadMatches(id); // Reload and auto-select paper
    } else {
      await loadCupidChats(); 
      try {
        const res = await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`, { 
          credentials: 'same-origin' 
        });
        
        if (res.ok) {
          const session = await res.json();
          openCupidChat(session);
        }
      } catch (err) {
        console.error('popstate openCupidChat failed', err);
      }
    }
  });

  /**
   * Initialize the chat interface on page load
   * Loads sidebars and opens chat if URL contains an identifier
   */
  (async function init() {
    const { id, type } = getPaperIdFromPath();

    // Always load both sidebars to show available matches and Cupid chats
    await loadMatches();
    await loadCupidChats();

    // If URL has an identifier, open the corresponding chat
    if (type === 'paper') {
      openChat(id, {});
    } else if (type === 'cupid' && id){
      // Fetch Cupid session data from backend to restore chat on page reload
      try {
        const res = await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
        if (res.ok) {
          const session = await res.json();
          openCupidChat(session);
        }
      } catch (err) {
        console.error('Could not open Cupid chat on reload', err);
      }
    }

  })();

})();