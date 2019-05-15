require('dotenv').config({path: __dirname + '/.env'})
const app = require("express")();
const stripe = require("stripe")(process.env.STRIPE_KEY)
var contentful = require('contentful');
const axios = require("axios");
var bodyParser = require('body-parser')

var client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN
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
  // get the prices of all the books first
  //refactor this so there's no need to filter down the track
  client.getEntries({
    content_type:'book',
  })
  .then(function (entries) {
    totalAmount = entries.items
      .filter(item => request.items.includes(item.fields.title))
      .map(item => Math.round(Number(item.fields.price)*100))
      .reduce((acc, val) => acc + val);
    stripe.charges.create({
      amount: totalAmount,
      currency: "aud",
      description: "An example charge",
      source: request.token
    })
    .then(response => {
      res.send(response)}
    )
    //this catches declined transactions
    .catch(err => {
      return res.status(402).json({error: err.message})
    })    

  })
  .catch(function(err) {
    //this is catching contentful errors
    //what happens IF this fails?
    return res.status(500).json({error: err})
  })
});


app.post("/update", async (req, res) => {
  const response = req.body
  console.log("body", req.body)
  var token ="";
  const url = 'https://athena.au.auth0.com/oauth/token';
  const options = {
    headers: { 
      'content-type': 'application/json' ,
    }
  }
  const data = { 
    "client_id":process.env.AUTH0_CLIENT_ID,
    "client_secret":process.env.AUTH0_CLIENT_SECRET,
    "audience":"https://athena.au.auth0.com/api/v2/",
    "grant_type":"client_credentials" 
  }

  try {
    const result = await axios.post(url, data,options)
    token = await result.data["access_token"]
  } 
  catch(e) {
    console.log("error in the post request", e.message)
  }
  try {
    const headers = { Authorization: `Bearer ${token}` }
    const result = await axios.patch(`https://athena.au.auth0.com/api/v2/users/${response.userId}`, {
      app_metadata: {
        books: response.bookIds
      }
    }, headers)
    console.log("patch request successful", result)
  } 
  catch(e) {
    console.log("error in the patch request", e.message)
  }
  
})


app.listen((process.env.PORT || 9000), () => console.log("Listening on port 9000"))

// axios.post(url, data, options)
  // .then(result => {
  //   token = result.data["access_token"]
  //   var patchOptions = {
  //     url: `https://athena.au.auth0.com/api/v2/users/${response.userId}`,
  //     headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  //   }
  //   return axios.patch(patchOptions.url, {
  //     app_metadata: {
  //       books: response.bookIds
  //     }
  //   }, patchOptions.headers)
  //   .then(result => res.send(result))
  //   .catch(err => res.status(500).json(err))
  // })
  // .then(result => res.send(result))
  // .catch(err => console.log("there's an error", err))