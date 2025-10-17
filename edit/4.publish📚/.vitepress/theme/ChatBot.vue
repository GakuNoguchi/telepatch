<template>
  <div>
    <!-- チャットボタン -->
    <button
      v-if="!isOpen"
      @click="toggleChat"
      class="chat-button"
      aria-label="Open chat"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- チャットモーダル -->
    <div v-if="isOpen" class="chat-modal">
      <div class="chat-header">
        <h3>Humanitie AI アシスタント</h3>
        <button @click="toggleChat" class="close-button" aria-label="Close chat">×</button>
      </div>

      <div class="chat-messages" ref="messagesContainer">
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <div class="message-content" v-html="formatMessage(msg.content)"></div>
          <div v-if="msg.sources && msg.sources.length > 0" class="sources">
            <details>
              <summary>参照ドキュメント</summary>
              <ul>
                <li v-for="source in msg.sources" :key="source.file">
                  {{ source.file }} (関連度: {{ Math.round(source.score * 100) }}%)
                </li>
              </ul>
            </details>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant">
          <div class="message-content">
            <span class="typing-indicator">...</span>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <input
          v-model="inputMessage"
          @keyup.enter="sendMessage"
          placeholder="質問を入力してください..."
          :disabled="isLoading"
        />
        <button @click="sendMessage" :disabled="isLoading || !inputMessage.trim()">
          送信
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const isOpen = ref(false)
const messages = ref([
  {
    role: 'assistant',
    content: 'こんにちは！Humanitieドキュメントについて何でもお聞きください。'
  }
])
const inputMessage = ref('')
const isLoading = ref(false)
const messagesContainer = ref(null)

const toggleChat = () => {
  isOpen.value = !isOpen.value
}

const formatMessage = (content) => {
  // 簡単なMarkdown風の変換
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return

  const userMessage = inputMessage.value.trim()
  messages.value.push({
    role: 'user',
    content: userMessage
  })

  inputMessage.value = ''
  isLoading.value = true
  scrollToBottom()

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: userMessage })
    })

    if (!response.ok) {
      throw new Error('Failed to get response')
    }

    const data = await response.json()
    messages.value.push({
      role: 'assistant',
      content: data.answer,
      sources: data.sources
    })
  } catch (error) {
    console.error('Chat error:', error)
    messages.value.push({
      role: 'assistant',
      content: '申し訳ございません。エラーが発生しました。もう一度お試しください。'
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}
</script>

<style scoped>
.chat-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #3451b2;
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  z-index: 1000;
}

.chat-button:hover {
  background: #2a3f8f;
  transform: scale(1.05);
}

.chat-modal {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 400px;
  height: 600px;
  max-height: calc(100vh - 48px);
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #3451b2;
  color: white;
  border-radius: 12px 12px 0 0;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message.user {
  align-items: flex-end;
}

.message.assistant {
  align-items: flex-start;
}

.message-content {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  word-wrap: break-word;
}

.message.user .message-content {
  background: #3451b2;
  color: white;
}

.message.assistant .message-content {
  background: #f3f4f6;
  color: #1f2937;
}

.sources {
  font-size: 12px;
  color: #6b7280;
  max-width: 85%;
}

.sources details {
  margin-top: 4px;
}

.sources summary {
  cursor: pointer;
  user-select: none;
}

.sources ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.sources li {
  margin: 4px 0;
}

.typing-indicator {
  display: inline-block;
  animation: typing 1.4s infinite;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}

.chat-input {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 8px;
}

.chat-input input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input input:focus {
  border-color: #3451b2;
}

.chat-input input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.chat-input button {
  padding: 10px 20px;
  background: #3451b2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background: #2a3f8f;
}

.chat-input button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .chat-modal {
    width: calc(100vw - 32px);
    height: calc(100vh - 32px);
    bottom: 16px;
    right: 16px;
  }

  .chat-button {
    bottom: 16px;
    right: 16px;
  }
}
</style>
