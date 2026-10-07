const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

const ADMIN_USER = process.env.ADMIN_USER || "shadab";
const ADMIN_PASS = process.env.ADMIN_PASS || "biruxy*@786";

const TTL = 12 * 60 * 60 * 1000;

// ===============================
// FOLDERS / DATABASE
// ===============================

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MOVIES_FILE = path.join(DATA_DIR, "movies.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!fs.existsSync(MOVIES_FILE)) {
  fs.writeFileSync(MOVIES_FILE, "[]");
}

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json({
  limit: "2mb"
}));

app.use(express.urlencoded({
  extended: true
}));

// ===============================
// VIDEO / IMAGE FILE SERVING
// ===============================

app.use("/uploads", express.static(UPLOAD_DIR, {
  acceptRanges: true,

  setHeaders: (res, filePath) => {

    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".mp4") {
      res.setHeader("Content-Type", "video/mp4");
    }

    if (ext === ".webm") {
      res.setHeader("Content-Type", "video/webm");
    }

    if (ext === ".ogg" || ext === ".ogv") {
      res.setHeader("Content-Type", "video/ogg");
    }

    if (ext === ".jpg" || ext === ".jpeg") {
      res.setHeader("Content-Type", "image/jpeg");
    }

    if (ext === ".png") {
      res.setHeader("Content-Type", "image/png");
    }

    if (ext === ".webp") {
      res.setHeader("Content-Type", "image/webp");
    }
  }
}));

// ===============================
// MULTER UPLOAD
// ===============================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {

    const ext = path.extname(
      file.originalname || ""
    );

    const name =
      Date.now() +
      "-" +
      crypto.randomBytes(5).toString("hex") +
      ext;

    cb(null, name);
  }

});

const upload = multer({

  storage,

  limits: {
    fileSize: 1024 * 1024 * 1024
  }

});

// ===============================
// MEMORY DATA
// ===============================

const keys = new Map();
const sessions = new Set();

// ===============================
// MOVIE DATABASE FUNCTIONS
// ===============================

function readMovies() {

  try {

    return JSON.parse(
      fs.readFileSync(
        MOVIES_FILE,
        "utf8"
      )
    );

  } catch (error) {

    return [];

  }

}

function writeMovies(movies) {

  fs.writeFileSync(
    MOVIES_FILE,
    JSON.stringify(
      movies,
      null,
      2
    )
  );

}

// ===============================
// ADMIN AUTH
// ===============================

function adminAuth(req, res, next) {

  const token = String(
    req.headers.authorization || ""
  ).replace(
    /^Bearer\s+/i,
    ""
  );

  if (
    !token ||
    !sessions.has(token)
  ) {

    return res.status(401).json({
      error: "Admin login required."
    });

  }

  next();

}

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {

  res.json({
    ok: true,
    service: "BIRUXY Movie API",
    status: "running"
  });

});

// ===============================
// CREATE USER KEY
// ===============================

app.post("/api/keys", (req, res) => {

  const key =
    "USER-" +
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

  const expiresAt =
    Date.now() + TTL;

  keys.set(
    key,
    expiresAt
  );

  res.json({
    key,
    expiresAt
  });

});

// ===============================
// VERIFY USER KEY
// ===============================

app.post("/api/keys/verify", (req, res) => {

  const key =
    String(
      req.body?.key || ""
    )
      .trim()
      .toUpperCase();

  const expiresAt =
    keys.get(key);

  if (!expiresAt) {

    return res.status(401).json({
      valid: false,
      error: "Invalid username."
    });

  }

  if (Date.now() > expiresAt) {

    keys.delete(key);

    return res.status(401).json({
      valid: false,
      error: "Username expired."
    });

  }

  res.json({
    valid: true,
    expiresAt
  });

});

// ===============================
// ADMIN LOGIN
// ===============================

app.post("/api/admin/login", (req, res) => {

  const username =
    String(
      req.body?.username || ""
    );

  const password =
    String(
      req.body?.password || ""
    );

  if (
    username !== ADMIN_USER ||
    password !== ADMIN_PASS
  ) {

    return res.status(401).json({
      ok: false,
      error:
        "Wrong admin username or password."
    });

  }

  const token =
    crypto.randomBytes(32).toString("hex");

  sessions.add(token);

  res.json({
    ok: true,
    token
  });

});

