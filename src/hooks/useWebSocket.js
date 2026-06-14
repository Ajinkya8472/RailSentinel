import { useEffect, useRef } from 'react'
import useIncidentStore from '../store/incidentStore'
import useTrainStore    from '../store/trainStore'
import useRiskStore     from '../store/riskStore'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live'

export default function useWebSocket() {
  const ws             = useRef(null)
  const reconnectTimer = useRef(null)
  const mounted        = useRef(false)

  const addIncident    = useIncidentStore(s => s.addIncident)
  const updateIncident = useIncidentStore(s => s.updateIncident)
  const setTrains      = useTrainStore(s => s.setTrains)
  const setTrainStatus = useTrainStore(s => s.setTrainStatus)
  const setRiskData    = useRiskStore(s => s.setRiskData)

  const connect = () => {
    if (!mounted.current) return

    ws.current = new WebSocket(WS_URL)

    ws.current.onopen = () => {
      console.log('✅ RailSentinel WebSocket connected')
    }

    ws.current.onmessage = (event) => {
      let data
      try { data = JSON.parse(event.data) }
      catch { return }

      switch (data.type) {

        case 'connected':
          console.log('WS handshake OK')
          break

        // All train positions every 3 seconds
        case 'train_update':
          if (Array.isArray(data.trains)) {
            setTrains(data.trains)
          }
          break

        // AI pipeline completed — new incident
        case 'new_incident':
          if (data.incident) {
            addIncident(data.incident)
            setTrainStatus(data.incident.train_id, 'incident')
            if (
              data.incident.priority >= 4 &&
              data.incident.hindi_alert &&
              window.speechSynthesis
            ) {
              const u = new SpeechSynthesisUtterance(
                data.incident.hindi_alert
              )
              u.lang = 'hi-IN'
              u.rate = 0.9
              window.speechSynthesis.speak(u)
            }
          }
          break

        // Approve or reject status change
        case 'incident_update':
          if (data.incident_id) {
            updateIncident(
              data.incident_id,
              data.new_status,
              data.incident
            )
          }
          break

        // Spike detected — AI still processing
        case 'sensor_spike':
          if (data.train_id) {
            setTrainStatus(data.train_id, 'incident')
            console.log('⚡ Spike on train:', data.train_id)
          }
          break

        // Risk score every 30 seconds
        case 'risk_update':
          setRiskData(data)
          break

        default:
          console.log('WS unknown type:', data.type)
      }
    }

    ws.current.onclose = () => {
      console.log('WS disconnected — reconnecting in 3s')
      if (mounted.current) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    ws.current.onerror = () => ws.current?.close()
  }

  useEffect(() => {
    mounted.current = true
    connect()
    return () => {
      mounted.current = false
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [])
}