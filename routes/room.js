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
