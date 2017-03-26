const express = require('express')
const morgan = require('morgan')
const path = require('path')

const app = express()

app.use(morgan('combined'))
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, 'public/404.html'))
})

const PORT = 3000

app.listen(PORT, () =>{
  console.log(`BookingBot.Web running at htttp://localhost:${PORT}`)
})
