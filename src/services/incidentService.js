import api from './api'

const incidentService = {
  async getAll(filters = {}) {
    const params = new URLSearchParams()
    if (filters.status)   params.append('status',   filters.status)
    if (filters.priority) params.append('priority', filters.priority)
    if (filters.limit)    params.append('limit',    filters.limit)
    const query = params.toString() ? `?${params.toString()}` : ''
    const data = await api.get(`/api/incidents${query}`)
    return data.incidents  // backend returns { count, incidents: [] }
  },

  async getOne(id) {
    return await api.get(`/api/incidents/${id}`)
  },

  async approve(id, approvedBy = 'Controller') {
    return await api.post(`/api/incidents/${id}/approve`, {
      approved_by: approvedBy,
      resolution_notes: null
    })
  },

  async reject(id, reason = '') {
    return await api.post(`/api/incidents/${id}/reject`, {
      rejected_by: 'Controller',
      reason: reason
    })
  },

  downloadPdf(id) {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    window.open(`${base}/api/incidents/${id}/pdf`, '_blank')
  },

  async triggerDemo(trainId = 'T001') {
    return await api.post(`/api/incidents/trigger?train_id=${trainId}`)
  }
}

export default incidentService