const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require('crypto')
const path = require('path')
const upload = require('./config/multerconfig')
// const multer = require('multer')

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/register", (req, res) => {
  res.render("index");  // Make sure you have a register.ejs file
});

app.get("/profileupload", (req, res) => {
  res.render("profileupload");
});

app.post("/upload", isLoggedIn, upload.single('image'), async (req, res) => {
  let user = await userModel.findOne({email: req.user.email})
  user.profilepic = req.file.filename
  await user.save()
  res.redirect('/profile')
});

// app.get("/test", (req, res) => {
//   res.render("test");
// });

// app.post("/upload", upload.single('image'), (req, res) => {
//   console.log(req.file)
// });

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/register", async (req, res) => {
  let { email, password, name, age, username } = req.body;

  let user = await userModel.findOne({ email });
  if (user) {
    return res.status(400).send("User already registered. Try logging in.");
  }

  bcrypt.hash(password, 10, async (err, hash) => {
    if (err) {
      return res.status(500).send("Error hashing password.");
    }

    let newUser = await userModel.create({
      username,
      email,
      age,
      name,
      password: hash,
    });

    let token = jwt.sign({ email: email, userid: newUser._id }, "secretKey");
    res.cookie("token", token);
    res.redirect("/profile");  // Redirect to profile after registration
  });
});


app.post("/login", async (req, res) => {
  let { email, password } = req.body;

  let user = await userModel.findOne({ email });
  if (!user) return res.status(500).send("something went wrong");

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "secretKey");
      res.cookie("token", token);
      res.status(200).redirect("/profile");
    } else res.redirect("/login");
  });
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
  res.render("profile", { user });
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel
    .findOne({ _id: req.params.id }).populate('user')
  res.render("edit", {post});
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel
    .findOneAndUpdate({_id: req.params.id }, {content: req.body.content})
  res.redirect("/profile");
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");

  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid)
  }else{
    post.likes.splice(post.likes.indexOf(req.user.userid), 1)
  }
  await post.save();
  res.redirect("/profile");
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;

  let post = await postModel.create({
    user: user._id,
    content,
  });

  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

function isLoggedIn(req, res, next) {
  if (req.cookies.token === "") res.redirect("/login");
  else {
    let data = jwt.verify(req.cookies.token, "secretKey");
    req.user = data;
    next();
  }
}

app.listen(3000);
