const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const yaml = require('yaml');
const fs = require('fs');

const openApiPath = './doc/openapi.yaml'
const file = fs.readFileSync(openApiPath, 'utf8')

const swaggerDocument = yaml.parse(file)

const app = express();
const PORT = 3005;


const SECRET_KEY = "test";
const MONGO_URI =
  "mongodb://mongo:PpXsLRxYF4RWO96YLtZh@containers-us-west-82.railway.app:5756";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(bodyParser.json());
app.use('api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const roles = ["maker", "approver"];

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: roles, required: true },
  });
  
  const User = mongoose.model("User", UserSchema);
  
  const TransferRequestSchema = new mongoose.Schema({
    username: { type: String, required: true },
    role: { type: String, enum: roles, required: false },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    sourceAccount: { type: Number, required: true },
    destinationAccount: { type: Number, required: true },
    state: { type: String, default: "pending" },
  });
  
  const TransferRequest = mongoose.model(
    "TransferRequest",
    TransferRequestSchema
  );
  
  // INI MIDDLEWARE
  const validateRole = (req, res, next) => {
    const { role } = req.body;
    if (!roles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    next();
  };
  
  // Define the validatePassword middleware function
  const validatePassword = (req, res, next) => {
    const { password } = req.body;
    if (
      !password ||
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return res.status(400).json({
        error:
          "Invalid password. Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.",
      });
    }
    next();
  };
  
  const validateUsername = (req, res, next) => {
    const { username } = req.body;
    if (!username || username.trim() === "") {
      return res
        .status(400)
        .json({ error: "Invalid username. Username cannot be blank." });
    }
    next();
  };
  
  const authenticateUser = (req, res, next) => {
    let token = req.headers.authorization;
    if (token && token.startsWith("Bearer ")) {
         token = token.substring(7); // Menghilangkan "Bearer " dari awal string
        // Sekarang token hanya berisi nilai token sebenarnya
        // Lanjutkan dengan verifikasi token atau tindakan lain yang Anda butuhkan
      }


    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(token);
  
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        console.log(err);
        return res.status(403).json({ error: "Forbidden verify failed" });
      }
      req.user = user;
      next();
    });
  };
  
  // Authentication endpoint
  app.post("/auth", async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const user = await User.findOne({ username });
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
  
      const token = jwt.sign(
        { username: user.username, role: user.role },
        SECRET_KEY
      );
      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({ error: "An error occurred" });
    }
  });
  
  // Create user endpoint
  app.post("/create-user", async (req, res) => {
    const { username, role, password } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);
  
    try {
      const user = new User({ username, role, passwordHash });
      await user.save();
      res.status(200).json({ message: "User created successfully" });
    } catch (error) {
      console.error(error); // Log the error for debugging purposes
      res.status(500).json({ error: "An error occurred" });
    }
  });

  app.get("/users", async (req, res) => {
    try {
      const users = await User.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "An error occurred" });
    }
  });
  
  app.post("/check-login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await User.findOne({ username });
      console.log(bcrypt.compareSync(password, user.passwordHash));
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { username: user.username, role: user.role },
        SECRET_KEY
      );
      res.status(200).json({ message: "Login successful", token:token });
    } catch (error) {
        console.log(error);
      res.status(500).json({ error: "An error occurred" });
    }
  });


  //blmcek postman
  app.post("/create-transfer-request", authenticateUser, async (req, res) => {
    const { amount, currency, sourceAccount, destinationAccount } = req.body;
    const { role, username } = req.user;
    
    if (role === "maker" || role === "approver") {
        console.log("neeyoooooo");
      try {
        const transferRequest = new TransferRequest({
          username,
          amount,
          currency,
          sourceAccount,
          destinationAccount
        });
        
        await transferRequest.save();
        res.json({ message: "Transfer request created successfully" });
      } catch (error) {
        // console.log(error);

        res.status(500).json({ error: "An error occurred" });
      }
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  });
  
  app.get("/transfer-list", authenticateUser, async (req, res) => {
    const { role } = req.user;
    if (roles.includes(role)) {
      try {
        const transferRequests = await TransferRequest.find();
        res.json(transferRequests);
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  });
  
  /*app.post("/approve-transfer-request", authenticateUser, async (req, res) => {
    const { status, id } = req.body;
    
    const { role } = req.user;
    if (role === "approver") {

        const updatedTransferRequest = await TransferRequest.findByIdAndUpdate(
            id,
            {
              state : status,
            },
          );
          if (!updatedTransferRequest) {
      res.json({ message: "Transfer request approved/rejected successfully" });
          }
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  });*/
  
  app.put("/update-transfer-request/:id", authenticateUser, async (req, res) => {
    const { role } = req.user;
    if (role === "maker" || role === "approver") {
      try {
        const { id } = req.params;
        const { amount, sourceAccount, destinationAccount } = req.body;
  
        const updatedTransferRequest = await TransferRequest.findByIdAndUpdate(
          id,
          {
            amount,
            sourceAccount,
            destinationAccount,
          },
          { new: true }
        );
  
        if (!updatedTransferRequest) {
          return res.status(404).json({ error: "Transfer request not found" });
        }
  
        res.json({ message: "Transfer request updated successfully" });
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  });


  /*app.post("/approve-transfer-request", authenticateUser, async (req, res) => {
    const { role } = req.user;
    if (role === "approver") {
      // Logic to approve or reject transfer request
      res.json({ message: "Transfer request approved/rejected successfully" });
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  });*/

  app.put("/update-transfer-status/:id", authenticateUser, async (req, res) => {
    const { role } = req.user;
    if (role === "approver") {
      try {
        const { id } = req.params;
        const { status } = req.body;
  
        if (status !== "approved" && status !== "rejected") {
          return res.status(400).json({ error: "Invalid status value" });
        }
  
        const updatedTransferRequest = await TransferRequest.findByIdAndUpdate(
          id,
          { state: status },
          { new: true }
        );
  
        if (!updatedTransferRequest) {
          return res.status(404).json({ error: "Transfer request not found" });
        }
  
        res.json({
          message: `Transfer request status updated to ${status} successfully`,
        });
      } catch (error) {
        res.status(500).json({ error: "An error occurred" });
      }
    } else {
      res.status(403).json({ error: "Unauthorized" });
    }
  });
  
 // Definisikan fungsi softDeleteTransferRequest di luar penanganan permintaan
const softDeleteTransferRequest = async ({ TransferRequest, id }) => {
    try {
      const updatedTransferRequest = await TransferRequest.findByIdAndUpdate(
        id,
        {
          deletedAt: new Date(),
          updatedAt: new Date(),
        }
      );
  
      if (!updatedTransferRequest) {
        throw new Error("Transfer request not found");
      }
    } catch (error) {
      throw error;
    }
  };
  
  // Penanganan permintaan DELETE untuk soft delete
  app.delete("/delete-transfer-request/:id", authenticateUser, async (req, res) => {
    const { id } = req.params;
  
    try {
      await softDeleteTransferRequest({ TransferRequest, id });
      res.json({ message: "Transfer request soft deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  