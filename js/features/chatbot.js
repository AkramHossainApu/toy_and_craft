/**
 * Premium Chatbot Logic for Toy & Craft
 */

export class Chatbot {
    constructor() {
        this.container = document.getElementById('chatbot-container');
        this.trigger = document.getElementById('chatbot-trigger');
        this.window = document.getElementById('chatbot-window');
        this.closeBtn = document.getElementById('close-chatbot');
        this.messagesContainer = document.getElementById('chatbot-messages');
        this.actionsContainer = document.getElementById('chatbot-actions');
        this.inputField = document.getElementById('chatbot-input-field');
        this.sendBtn = document.getElementById('send-chatbot-msg');
        this.firstMessageSent = false;

        this.init();
    }

    init() {
        if (!this.trigger || !this.window) return;

        this.trigger.addEventListener('click', () => this.toggle());
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Handle Quick Actions
        this.actionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn')) {
                const action = e.target.dataset.action;
                const label = e.target.innerText;
                this.handleAction(action, label);
            }
        });

        // Handle Input
        this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
    }

    toggle() {
        this.window.classList.toggle('active');
    }

    close() {
        this.window.classList.remove('active');
    }

    addMessage(text, side = 'bot') {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${side}`;
        msgDiv.innerText = text;
        this.messagesContainer.appendChild(msgDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        if (side === 'user' && !this.firstMessageSent) {
            this.firstMessageSent = true;
            this.hideActions();
        }
    }

    hideActions() {
        if (this.actionsContainer) {
            this.actionsContainer.style.transition = 'opacity 0.3s, transform 0.3s';
            this.actionsContainer.style.opacity = '0';
            this.actionsContainer.style.transform = 'translateY(10px)';
            setTimeout(() => {
                this.actionsContainer.style.display = 'none';
            }, 300);
        }
    }

    handleAction(action, label) {
        this.addMessage(label, 'user');
        
        setTimeout(() => {
            switch(action) {
                case 'track':
                    this.addMessage("You can track your order by clicking the Profile icon -> 'My Orders'. If you have your Order ID (e.g. #1001), I can also help you find it! 📦");
                    break;
                case 'shipping':
                    this.addMessage("We deliver all over Bangladesh! 🇧🇩\n• Inside Dhaka: 60 TK (2-3 days)\n• Outside Dhaka: 120 TK (3-5 days)\nFree shipping on orders over 5000 TK!");
                    break;
                case 'return':
                    this.addMessage("Our Return Policy is user-friendly! You have 7 days to return any unused item in its original condition. Need a return form? 📄");
                    break;
                case 'human':
                    this.addMessage("I'll connect you to a real person! Please click any of the Messenger, WhatsApp, or Instagram icons in the header above to chat with us directly. 💬");
                    break;
                default:
                    this.addMessage("I'm still learning! Try the options below or ask about shipping, tracking, or returns. 😊");
            }
        }, 600);
    }

    handleSendMessage() {
        const text = this.inputField.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        this.inputField.value = '';

        setTimeout(() => {
            this.processMessage(text);
        }, 800);
    }

    processMessage(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
            this.addMessage("Hello! 👋 Welcome to Toy & Craft. How can I make your day better?");
        } else if (lowerText.includes('order') || lowerText.includes('track')) {
            this.addMessage("To track your order, please visit your Profile or send us your Order Number. We'll check the status for you! 🔍");
        } else if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('how much')) {
            this.addMessage("Our premium Mini Bricks and Key Rings have various prices. You can see them all in our 'Explore Our Collection' section! 🧱");
        } else if (lowerText.includes('contact') || lowerText.includes('human') || lowerText.includes('help')) {
            this.addMessage("Need more help? Our team is online! Click the Messenger or WhatsApp icons in the top bar of this window to talk to us. 👩‍💻");
        } else if (lowerText.includes('location') || lowerText.includes('where')) {
            this.addMessage("We are based in Dhaka, but we ship our toys and crafts all over Bangladesh! 🚀");
        } else {
            this.addMessage("That sounds interesting! I'm Toy & Craft's AI assistant. If you need specific help, feel free to use the quick buttons below or message us directly via the social icons! ✨");
        }
    }
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new Chatbot();
});
