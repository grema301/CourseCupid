
/**
 * App.js - Course Cupid Application
 * Handles session creation, deletion, and UI initialization
 */


/**
 * Creates a new Cupid chat session and redirects user to it
 * Called when user clicks "New Chat" button
 */
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
            // Redirect to new chat session
            window.location.href = `/chat/${data.session_id}`;
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to create session');
    }
}

/**
 * Deletes the current chat session (Cupid or paper)
 * Prompts user for confirmation before deletion
 */
async function deleteSession(){
    try {
        const identifier = getCurrentSessionID();
        
        // Confirm deletion with user
        const confirmed = confirm(`Are you sure you want to delete this chat?`);
        if (!confirmed) return;
        
        const response = await fetch(`/api/chat-sessions/${identifier}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        
        const data = await response.json();

        if (response.ok && data.success) {    
            alert('Deleted successfully!');    
            // Redirect to empty chat page
            window.location.href = "/chat";
        } else {
            throw new Error(data.message || 'Failed to delete session');
        }
    } catch (error) {
    console.error('Error:', error);
    alert('Failed to delete session');
    }
}

/**
 * Extracts the session ID or paper code from the current URL
 * URL format: /chat/:identifier
 * @returns {string|null} The identifier (session UUID or paper code), or null if not found
 */
function getCurrentSessionID() {
    const path = window.location.pathname;
    const match = path.match(/\/chat\/(.+)/);
    return match ? match[1] : null;
}

/**
 * Initializes the application when DOM is ready
 * Loads mini match list and updates session display
 * Note: Session display is handled by Chat.js
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Current URL:', window.location.pathname); 

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
