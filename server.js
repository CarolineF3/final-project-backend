import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import listEndpoints from "express-list-endpoints";
import crypto from "crypto";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import cloudinaryFramework from "cloudinary";
import multer from "multer";
import cloudinaryStorage from "multer-storage-cloudinary";

import itemsInStore from "./itemsInStore";

dotenv.config();

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/foretaget";
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
});
mongoose.Promise = Promise;

const ItemSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  isfeatured: {
    type: Boolean,
    required: true,
  },
});

const UserSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
  },
  lastname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
});

const CartSchema = new mongoose.Schema({
  items: { type: Array },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const Item = mongoose.model("Item", ItemSchema);

const User = mongoose.model("User", UserSchema);

const Cart = mongoose.model("Cart", CartSchema);

if (process.env.RESET_DB) {
  const seedDB = async () => {
    await Item.deleteMany();
    itemsInStore.items.forEach(async (item) => {
      const newItem = await new Item(item);
      await newItem.save();
    });
  };
  seedDB();
}

const authenticateUser = async (req, res, next) => {
  const accessToken = req.header("Authorization");
  try {
    const user = await User.findOne({ accessToken });
    if (user) {
      next();
    } else {
      res.status(401).json({ success: false, message: "Not authorized" });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error });
  }
};

const port = process.env.PORT || 8080;
const app = express();

app.use(
  cors({
    origin: "https://stay-witchy.netlify.app",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send(listEndpoints(app));
});

app.post("/signup", async (req, res) => {
  const { firstname, lastname, email, password } = req.body;

  try {
    const salt = bcrypt.genSaltSync();

    const newUser = await new User({
      firstname,
      lastname,
      email,
      password: bcrypt.hashSync(password, salt),
    }).save();
    const newCart = await new Cart({
      items: [],
      userId: newUser._id,
    }).save();

    res.json({
      success: true,
      userID: newUser._id,
      accessToken: newUser.accessToken,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error });
  }
});

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      if (bcrypt.compareSync(password, user.password)) {
        res.json({
          success: true,
          userID: user._id,
          accessToken: user.accessToken,
        });
      } else {
        res.status(401).json({ success: false, message: "Wrong password" });
      }
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error });
  }
});

app.get("/items", async (req, res) => {
  const { category, featured } = req.query;
  if (category) {
    try {
      const items = await Item.find({ category: category });
      res.status(200).json(items);
    } catch (error) {
      res.status(400).json({ error: "Something went wrong", details: error });
    }
  } else if (featured) {
    try {
      const items = await Item.find({ isfeatured: featured });
      res.status(200).json(items);
    } catch (error) {
      res.status(400).json({ error: "Something went wrong", details: error });
    }
  } else {
    try {
      const items = await Item.find();
      res.status(200).json(items);
    } catch (error) {
      res.status(400).json({ error: "Something went wrong", details: error });
    }
  }
});

app.get("/items/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const item = await Item.findById(id).exec();
    res.json(item);
  } catch {
    res
      .status(400)
      .json({ error: "Failed to fetch item from database", details: error });
  }
});

app.get("/cart/:id", authenticateUser);
app.get("/cart/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const cart = await Cart.findOne({ userId: id });
    res.json(cart);
  } catch {
    res.status(400).json({ error: "Failed to fetch cart from database" });
  }
});

app.post("/cart/:id", authenticateUser);
app.post("/cart/:id", async (req, res) => {
  const { id } = req.params;
  const { itemList } = req.body;
  try {
    const cart = await Cart.findOne({ userId: id });
    const filter = { userId: id };
    const update = { items: itemList };

    let newCart = await Cart.findOneAndUpdate(filter, update, {
      new: true,
    });
    res.json(newCart);
  } catch {
    res
      .status(400)
      .json({ error: "Failed to fetch cart from database", details: error });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line
  console.log(`Server running on http://localhost:${port}`);
});
