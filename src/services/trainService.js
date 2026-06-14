import api from './api'

const trainService = {
  async getLive() {
    const data = await api.get('/api/trains/live')
    return data.trains  // backend returns { count, trains: [] }
  },

  async getOne(trainId) {
    return await api.get(`/api/trains/${trainId}`)
  },

  async updateStatus(trainId, status) {
    return await api.patch(`/api/trains/${trainId}/status?status=${status}`)
  }
}

export default trainService