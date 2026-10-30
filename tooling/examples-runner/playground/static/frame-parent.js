// The test parent of the playground frame (WEB.PLAY.2), standing in for the site's page. run(url, code, determinism)
// frames an example's frame page, sends one `run` once the frame has booted, and logs every message from that frame
// in window.frameLog. It accepts a message only from the frame it made, with the origin an opaque origin sends.
window.frameLog = []
window.frames_ = []

window.run = (url, code, determinism) => {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.style.width = '640px'
  frame.style.height = '400px'
  frame.src = url
  window.frames_.push(frame)
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return
    window.frameLog.push(event.data)
    if (event.data.type === 'booted') {
      const run = { v: 1, type: 'run', runId: 1, code }
      frame.contentWindow.postMessage(determinism === undefined ? run : { ...run, determinism }, '*')
    }
  })
  document.body.append(frame)
}

// Sends a message to the last frame as is, for the cases that check what the frame drops.
window.sendRaw = (data) => window.frames_.at(-1).contentWindow.postMessage(data, '*')