// ===============================
// GET ALL MOVIES
// ===============================

app.get("/api/movies", (req, res) => {

  const movies =
    readMovies();

  res.json(movies);

});

// ===============================
// ADD MOVIE
// ===============================

app.post(
  "/api/movies",
  adminAuth,
  upload.fields([
    {
      name: "poster",
      maxCount: 1
    },
    {
      name: "video",
      maxCount: 1
    }
  ]),

  (req, res) => {

    try {

      const title =
        String(
          req.body?.title || ""
        ).trim();

      const description =
        String(
          req.body?.description || ""
        ).trim();

      const category =
        String(
          req.body?.category || "movies"
        ).toLowerCase() === "private"
          ? "private"
          : "movies";

      const videoUrl =
        String(
          req.body?.videoUrl || ""
        ).trim();

      const posterUrl =
        String(
          req.body?.posterUrl || ""
        ).trim();

      // ---------------------------
      // TITLE CHECK
      // ---------------------------

      if (!title) {

        return res.status(400).json({
          error:
            "Movie title is required."
        });

      }

      // ---------------------------
      // VIDEO CHECK
      // ---------------------------

      if (
        !videoUrl &&
        !req.files?.video?.[0]
      ) {

        return res.status(400).json({
          error:
            "Upload a video or provide a video URL."
        });

      }

      // ---------------------------
      // POSTER
      // ---------------------------

      let poster = "";

      if (req.files?.poster?.[0]) {

        poster =
          "/uploads/" +
          req.files.poster[0].filename;

      } else {

        poster = posterUrl;

      }

      // ---------------------------
      // VIDEO
      // ---------------------------

      let video = "";

      if (req.files?.video?.[0]) {

        video =
          "/uploads/" +
          req.files.video[0].filename;

      } else {

        video = videoUrl;

      }

      // ---------------------------
      // MOVIE OBJECT
      // ---------------------------

      const movie = {

        id: crypto.randomUUID(),

        title,

        description,

        category,

        poster,

        video,

        createdAt:
          new Date().toISOString()

      };

      // ---------------------------
      // SAVE
      // ---------------------------

      const movies =
        readMovies();

      movies.unshift(movie);

      writeMovies(movies);

      res.json({
        ok: true,
        movie
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Failed to add movie."
      });

    }

  }
);

// ===============================
// DELETE MOVIE
// ===============================

app.delete(
  "/api/movies/:id",
  adminAuth,

  (req, res) => {

    const movies =
      readMovies();

    const movie =
      movies.find(
        item =>
          item.id === req.params.id
      );

    if (!movie) {

      return res.status(404).json({
        error:
          "Movie not found."
      });

    }

    // Delete uploaded poster
    if (
      movie.poster &&
      movie.poster.startsWith(
        "/uploads/"
      )
    ) {

      const posterPath =
        path.join(
          __dirname,
          movie.poster.replace(
            /^\/+/,
            ""
          )
        );

      try {

        if (
          fs.existsSync(
            posterPath
          )
        ) {

          fs.unlinkSync(
            posterPath
          );

        }

      } catch (error) {}

    }

    // Delete uploaded video
    if (
      movie.video &&
      movie.video.startsWith(
        "/uploads/"
      )
    ) {

      const videoPath =
        path.join(
          __dirname,
          movie.video.replace(
            /^\/+/,
            ""
          )
        );

      try {

        if (
          fs.existsSync(
            videoPath
          )
        ) {

          fs.unlinkSync(
            videoPath
          );

        }

      } catch (error) {}

    }

    const remaining =
      movies.filter(
        item =>
          item.id !== req.params.id
      );

    writeMovies(
      remaining
    );

    res.json({
      ok: true
    });

  }
);

// ===============================
// 404
// ===============================

app.use(
  (req, res) => {

    res.status(404).json({
      error:
        "API route not found."
    });

  }
);

// ===============================
// SERVER START
// ===============================

app.listen(
  PORT,
  () => {

    console.log(
      "BIRUXY Movie API running on port " +
      PORT
    );

  }
);
