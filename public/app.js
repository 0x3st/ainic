// Chat state
let conversationHistory = [];
let isLoading = false;

// DOM elements
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const loadingIndicator = document.getElementById('loading');
const modeText = document.getElementById('mode-text');
const footerText = document.getElementById('footer-text');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', handleKeyPress);

    // Check API status
    checkAPIStatus();
});

// Handle keyboard shortcuts
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// Check if API is in demo or production mode
async function checkAPIStatus() {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '__status_check__' })
        });

        const data = await response.json();

        if (data.mode === 'production') {
            modeText.textContent = `Production Mode (${data.model || 'AI'})`;
            footerText.textContent = 'AI-powered responses enabled';
        } else {
            modeText.textContent = 'Demo Mode';
            footerText.textContent = 'Running in demo mode. Configure ANTHROPIC_API_KEY for AI responses.';
        }
    } catch (error) {
        console.error('Failed to check API status:', error);
        modeText.textContent = 'Unknown';
    }
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || isLoading) return;

    // Add user message to UI
    addMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message });

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Show loading
    isLoading = true;
    sendButton.disabled = true;
    loadingIndicator.classList.remove('hidden');

    try {
        // Call API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                conversationHistory: conversationHistory.slice(0, -1) // Don't include the current message
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Add assistant response
        addMessage(data.response, 'assistant');
        conversationHistory.push({ role: 'assistant', content: data.response });

    } catch (error) {
        console.error('Error sending message:', error);
        addMessage(
            'Sorry, I encountered an error processing your request. Please try again.',
            'assistant'
        );
    } finally {
        // Hide loading
        isLoading = false;
        sendButton.disabled = false;
        loadingIndicator.classList.add('hidden');
        messageInput.focus();
    }
}

// Add message to chat
function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Format message content (preserve line breaks, lists, etc.)
    contentDiv.innerHTML = formatMessage(content);

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Format message content
function formatMessage(text) {
    // Convert markdown-style formatting to HTML
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`(.*?)`/g, '<code>$1</code>'); // Code

    // Split into paragraphs
    const paragraphs = formatted.split('\n\n');

    return paragraphs.map(para => {
        // Handle lists
        if (para.includes('\n• ') || para.includes('\n- ')) {
            const items = para
                .split(/\n[•-] /)
                .filter(item => item.trim())
                .map(item => `<li>${item.trim()}</li>`)
                .join('');
            return `<ul>${items}</ul>`;
        }

        // Handle numbered lists
        if (/^\d+\. /.test(para)) {
            const items = para
                .split(/\n\d+\. /)
                .filter(item => item.trim())
                .map(item => `<li>${item.trim()}</li>`)
                .join('');
            return `<ol>${items}</ol>`;
        }

        // Regular paragraph
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});
