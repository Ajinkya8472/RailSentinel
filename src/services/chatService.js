import api from './api'

const chatService = {
  async ask(question) {
    const data = await api.post('/api/chat', { question })
    return {
      answer:      data.answer,
      aiAvailable: data.ai_available,
      context:     data.context_used
    }
  }
}

export default chatService