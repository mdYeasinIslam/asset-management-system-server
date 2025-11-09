require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  Decimal128,
} = require("mongodb");
const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_pass}@cluster0.bfv30pl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.use(
  cors({
    origin: [
      "https://coruscating-lebkuchen-a1fe95.netlify.app",
      'https://asset-pulse-system.netlify.app',
      "http://localhost:5173",
      "https://assetpulse.vercel.app",
    ],
  })
);
app.use(express.json());

const varifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unAuthorized access" });
  }
  const token = req.headers.authorization?.split(" ")[1];
  // process.env.jwt_secret
  jwt.verify(token, "hasan1234", (err, decode) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unAuthorized access" });
    }
    req.decoded = decode;
    next();
  });
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // console.log('conneted')
    const database = client.db("Asset-Management-System");
    const userCollection = client
      .db("Asset-Management-System")
      .collection("Users");
    const productCollection = client
      .db("Asset-Management-System")
      .collection("Products");
    const assetRequestCollection = database.collection("Request_for_asset");
    const employeeCollection = database.collection("Employees-Data");
    //------------jwt---------------
    app.post("/jwt", async (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, "hasan1234", { expiresIn: "1h" });
      res.send(token);
    });
    // process.env.jwt_secret

    const varifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //get single user and check is the "Admin" or not, via variafytoke midlewire
    app.get("/users/admin/:email", varifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const filter = { email: email };
      const findUser = await userCollection.findOne(filter);
      let admin = false;

      if (findUser && findUser.role == "Admin") {
        admin = true;
      }
      res.send({ admin });
    });

    //----------user related api ----------------
    app.post("/users", async (req, res) => {
      const body = req.body;
      const result = await userCollection.insertOne(body);
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const email = req.query?.email;
      const result = await userCollection.find().toArray();
      //console.log(email,result)
      const filterUser = result.filter((user) => user.email == email);
      const filterEmployee = result.filter((user) => user.role == "Employee");
      const role = filterUser[0]?.role;
      res.send({
        result,
        role,
        userInfo: filterUser,
        employee: filterEmployee,
      });
    });
    // delete user
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const deleteUser = await userCollection.deleteOne(filter);
      res.send(deleteUser);
    });
    //-------------Assets related api Hr manager-------------
    app.post("/assets", async (req, res) => {
      const body = req.body;
      const filter = { name: body.name };
      const findAssets = await productCollection.findOne(filter);
      if (findAssets == null) {
        const result = await productCollection.insertOne(body);
        return res.send(result);
      }
      res.send({ message: "This product is already exist in your asset list" });
    });
    app.get("/assets", varifyToken, async (req, res) => {
      const isPublic = req.query.public;
      if (isPublic == undefined) {
        //------------check actual admin------------------
        const decodeEmail = req.decoded.email;
        const findUser = { hr_email: decodeEmail };
        //-----------------------------------------------------

        //--------filter for search----------------------------
        const name = req.query.name;
        const availability = req.query.availabilty;
        // const filter = { "name": { $regex: name, $options: 'i' } }
        const filter = {
          $and: [
            { name: { $regex: name, $options: "i" } },
            { hr_email: decodeEmail },
          ],
        };
        //filter base on search (name)
        if (name?.length > 0) {
          const filterAssets = await productCollection.find(filter).toArray();
          if (!filterAssets.length) {
            return res.status(404).send({
              message:
                "There is no assets according to your search.Please serach with correct name",
            });
          }
          //  if (!filterAssets.length) {
          //    return res.status(404).send({message:'There is no assets according to your search.Please serach with correct name'})
          //  }
          return res.send(filterAssets);
        }
        //filter base on availability :(available or out-of-stock)
        else if (availability) {
          const filterAssets = await productCollection.find().toArray();
          if (availability == "available") {
            const filterBaseOnQuantity = filterAssets.filter(
              (asset) => asset.quantity > 0
            );
            return res.send(filterBaseOnQuantity);
          }
          if (availability == "outOfStock") {
            const filterBaseOnQuantity = filterAssets.filter(
              (asset) => asset.quantity == 0
            );
            return res.send(filterBaseOnQuantity);
          }
          // if (!filterAssets.length) {
          //   return res.status(404).send({message:'There is no assets according to your search.Please serach with correct name'})
          // }
          // return res.send(filterAssets)
        }
        //----------------send all assets of each HR or company
        else {
          const result = await productCollection.find(findUser).toArray();
          return res.send(result);
        }
      }

      //------------when public request-----------------
      //--------filter for search----------------------------
      const name = req.query.name;
      const availability = req.query.availabilty;
      const filter = { name: { $regex: name, $options: "i" } };
      //filter base on search (name)
      if (name?.length > 0) {
        const filterAssets = await productCollection.find(filter).toArray();
        if (!filterAssets.length) {
          return res.status(404).send({
            message:
              "There is no assets according to your search.Please serach with correct name",
          });
        }
        return res.send(filterAssets);
      }
      //filter base on availability :(available or out-of-stock)
      else if (availability) {
        const filterAssets = await productCollection.find().toArray();
        if (availability == "available") {
          const filterBaseOnQuantity = filterAssets.filter(
            (asset) => asset.quantity > 0
          );
          return res.send(filterBaseOnQuantity);
        }
        if (availability == "outOfStock") {
          const filterBaseOnQuantity = filterAssets.filter(
            (asset) => asset.quantity == 0
          );
          return res.send(filterBaseOnQuantity);
        }
      }
      //----------------send all assets of all HR or company
      else {
        const result = await productCollection.find().toArray();
        return res.send(result);
      }
    });

    app.delete("/assets/:id", varifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const findAssets = await productCollection.deleteOne(filter);
      res.send(findAssets);
    });
    app.put("/assets/:id", varifyToken, async (req, res) => {
      const id = req.params.id;
      const info = req.body;
      const filter = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          name: info.name,
          type: info.type,
          quantity: info.quantity,
          date: info.date,
          status: info.status,
        },
      };
      const update = await productCollection.updateOne(filter, doc);
      res.send(update);
    });

    // ----------------------employee: asset request and save it to the DB--------------------
    app.post("/employee/assetRequest", varifyToken, async (req, res) => {
      const reqInfo = req.body;
      const email = req.query.email;
      const filterEmail = { requesterEmail: email };
      // const filter = { assetName: reqInfo.assetName }
      const findAsset = await assetRequestCollection
        .find(filterEmail)
        .toArray();
      const checkAssetAvailability = findAsset.filter(
        (asset) =>
          asset.assetName.toLowerCase() == reqInfo.assetName.toLowerCase()
      );

      if (checkAssetAvailability.length == 0) {
        const result = await assetRequestCollection.insertOne(reqInfo);
        return res.send(result);
      }
      res.send({
        message: "You are already send the request for this asset",
        success: false,
      });
    });
    app.get("/employee/assetRequest", async (req, res) => {
      const email = req.query?.email;
      const filter = { requesterEmail: email };
      if (email) {
        const result = await assetRequestCollection.find(filter).toArray();
        return res.send(result);
      }
      const result = await assetRequestCollection.find().toArray();
      res.send(result);
    });
    //Hr update the request status (approved or reject)
    app.put("/employee/assetRequest/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: body.value,
          updateDate: body.updateDate,
          companyName: body.companyName,
          company_logo: body.companyLogo,
        },
      };
      const update = await assetRequestCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send({ update, value: body.value });
    });
    app.delete("/employee/assetRequest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const deleteItems = await assetRequestCollection.deleteOne(filter);
      res.send(deleteItems);
    });
    //employee update (approved item can status change: if returnable then change status:return)
    app.patch("/employee/assetRequest/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          assetStatus: body.value,
        },
      };
      const result = await assetRequestCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // ----------------------------------------Hr Add employee api----------------
    app.post("/hr/addEmployee", async (req, res) => {
      const employee = req.body;

      const filter = { email: employee.email };
      const findDuplicate = await employeeCollection.findOne(filter); //find same employee from employee collection
      const updateDoc = {
        $set: {
          canRequestForAsset: employee?.havePermission,
        },
      };
      const options = { upsert: true };

      const updatePermission = await userCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      console.log(updatePermission);
      const filterHr = { email: employee.hrEmail };
      const findHr = await userCollection.findOne(filterHr); ///find hr package limit
      const packageLimit = findHr?.package?.split("_")[0];

      const hrTotalEmployee = { hrEmail: employee.hrEmail };
      const TotalEmployee = await employeeCollection
        .find(hrTotalEmployee)
        .toArray(); //check how much employee add by a hr

      if (findDuplicate == null) {
        if (TotalEmployee.length >= packageLimit) {
          return res.send({
            status: false,
            message: `Package limit over!!  your can add ${packageLimit} employee only. `,
          });
        }
        const result = await employeeCollection.insertOne(employee);
        return res.send(result, updatePermission);
      }
      res.send({
        message: "This employee is already in your team",
        status: false,
      });
    });

    app.post("/hr/addEmployee/array", async (req, res) => {
      const employeeArray = req.body;

      let newEmployee = [];
      for (const employee of employeeArray) {
        const findExist = await employeeCollection.findOne({
          email: employee.email,
        });
        if (!findExist) {
          if (employee._id) {
            const removeId = Object.assign(
              {},
              { employeeId: employee._id, ...employee }
            );
            delete removeId._id;
            newEmployee.push(removeId);
          }
        }
      }

      if (newEmployee.length > 0) {
        const result = await employeeCollection.insertMany(newEmployee);
        return res.send(result);
      }
      res.send({
        status: false,
        message: "All member are already in your team",
      });
    });

    app.get("/hr/addEmployee", async (req, res) => {
      const result = await employeeCollection.find().toArray();
      res.send(result);
    });
    app.delete("/hr/addEmployee/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await employeeCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is runngn");
});

app.listen(port, () => console.log("server is running on ", port));
