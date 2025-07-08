const express = require("express");
const router = express.Router();

const { users } = require("../users");

let roomsRef = null;

router.init = (rooms) => {
  roomsRef = rooms;
};

// Создание комнаты
router.post("/", (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: "Необходимо указать roomId и role" });
  }

  if (roomsRef[roomId]) {
    return res.status(409).json({ error: "Комната с таким ID уже существует" });
  }

  roomsRef[roomId] = {
    users: [],
    usersList: users,
    messages: [],
    isLive: false,
    privateMessages: {},
    offerScreenData: null,
    offerVideoData: null,
    tipMenu: [
      { id: 1, value: 11, description: "love you" },
      { id: 2, value: 55, description: "tongue out" },
      { id: 3, value: 77, description: "2 hand spanks" },
      { id: 4, value: 88, description: "nipple flash" },
      { id: 5, value: 110, description: "pussy flash" },
      { id: 6, value: 111, description: "pussy tip" },
      { id: 7, value: 160, description: "vibes" },
      { id: 8, value: 166, description: "doggy without panties" },
      { id: 9, value: 222, description: "play your song" },
      { id: 10, value: 331, description: "heels on -off" },
      { id: 11, value: 444, description: "DOMI tip controlled vibrator" },
      { id: 12, value: 666, description: "wave pattern" },
      { id: 13, value: 667, description: "pulse pattern" },
      { id: 14, value: 777, description: "fireworks pattern (fav)" },
      { id: 15, value: 778, description: "earthquake pattern" },
      { id: 16, value: 999, description: "naked cat" },
      { id: 17, value: 1111, description: "catclub" },
      { id: 18, value: 1555, description: "love and appreciation for cat" },
      { id: 19, value: 11111, description: "spoils" },
    ],
  };

  res.json({ success: true, message: `Комната ${roomId} создана.` });
});

// Получение списка комнат
router.get("/", (req, res) => {
  const roomList = Object.entries(roomsRef).map(([roomId, room]) => ({
    roomId,
    usersCount: room.users.length,
    isLive: room.isLive,
    usernames: room.users.map((u) => u.username),
  }));

  res.json(roomList);
});

// Удаление комнаты
router.delete("/:roomId", (req, res) => {
  const { roomId } = req.params;

  if (!rooms[roomId]) {
    return res.status(404).json({ error: "Комната не найдена" });
  }

  delete rooms[roomId];
  res.json({ success: true, message: `Комната ${roomId} удалена.` });
});
// Проврка наличия комнаты
router.get("/:roomId/exists", (req, res) => {
  const { roomId } = req.params;

  if (!roomsRef || !roomsRef[roomId]) {
    return res.json({ exists: false });
  }

  return res.json({ exists: true });
});

module.exports = router;
