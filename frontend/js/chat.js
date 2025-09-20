/**Chat.js */

// helpers
function $(id){ return document.getElementById(id); }
const chatWindow = $("chatWindow");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const paperTitle = $("paperTitle");
const paperCode = $("paperCode");
const paperAvatar = $("paperAvatar");
const miniList = $("miniList");

// current paperId from URL
const parts = window.location.pathname.split("/");
const paperId = decodeURIComponent(parts[parts.length-1] || "");

// render a message
function addBubble(sender, text){
  const div = document.createElement("div");
  div.className = "bubble " + (sender === "user" ? "user" : "ai");
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function preloadSidebar(){
  // small list to jump between chats
  const res = await fetch("/api/matches");
  const data = await res.json();
  miniList.innerHTML = "";
  data.matches.forEach(m=>{
    const a = document.createElement("a");
    a.className = "item";
    a.href = `/chat/${m.id}`;
    a.innerHTML = `
      <div class="avatar" style="background: radial-gradient(60% 60% at 30% 30%, #FF7A8A, ${m.color});">${m.avatar || "📚"}</div>
      <div class="info">
        <div class="name">${m.id}</div>
        <div class="preview">${m.lastMessage || ""}</div>
      </div>
    `;
    miniList.appendChild(a);
    if (m.id === paperId){
      paperCode.textContent = m.id;
      paperTitle.textContent = m.title;
      paperAvatar.textContent = m.avatar || "📚";
      paperAvatar.style.background = `radial-gradient(60% 60% at 30% 30%, #FF7A8A, ${m.color})`;
      $("chatHeader").style.background = `linear-gradient(90deg, ${m.color}33, #0000)`;
    }
  });
}



/**load and display all chat sessions in the sidebar */
async function loadChatSessions() {
  try {
    const currentSessionId = paperId;//RETRIEVES FROM URL SO SAME BUT NOT A GOOD NAME
    const response = await fetch(`/api/chat-sessions/${currentSessionId}`);
    
    const data = await response.json();
    const miniList = document.getElementById('miniList');
    
    if (data.success && data.sessions) {
      displaySessionsInSidebar(data.sessions);//in app.js
    } else {
      console.error('Failed to load sessions:', data.error);
      if (miniList){
        miniList.innerHTML = `
          <div style="color: red; text-align: center;">
            Error loading sessions: ${data.error}
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading sessions:', error);
    if (miniList) {
      miniList.innerHTML = `
        <div style="color: red; text-align: center;">
          Error: ${error.message}
        </div>
      `;
    }
  }
}

/**Display sessions in the sidebar */
function displaySessionsInSidebar(sessions) {
  const miniList = document.getElementById('miniList');
  miniList.innerHTML = '';
  
  //helper function to show a message
  const showMessage = (text) => {
    miniList.innerHTML = `<div class="no-sessions" style="color: #000000; text-align: center;">${text}</div>`;
  };
  
  if (sessions.length === 0) {
    return showMessage('No chat sessions yet');
  }
  
  //filter out current session and see if any remain
  const otherSessions = sessions.filter(session => !session.is_current);
  if (otherSessions.length === 0) {
    return showMessage('No other sessions for this user');
  }
  
  //create session elements
  sessions.forEach(session => {
    const div = document.createElement('div');
    div.className = `session-item ${session.is_current ? 'current-session' : ''}`;
    
    div.innerHTML = `
      <div class="session-info">
        <div class="session-name">
          ${session.display_name}
          ${session.is_anonymous ? ' (Anonymous)' : ''}
          ${session.is_current ? ' (Current)' : ''}
        </div>
        <div class="session-date">
          ${new Date(session.created_at).toLocaleDateString()}
        </div>
      </div>
    `;
    
    //add click handler for non-current sessions
    if (!session.is_current) {
      div.addEventListener('click', () => window.location.href = `/chat/${session.session_id}`);
      div.addEventListener('mouseenter', () => div.style.backgroundColor = '#ffffff');
      div.addEventListener('mouseleave', () => div.style.backgroundColor = '');
    }
    
    miniList.appendChild(div);
  });
}






async function loadHistory(){
  const res = await fetch(`/api/chat/${paperId}/history`);
  const data = await res.json();
  chatWindow.innerHTML = "";
  data.history.forEach(m=> addBubble(m.sender, m.text));
}

// paper sends first message
async function ensureFirstMessage(){
  const res = await fetch(`/api/chat/${paperId}/first`, { method: "POST" });
  const data = await res.json();
  if (data.reply){
    addBubble("ai", data.reply);
  }
}

chatForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const text = chatInput.value.trim();
  if(!text) return;
  addBubble("user", text);
  chatInput.value = "";

  const res = await fetch(`/api/chat/${paperId}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ message: text })
  });
  const data = await res.json();
  addBubble("ai", data.reply || "(no reply)");
});

(async function init(){
  //await preloadSidebar();
  await loadChatSessions();
  await loadHistory();
  await ensureFirstMessage();
})();

