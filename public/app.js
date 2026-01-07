// Chat state
let conversationHistory = [];
let isLoading = false;

// DOM elements
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const loadingIndicator = document.getElementById('loading');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const footerInfo = document.getElementById('footerInfo');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    userInput.focus();

    // Event listeners
    sendBtn.addEventListener('click', sendMsg);
    userInput.addEventListener('keypress', handleKeyPress);

    // Check API status
    checkAPIStatus();
});

// Handle keyboard shortcuts
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
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
            statusDot.style.color = '#10b981';
            statusText.textContent = `AI Connected (${data.model || 'Claude'})`;
            footerInfo.textContent = 'AI-powered responses enabled';
        } else {
            statusDot.style.color = '#f59e0b';
            statusText.textContent = 'Demo Mode';
            footerInfo.textContent = 'Running in demo mode. Configure ANTHROPIC_API_KEY for AI responses.';
        }
    } catch (error) {
        console.error('Failed to check API status:', error);
        statusDot.style.color = '#ef4444';
        statusText.textContent = 'Connection Error';
    }
}

// Fill input with quick action text
function fillInput(txt) {
    userInput.value = txt;
    userInput.focus();
}

// Send message
async function sendMsg() {
    const message = userInput.value.trim();

    if (!message || isLoading) return;

    // Add user message to UI
    appendMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message });

    // Clear input
    userInput.value = '';

    // Show loading
    isLoading = true;
    sendBtn.disabled = true;
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
        appendMessage(data.response, 'ai');
        conversationHistory.push({ role: 'assistant', content: data.response });

    } catch (error) {
        console.error('Error sending message:', error);
        appendMessage(
            'Sorry, I encountered an error processing your request. Please try again.',
            'ai'
        );
    } finally {
        // Hide loading
        isLoading = false;
        sendBtn.disabled = false;
        loadingIndicator.classList.add('hidden');
        userInput.focus();
    }
}

// Add message to chat
function appendMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';

    // Format message content
    bubbleDiv.innerHTML = formatMessage(content);

    messageDiv.appendChild(bubbleDiv);
    chatBox.appendChild(messageDiv);

    // Scroll to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Format message content with markdown-like syntax
function formatMessage(text) {
    // Convert markdown-style formatting to HTML
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`(.*?)`/g, '<code>$1</code>'); // Code

    // Split into paragraphs
    const paragraphs = formatted.split('\n\n');

    return paragraphs.map(para => {
        // Handle bullet lists
        if (para.includes('\n• ') || para.includes('\n- ')) {
            const items = para
                .split(/\n[•-] /)
                .filter(item => item.trim())
                .map(item => `<li>${item.trim()}</li>`)
                .join('');
            return `<ul style="margin-left: 1.5rem; margin-bottom: 0.75rem;">${items}</ul>`;
        }

        // Handle numbered lists
        if (/^\d+\. /.test(para)) {
            const items = para
                .split(/\n\d+\. /)
                .filter(item => item.trim())
                .map(item => `<li>${item.trim()}</li>`)
                .join('');
            return `<ol style="margin-left: 1.5rem; margin-bottom: 0.75rem;">${items}</ol>`;
        }

        // Regular paragraph
        return `<p style="margin-bottom: 0.75rem;">${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}
