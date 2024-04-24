async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value;

    // Display user message
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user-bubble';
    userBubble.textContent = message;
    document.getElementById('fortuneResponse').appendChild(userBubble);

    // Clear input field
    messageInput.value = '';

    // Send message to the server and get the fortune response
    try {
    const response = await fetch('/fortuneTell', {
    method : 'POST',
    headers : {
        'Content-Type': 'application/json'
    },
        body : JSON.stringify({name : 'John'}) //replace with your desired data
    });

        if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
    }

        const data = await response.json();
        console.log('Response:', data.assistant);

        // Display bot response (fortune) in a chat bubble
        const botBubble = document.createElement('div');
        botBubble.className = 'chat-bubble bot-bubble';
        botBubble.textContent = data.assistant;
        document.getElementById('fortuneResponse').appendChild(botBubble);

    } catch (error) {
        console.error('Error:', error);
        //Handle any errors that occur during the request
    }
}
