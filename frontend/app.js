
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
        alert(`Success! Created session: ${data.session_id}`);
        window.location.href = `/chat/${data.session_id}`;
    }
    } catch (error) {
    console.error('Error:', error);
    alert('Failed to create session');
    }
}

//get current session ID from URL and display it
//should add/change to a session title in the future
function getCurrentSessionId() {
    const path = window.location.pathname;
    const match = path.match(/\/chat\/(.+)/);
    return match ? match[1] : null;
}

//update the session ID display
function updateSessionDisplay() {
    const sessionId = getCurrentSessionId();
    //shoudl show session title in the future
    const sessionElement = document.getElementById('current-session-id');
    
    if (sessionId && sessionElement){
        sessionElement.textContent = sessionId;
        console.log('Session ID displayed:', sessionId);

        //for the future, maybe distinct between AI chat and paper chat
        document.getElementById('paperTitle').textContent = 'Dynamic title';

    }else{
        console.log('No session ID found or element missing'); 
        if (sessionElement) {
            sessionElement.textContent = 'No session';
        }
    }
}


//initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Current URL:', window.location.pathname); 
    updateSessionDisplay();
});
