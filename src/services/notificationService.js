import api from './api'

const notificationService = {
  async getRecent(limit = 50) {
    const data = await api.get(`/api/notifications?limit=${limit}`)
    return data.notifications  // backend returns { count, notifications: [] }
  }
}

export default notificationService