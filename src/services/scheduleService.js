import api from './api'

const scheduleService = {
  async getConflicts(useAi = false) {
    const data = await api.get(`/api/schedule/conflicts?ai=${useAi}`)
    return data.conflicts  // backend returns { count, ai_used, conflicts: [] }
  }
}

export default scheduleService