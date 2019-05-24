require('dotenv').config()
const app = require("express")();
const stripe = require("stripe")(process.env.STRIPE_KEY)
var contentful = require('contentful');
const axios = require("axios");
var bodyParser = require('body-parser')
var ManagementClient = require('auth0').ManagementClient;

var client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN
})

var auth0 = new ManagementClient({
  domain: `athena.au.auth0.com`,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  scope: "read:users update:users update:users_app_metadata read:users_app_metadata",
  audience: "https://athena.au.auth0.com/api/v2/",
  tokenProvider: {
    enableCache: true,
    cacheTTLInSeconds: 10
  }
})

app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

app.get("/", (req, res) => {
  res.send("Hello world")
})

app.post("/charge", async (req, res) => {
  var request = req.body;
  var totalAmount = 0;
  try {
    const entries = await client.getEntries({
      content_type:'book',
    })
    totalAmount = entries.items
      .filter(item => request.items.includes(item.fields.title))
      .map(item => Math.round(Number(item.fields.price)*100))
      .reduce((acc, val) => acc + val);
  } catch(e) {
    return res.status(500).json({error: e})
  }
  try {
    const response = await stripe.charges.create({
      amount: totalAmount,
      currency: "aud",
      description: "An example charge",
      source: request.token
    })
    res.send(response)
  } catch(e) {
    return res.status(402).json({error: e.message})
  }
});

app.post("/update", async (req, res) => {
  const response = req.body
  const params = {id: response.userId};
  var metadata = {
    books: response.books
  }
  auth0.updateAppMetadata(params, metadata, function(err, user) {
    if (err) {
      return res.status(500).json({error: err})
    }
    res.send(user)
  })
})


app.post('/save-book-location', async (req, res) => {
  const response = req.body
  const params = {id: response.userId}
  var metadata = { 
    books: response.books
  }
  auth0.updateAppMetadata(params,metadata, function(err, user) {
    if (err) {
      return res.status(500).json({error:err})
    }
    res.send(user)
  })
})


app.listen((process.env.PORT || 9000), () => console.log("Listening on port 9000"))
