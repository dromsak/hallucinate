export function getDomElements() {
  const canvas = document.createElement('canvas')
  const djVideo = document.createElement('div')
  const chatForm = document.createElement('form')
  const chatInput = document.createElement('input')
  const chatBubble = document.createElement('div')
  const roomControls = document.createElement('div')
  const roomButtons = [document.createElement('button'), document.createElement('button')]
  const intro = document.createElement('div')
  const introProgress = document.createElement('div')

  canvas.id = 'scene'
  canvas.className = 'block h-dvh w-dvw'

  djVideo.id = 'dj-video'
  djVideo.className = 'absolute border-0 opacity-0'

  chatForm.id = 'chat-form'
  chatForm.className = 'absolute opacity-0'

  chatInput.id = 'chat-input'
  chatInput.maxLength = 120
  chatInput.autocomplete = 'off'

  chatBubble.id = 'chat-bubble'
  chatBubble.className = 'absolute left-0 top-0 z-20'

  roomControls.id = 'room-controls'
  roomControls.className = 'absolute left-3 top-3 z-30 flex gap-1'

  roomButtons.forEach((button, room) => {
    button.type = 'button'
    button.textContent = room === 0 ? 'Outside' : 'Inside'
    button.dataset.room = `${room}`
    button.className = 'room-button'
    roomControls.append(button)
  })

  intro.id = 'intro'
  introProgress.id = 'intro-progress'
  introProgress.textContent = '0%'

  chatForm.append(chatInput)
  intro.append(introProgress)
  document.body.prepend(canvas, djVideo, chatForm, chatBubble, roomControls, intro)

  return {
    canvas,
    djVideo,
    chatForm,
    chatInput,
    chatBubble,
    roomButtons,
    intro,
    introProgress,
  }
}
