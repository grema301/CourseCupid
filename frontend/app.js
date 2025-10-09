
/**App.js */

/**Function to let user create a new chat session, is redirected */
async function startCreateSession() {
    try {
        console.log('Creating chat session...');
        
        const response = await fetch('/api/chat-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        console.log('Created session:', data);
        
        if (data.session_id) {
            window.location.href = `/chat/${data.session_id}`;
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create session');
    }
}

//get current session ID from URL and display it
//should add/change to a session title in the future
function getCurrentSessionID() {
    const path = window.location.pathname;
    const match = path.match(/\/chat\/(.+)/);
    return match ? match[1] : null;
}

//update the session ID display
function updateSessionDisplay() {
    const sessionID = getCurrentSessionID();
    //shoudl show session title in the future
    const sessionElement = document.getElementById('current-session-id');
    
    if (sessionID && sessionElement){
        sessionElement.textContent = sessionID;
        console.log('Session ID displayed:', sessionID);

        //for the future, maybe distinct between AI chat and paper chat
        document.getElementById('paperTitle').textContent = 'Dynamic title';

    }else{
        console.log('No session ID found or element missing'); 
        if (sessionElement) {
            sessionElement.textContent = 'No session';
        }
    }
}


//Lets users delete a cupid and a paper session
async function deleteSession(){
    try {

        // Check if identifier is a session ID or a paper match
        const identifier = getCurrentSessionID();
        
        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to delete this chat?`);
        if (!confirmed) return;
        
        const response = await fetch(`/api/chat-sessions/${identifier}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();

        if (response.ok && data.success) {    
            alert('Deleted successfully!');    
            // Refresh page, set the chatting session of the page to blank
            window.location.href = "/chat";
        } else {
            throw new Error(data.message || 'Failed to delete session');
        }
    } catch (error) {
    console.error('Error:', error);
    alert('Failed to delete session');
    }
}




document.addEventListener('DOMContentLoaded', async () => {
  const miniList = document.getElementById('miniList');

  try {
    const res = await fetch('/api/my-matches');
    const matches = await res.json();

    matches.forEach(m => {
      const el = document.createElement('a');
      el.className = 'cc-item mini';
      el.href = `/chat/${m.paper_code}`;
      el.textContent = `${m.paper_code}`;
      miniList.appendChild(el);
    });
  } catch (err) {
    console.error('Failed to load mini matches:', err);
    miniList.innerHTML = `<p class="error">Could not load matches.</p>`;
  }
});

//initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Current URL:', window.location.pathname); 
    updateSessionDisplay();
});
