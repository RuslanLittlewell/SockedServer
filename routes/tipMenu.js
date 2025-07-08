const express = require("express");
const router = express.Router();

let roomsRef = null;

router.init = (rooms) => {
  roomsRef = rooms;
};

router.get("/:roomId", (req, res) => {
  const { roomId } = req.params;

  if (!roomsRef || !roomsRef[roomId]) {
    return res.status(404).json({ error: "Room not found" });
  }

  return res.json(roomsRef[roomId].tipMenu || []);
});


router.put("/:roomId", (req, res) => {
  const { roomId } = req.params;
  
  if (!roomsRef || !roomsRef[roomId]) {
    return res.status(404).json({ error: "Room not found" });
  }

  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "tipMenu must be an array" });
  }

  roomsRef[roomId].tipMenu = req.body;

  return res.json({ success: true, tipMenu: req.body });
});


module.exports = router;