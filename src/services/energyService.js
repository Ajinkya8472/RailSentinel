import api from './api'

const energyService = {
  async getProfile(trainId) {
    return await api.get(`/api/energy/profile/${trainId}`)
    // direct response, no wrapper
  }
}

export default energyService