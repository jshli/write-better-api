require('dotenv').config()
const app = require('express')()
const stripe = require('stripe')(process.env.STRIPE_KEY)
const contentful = require('contentful')
const contentfulManagement = require('contentful-management')
const bodyParser = require('body-parser')
const Hubspot = require('hubspot')
const sgMail = require('@sendgrid/mail')
const Sentry = require('@sentry/node')

sgMail.setApiKey(process.env.SENDGRID_API_KEY)
Sentry.init({
  dsn: 'https://4d2d27dd1a054a699a0928fd874be3fc@sentry.io/1545477'
})

const ManagementClient = require('auth0').ManagementClient

const client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN
})

const managementClient = contentfulManagement.createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
})

const auth0 = new ManagementClient({
  domain: `athena.au.auth0.com`,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  scope:
    'read:users update:users update:users_app_metadata read:users_app_metadata',
  audience: 'https://athena.au.auth0.com/api/v2/',
  tokenProvider: {
    enableCache: true,
    cacheTTLInSeconds: 10
  }
})

const hubspot = new Hubspot({
  apiKey: process.env.HUBSPOT_API_KEY
})

app.use(bodyParser.json())

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Methods',
    'GET,PUT,PATCH,POST,DELETE,OPTIONS'
  )
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})

app.get('/', (req, res) => {
  res.send('Hello world')
})

app.post('/charge', async (req, res) => {
  var request = req.body
  let totalAmount = 0
  try {
    const entries = await client.getEntries({
      content_type: 'book'
    })
    totalAmount = entries.items
      .filter(item => request.items.includes(item.fields.title))
      .map(item => Math.round(Number(item.fields.price) * 100))
      .reduce((acc, val) => acc + val)
  } catch (e) {
    return res.status(500).json({ error: e })
  }
  try {
    const coupons = await client.getEntries({
      content_type: 'couponCode'
    })
    const activeCoupon = coupons.items.find(
      coupon => coupon.fields.code === req.body.coupon.code
    )
    if (activeCoupon) {
      totalAmount =
        totalAmount * ((100 - activeCoupon.fields.discountAmount) / 100)
    }
  } catch (e) {
    return res.status(500).json({ error: e })
  }
  try {
    const response = await stripe.charges.create({
      amount: totalAmount,
      currency: 'aud',
      description: `Purchase from Writelabs`,
      source: request.token,
      receipt_email: request.email
    })
    res.send(response)
    const msg = {
      to: 'joshxli.io@gmail.com',
      from: 'lisachentran@gmail.com',
      subject: 'Yay, new purchase! 🥳',
      // text: 'and easy to do anywhere, even with Node.js',
      html: `<p>New purchase made by a ${request.email}</>. 
      <ul>
   
      </ul>`
    }
    sgMail.send(msg)
  } catch (e) {
    return res.status(402).json({ error: e.message })
  }
})

app.post('/update', async (req, res) => {
  const response = req.body
  const params = { id: response.userId }
  var metadata = {
    books: response.books
  }
  auth0.updateAppMetadata(params, metadata, function(err, user) {
    if (err) {
      console.log(err)
      return res.status(500).json({ error: err })
    }
    res.send(user)
  })
})

app.post('/save-book-location', async (req, res) => {
  const response = req.body
  const params = { id: response.userId }
  var metadata = {
    books: response.books
  }
  auth0.updateAppMetadata(params, metadata, function(err, user) {
    if (err) {
      return res.status(500).json({ error: err })
    }
    res.send(user)
  })
})

app.post('/create-review', async (req, res) => {
  const response = req.body
  managementClient
    .getSpace(process.env.CONTENTFUL_SPACE_ID)
    .then(space =>
      space.createEntry('reviews', {
        fields: {
          rating: {
            'en-US': response.rating
          },
          review: {
            'en-US': response.review
          },
          name: {
            'en-US': response.name
          },
          date: {
            'en-US': new Date()
          },
          book: {
            'en-US': {
              sys: {
                type: 'Link',
                linkType: 'Entry',
                id: response.book
              }
            }
          }
        }
      })
    )
    .then(entry => {
      managementClient
        .getSpace(process.env.CONTENTFUL_SPACE_ID)
        .then(space => space.getEntry(entry.sys.id))
        .then(entry => entry.publish())
        .then(response => res.send(response))
        .catch(error => console.log(error))
    })
    .catch(console.error)
})

app.listen(process.env.PORT || 9000, () =>
  console.log('Listening on port 9000')
)
