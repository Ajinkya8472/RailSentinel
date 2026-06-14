import api from './api'

const riskService = {
  async getComposite() {
    return await api.get('/api/risk/composite')
    // direct response, no wrapper
  },

  async forceCompute() {
    return await api.post('/api/risk/compute')
  }
}

export default riskService