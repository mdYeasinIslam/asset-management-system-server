require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt =require('jsonwebtoken')
const app = express()
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
          const result = await userCollection.insertOne(body)
          res.send(result)
      })
      app.get('/users', async (req, res) => {
        const email = req.query.email
          const result =await userCollection.find().toArray()
          const filterUser = result.filter(user => user.email == email)
          const role = filterUser[0].role
          res.send({result,role,userInfo:filterUser});
      })
    //-------------Assets related api Hr manager-------------
    app.post('/assets', async (req, res) => {
      const body = req.body;
      const result = await productCollection.insertOne(body)
      res.send(result)
    })
    app.get('/assets', async (req, res) => {
      const name = req.query.name;
      const availability = req.query.availabilty
      const filter = { "name": { $regex: name, $options: 'i' } }
      //filter base on search (name)
      if (name) {
        const filterAssets = await productCollection.find(filter).toArray()
        if (!filterAssets.length) {
          return res.status(404).send({message:'There is no assets according to your search.Please serach with correct name'})
        }
        // return res.send(filterAssets)
        if (!filterAssets.length) {
          return res.status(404).send({message:'There is no assets according to your search.Please serach with correct name'})
        }
        return res.send(filterAssets)
      }
      //filter base on availability :(available or out-of-stock)
      else if (availability) {
        
        console.log(availability)
        const filterAssets = await productCollection.find().toArray()
        if (availability =='available') {
          const filterBaseOnQuantity = filterAssets.filter(asset => asset.quantity > 0);
          console.log(filterBaseOnQuantity)
          return res.send(filterBaseOnQuantity)
        }
        if (availability == 'outOfStock') {
          const filterBaseOnQuantity = filterAssets.filter(asset => asset.quantity == 0);
             console.log(filterBaseOnQuantity)
            return res.send(filterBaseOnQuantity)
        }
        // if (!filterAssets.length) {
        //   return res.status(404).send({message:'There is no assets according to your search.Please serach with correct name'})
        // }
        // return res.send(filterAssets)
      }
        
      else {
        const result = await productCollection.find().toArray()
        res.send(result)
      }
    })
    app.delete('/assets/:id', async (req, res) => {
      const id = req.params.id
      console.log(id)
      const filter = {_id:new ObjectId(id)}
      const findAssets = await productCollection.deleteOne(filter)
      res.send(findAssets)
    })
    app.put('/assets/:id',async(req,res)=>{
      const id = req.params.id
      const info = req.body;
      console.log(id, info)
      const filter ={_id:new ObjectId(id)}
      const doc = {
        $set: {
          name:info.name,
          type:info.type,
          quantity:info.quantity,
          date: info.date,
          status:info.status
        }
      }
      const update = await productCollection.updateOne(filter, doc)
      res.send(update)
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