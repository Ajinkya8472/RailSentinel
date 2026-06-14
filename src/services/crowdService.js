import api from './api'

const crowdService = {
  async getForecast() {
    const data = await api.get('/api/crowd/forecast')
    return data.forecast  // backend returns { count, warnings, forecast: [] }
  },

  async refresh() {
    return await api.post('/api/crowd/refresh')
  },

  async setFestivalMode(stationCode, enabled = true) {
    return await api.post(
      `/api/crowd/festival?station_code=${stationCode}&enabled=${enabled}`
    )
  }
}

export default crowdService