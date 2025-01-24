require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt =require('jsonwebtoken')
const app = express()
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_pass}@cluster0.bfv30pl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


app.use(cors())
app.use(express.json())

const varifyToken =async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({message:"unAuthorized access"})
  }
  const token = req.headers.authorization?.split(' ')[1]
  jwt.verify(token,process.env.jwt_secret, (err, decode) => {
    if (err) {
      return res.status(401).send({message:"unAuthorized access"})
    }
    req.decoded = decode
    next()
  })
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      
    const userCollection = client.db('Asset-Management-System').collection('Users')
    const productCollection = client.db('Asset-Management-System').collection('Products')
    //------------jwt---------------
     app.post('/jwt', async (req, res) => {
      const userInfo = req.body
      const token = jwt.sign(userInfo,process.env.jwt_secret, { expiresIn: '1h' })
      res.send(token)
     })
     const varifyAdmin = async(req,res,next) => {
    const email = req.decoded.email
    const query = { email: email }
      const user = await usersCollection.findOne(query)
      const isAdmin = user?.role === 'Admin'
      if (!isAdmin) {
        return res.status(403).send({message:'forbidden access'})
      }
      next()
    
   }
    //----------user related api ----------------
      app.post('/users', async (req, res) => {
          const body = req.body;
          console.log(body);
          const result = await userCollection.insertOne(body)
          console.log(result)
          res.send(result)
      })
      app.get('/users', async (req, res) => {
        const email = req.query.email
          const result =await userCollection.find().toArray()
          const filterUser = result.filter(user => user.email == email)
          const role = filterUser[0].role
          res.send({result,role,userInfo:filterUser});
      })
    //-------------Product related api -------------
    app.post('/products', async (req, res) => {
      const body = req.body;
      console.log(body)
      const result = await productCollection.insertOne(body)
      res.send(result)
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Server is runngn')
})

app.listen(port,()=>console.log('server is running on ',port))