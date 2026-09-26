import { useEffect, useRef, useState } from "react"
import { Button, Icon } from "./design"
import { PracticeRecording, recordingOff } from "./practice-recording"

export function PracticeMicrophone({ deadline, finished, onStarted }: {
  deadline: number
  finished: boolean
  onStarted: () => void
}) {
  const controller = useRef<PracticeRecording | null>(null)
  const latest = useRef({ deadline, finished, onStarted })
  latest.current = { deadline, finished, onStarted }
  const [state, setState] = useState(recordingOff)
  useEffect(() => {
    const recording = new PracticeRecording(setState)
    controller.current = recording
    const stop = () => recording.stop()
    window.addEventListener("pagehide", stop)
    return () => {
      window.removeEventListener("pagehide", stop)
      recording.dispose()
      controller.current = null
    }
  }, [])
  useEffect(() => { if (finished) controller.current?.stop() }, [finished])
  const recording = state.phase === "recording"
  const requesting = state.phase === "requesting"
  return (
    <section className="practice-microphone" aria-label="Practice microphone">
      <div className="practice-mic-header">
        <div>
          <strong>Practice with your voice</strong>
          <p>Record up to 60 seconds, then listen back. You can also type below.</p>
        </div>
        <Button
          variant={recording ? "secondary" : "primary"}
          aria-pressed={recording}
          disabled={state.phase === "stopping"}
          onClick={() => {
            if (recording || requesting) controller.current?.stop()
            else void controller.current?.start(
              () => latest.current.deadline && !latest.current.finished ? latest.current.deadline - Date.now() : 60000,
              () => latest.current.onStarted(),
            )
          }}
        >
          <Icon name="mic" />
          {requesting ? "Cancel microphone" : recording ? "Turn microphone off" : state.phase === "stopping" ? "Finishing…" : "Turn microphone on"}
        </Button>
      </div>
      <p role="status" className={recording ? "positive" : ""}>{state.message || "Microphone off."}</p>
      {state.url && <div className="practice-playback">
        <audio controls src={state.url} aria-label="Your recorded practice response" />
        <Button variant="ghost" onClick={() => controller.current?.clear()}>Delete recording</Button>
      </div>}
      <small>Only on this device. Nothing is uploaded or AI-scored. Recording stops when you finish; it is cleared when you change scenarios or leave this page.</small>
    </section>
  )
}
