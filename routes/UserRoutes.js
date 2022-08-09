const express = require("express");
const router = express.Router({ mergeParams: true });
const bcrypt = require("bcrypt");
// import { v4 as uuidv4 } from "uuid";
// const uuidv4 = require("uuid/v4");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const Task = require("../models/Task");
const Thread = require("../models/Thread");

// const passport = require("passport");

const { sendNotification_contact } = require("../Middleware");

// used to return search results from the database to the client Searchbar
router.post("/search", async (req, res) => {
  let users;
  users = await User.find({ name: { $regex: req.body.name, $options: "i" } });

  if (users) {
    const users_trimmed = users.map((user) => {
      user = user.toObject();
      delete user.passwordHash;
      delete user.contacts;
      delete user.notifications;
      delete user.settings;
      delete user.session;
      return user;
    });
    res.status(200).send(users_trimmed);
  } else {
    res.status(404).send("No users found");
  }
});

//new user
// router.post("/", async (req, res) => {
//   const userData = req.body;
//   // console.log(userData);
//   try {
//     const newUser = new User({
//       email: userData.email,
//       name: userData.name,
//     });
//     await newUser.save();
//     res.status(200).send(newUser);
//   } catch (err) {
//     res.status(500).send(err);
//   }
// });

//get user by id
router.get("/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    let user = await User.findById(userId);
    user = user.toObject();
    delete user.passwordHash;
    delete user.contacts;
    delete user.notifications;
    delete user.settings;
    delete user.session;
    res.status(200).send(user);
  } catch (err) {
    res.status(500).send(err);
  }
});

// used to return profile data on Profile.js
router.post("/profile", async (req, res) => {
  const { userID, profileID } = req.body;
  // console.log(
  //   "/profile reached with userID: " + userID + " and profileID: " + profileID
  // );
  try {
    let profile = await User.findById(profileID);
    const sentTasks = await Task.find({
      owner: userID,
      recipients: profileID,
    })
      .populate("owner")
      .populate("recipients");
    const receivedTasks = await Task.find({
      owner: profileID,
      recipients: userID,
    })
      .populate("owner")
      .populate("recipients");
    // console.log({ sentTasks, receivedTasks });
    profile = profile.toObject();
    delete profile.passwordHash;
    delete profile.contacts;
    delete profile.notifications;
    delete profile.settings;
    delete profile.session;
    res.send({ profile, sentTasks, receivedTasks });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

router.post("/signup", async (req, res) => {
  const { email, name, password } = req.body;
  try {
    const passwordSalt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, passwordSalt);

    const session = uuidv4();

    let newUser = new User({ email, name, passwordHash, session });
    await newUser.save();
    newUser = newUser.toObject();
    delete newUser.passwordHash;
    res.send(newUser);
    // res.send("new user route reached with body: ", req.body);
  } catch (err) {
    console.log(err);
    res.send(err);
  }
});

router.post("/poll", async (req, res) => {
  const { userID, session } = req.body;
  const user = await User.findOne({ _id: userID, session });
  res.send(user);
});

router.post("/signin", async (req, res) => {
  // console.log("signed in successfully, req.user: ", req.user);
  const { email, password } = req.body;

  let user = await User.findOne({ email });

  if (user) {
    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
    if (isPasswordMatch) {
      user.session = uuidv4();
      await user.save();
      user = user.toObject();
      delete user.passwordHash;
      delete user.contacts;
      // delete user.notifications;
      // delete user.settings;
      // delete user.session;
      res.send(user);
    } else {
      res.send({ error: "Invalid email or password" });
    }
  } else {
    res.send({ error: "Invalid email or password" });
  }
});

router.post("/logout", async (req, res) => {
  // console.log("logout route reached");
  // req.logout(() => {});
  const { userID } = req.body;
  const user = await User.findById(userID);
  user.session = "terminated";
  res.status(200).send("logged out");
});

router.post("/toggleContact", sendNotification_contact, async (req, res) => {
  const { userID, contactID, contactName } = req.body;
  let user = await User.findById(userID);

  if (user.contacts.find((obj) => obj.id === contactID)) {
    // console.log("contact already exists,", contactName);
    user.contacts = user.contacts.filter((obj) => obj.id !== contactID);
  } else {
    // console.log("contact does not exist,", contactName);
    user.contacts.push({ name: contactName, id: contactID });
  }

  await user.save();
  user = user.toObject();
  delete user.passwordHash;
  delete user.contacts;
  delete user.notifications;
  delete user.settings;
  delete user.session;

  res.status(200).send(user);
});

router.post("/getNotifications", async (req, res) => {
  const { userID } = req.body;
  const user = await User.findById(userID);
  if (user) {
    const notifications = user.notifications;
    res.send(notifications);
  } else {
    res.status(404);
  }
});

router.post("/deleteNotification", async (req, res) => {
  // console.log("delete body: ", req.body);
  let user = await User.findById(req.body.userID);
  user.notifications = user.notifications.filter((notif) => {
    return notif._id != req.body.notif_ID;
  });
  await user.save();
  user = user.toObject();
  delete user.passwordHash;
  delete user.contacts;
  // delete user.notifications;
  delete user.settings;
  delete user.session;

  res.send(user);
});

router.post("/settings", async (req, res) => {
  const {
    userID,
    name,
    bio,
    messageNotifications,
    taskNotifications,
    contactNotifications,
  } = req.body;
  // console.log(req.body);
  let user = await User.findById(userID);
  if (user) {
    user.name = name;
    user.bio = bio;
    user.settings = {
      messageNotifications,
      taskNotifications,
      contactNotifications,
    };
    await user.save();
  }

  delete user.passwordHash;
  delete user.contacts;
  delete user.notifications;
  // delete user.settings;
  delete user.session;
  res.send(user);
});

router.post("/deleteUser", async (req, res) => {
  const { userID } = req.body;
  const deletingUser = await User.findById(userID);
  try {
    const userTasks_created = await Task.find({ owner: userID });
    userTasks_created.forEach(async (task) => {
      try {
        await Task.findByIdAndDelete(task._id);
      } catch (e) {
        console.log(`Failed to delete task: ${task._id}`, e);
      }
    });

    const userTasks_received = await Task.find({ recipients: userID });
    userTasks_received.forEach(async (task) => {
      try {
        await Task.findByIdAndDelete(task._id);
      } catch (e) {
        console.log(`Failed to delete task: ${task._id}`, e);
      }
    });

    const userThreads = await Thread.find({ parties: userID });
    userThreads.forEach(async (thread) => {
      try {
        await Thread.findByIdAndDelete(thread._id);
      } catch (e) {
        console.log(`Failed to delete thread: ${thread._id}`, e);
      }
    });

    // users who have deletedUser in their contacts list
    const userContactees = await User.find({ "contacts.id": userID });
    userContactees.forEach(async (contactee) => {
      contactee.contacts = contactee.contacts.filter((contact) => {
        return contact.id !== userID;
      });

      contactee.notifications.push({
        notificationMessage: `${deletingUser.name} has deleted their account :(`,
        from: {
          id: deletingUser._id,
          name: deletingUser.name,
        },
      });

      await contactee.save();
    });

    req.logout(() => {});
    const deletedUser = await User.findByIdAndDelete(userID);
    // console.log("Deleted User and Logged out successfully");
    res.status(200).send(deletedUser);
  } catch (e) {
    res.status(500).send(e);
    console.log("Failed to delete User", e);
  }
});

module.exports = router;
