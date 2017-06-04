const AVS = require('alexa-voice-service')

const avs = new AVS({
  debug: true,
  clientId: 'amzn1.application-oa2-client.64708316a35a41d3ac744b7dfd1d8e9e',
  deviceId: 'projektryanair',
  deviceSerialNumber: 123,
  redirectUri: `https://${window.location.host}/authresponse`
})
window.avs = avs

avs.on(AVS.EventTypes.TOKEN_INVALID, () => {
  avs.logout()
    .then(login)
})

const record = document.getElementById('start-booking')

avs.getTokenFromUrl()
.then(() => avs.getToken())
.then(token => localStorage.setItem('token', token))
.then(() => avs.requestMic())
.catch(() => {
  const cachedToken = localStorage.getItem('token')

  if (cachedToken) {
    avs.setToken(cachedToken)
    return avs.requestMic()
  }
})

function login() {
  return avs.login()
  .then(() => avs.requestMic())
  .catch(() => {});
}

record.addEventListener('mousedown', () => {
  avs.startRecording()
})

record.addEventListener('mouseup', () => {
  avs.stopRecording().then(dataView => {
    avs.sendAudio(dataView)
    .then(({xhr, response}) => {

      var promises = []
      var audioMap = {}
      var directives = null

      if (response.multipart.length) {
        response.multipart.forEach(multipart => {
          let body = multipart.body
          if (multipart.headers && multipart.headers['Content-Type'] === 'application/json') {
            try {
              body = JSON.parse(body)
            } catch(error) {
              console.error(error)
            }

            if (body && body.messageBody && body.messageBody.directives) {
              directives = body.messageBody.directives
            }
          } else if (multipart.headers['Content-Type'] === 'audio/mpeg') {
            const start = multipart.meta.body.byteOffset.start
            const end = multipart.meta.body.byteOffset.end

            /**
             * Not sure if bug in buffer module or in http message parser
             * because it's joining arraybuffers so I have to this to
             * seperate them out.
             */
            var slicedBody = xhr.response.slice(start, end)

            //promises.push(avs.player.enqueue(slicedBody))
            audioMap[multipart.headers['Content-ID']] = slicedBody
          }
        })

        function findAudioFromContentId(contentId) {
          contentId = contentId.replace('cid:', '')
          for (var key in audioMap) {
            if (key.indexOf(contentId) > -1) {
              return audioMap[key]
            }
          }
        }

        directives.forEach(directive => {
          if (directive.namespace === 'SpeechSynthesizer') {
            if (directive.name === 'speak') {
              const contentId = directive.payload.audioContent
              const audio = findAudioFromContentId(contentId)
              if (audio) {
                promises.push(avs.player.enqueue(audio))
              }
            }
          } else if (directive.namespace === 'AudioPlayer') {
            if (directive.name === 'play') {
              const streams = directive.payload.audioItem.streams
              streams.forEach(stream => {
                const streamUrl = stream.streamUrl

                const audio = findAudioFromContentId(streamUrl)
                if (audio) {
                  promises.push(avs.player.enqueue(audio))
                } else if (streamUrl.indexOf('http') > -1) {
                  const xhr = new XMLHttpRequest()
                  const url = `/parse-m3u?url=${streamUrl.replace(/!.*$/, '')}`
                  xhr.open('GET', url, true)
                  xhr.responseType = 'json'
                  xhr.onload = (event) => {
                    const urls = event.currentTarget.response

                    urls.forEach(url => {
                      avs.player.enqueue(url)
                    })
                  }
                  xhr.send()
                }
              })
            }
          }
        })

        if (promises.length) {
          Promise.all(promises)
         .then(() => {
            avs.player.playQueue()
          })
        }
      }

    })
    .catch(error => {
      console.error(error)
    })
  })
})
