// The parent page of the feasibility proof (WEB.PLAY.1). probe(scenario) frames the frame page in an opaque-origin
// sandbox and resolves with the frame's one report and the time from creating the frame to it. `run` names the
// copy of the counted module the frame imports (R-1). A message counts only when it comes from that frame's window
// with the origin an opaque origin sends, 'null' (website playground spec §5.1).
window.probe = (scenario, run = '') =>
  new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.src = `/playground/frame/?scenario=${encodeURIComponent(scenario)}&run=${encodeURIComponent(run)}`
    const started = performance.now()
    const timer = setTimeout(() => reject(new Error(`no report from the frame for ${scenario}`)), 10000)
    window.addEventListener('message', function onMessage(event) {
      if (event.source !== frame.contentWindow || event.origin !== 'null') return
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      let parentCanRead
      try {
        parentCanRead = frame.contentDocument !== null
      } catch {
        parentCanRead = false
      }
      frame.remove()
      resolve({ ...event.data, parentCanRead, elapsedMs: Math.round(performance.now() - started) })
    })
    document.body.append(frame)
  })
