const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

const ADMIN_USER =
  process.env.ADMIN_USER || "shadab";

const ADMIN_PASS =
  process.env.ADMIN_PASS || "biruxy*@786";

const TTL =
  12 * 60 * 60 * 1000;


// ==================================================
// DIRECTORIES
// ==================================================

const DATA_DIR =
  path.join(__dirname, "data");

const UPLOAD_DIR =
  path.join(__dirname, "uploads");

const MOVIES_FILE =
  path.join(DATA_DIR, "movies.json");

fs.mkdirSync(DATA_DIR, {
  recursive: true
});

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true
});

if (!fs.existsSync(MOVIES_FILE)) {
  fs.writeFileSync(
    MOVIES_FILE,
    "[]",
    "utf8"
  );
}


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);


// ==================================================
// MEMORY
// ==================================================

const keys = new Map();

const sessions = new Set();


// ==================================================
// MOVIE DATABASE
// ==================================================

function readMovies() {

  try {

    const data =
      fs.readFileSync(
        MOVIES_FILE,
        "utf8"
      );

    const parsed =
      JSON.parse(data);

    return Array.isArray(parsed)
      ? parsed
      : [];

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
    ),
    "utf8"
  );

}


// ==================================================
// ADMIN AUTH
// ==================================================

function adminAuth(
  req,
  res,
  next
) {

  const authorization =
    String(
      req.headers.authorization || ""
    );

  const token =
    authorization.replace(
      /^Bearer\s+/i,
      ""
    );

  if (
    !token ||
    !sessions.has(token)
  ) {

    return res.status(401).json({
      error:
        "Admin login required."
    });

  }

  next();

}


// ==================================================
// HOME / STATUS
// ==================================================

app.get(
  "/",
  (req, res) => {

    res.json({
      ok: true,
      service:
        "BIRUXY Movie API",
      status:
        "running"
    });

  }
);


// ==================================================
// CREATE USER KEY
// ==================================================

app.post(
  "/api/keys",
  (req, res) => {

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

  }
);


// ==================================================
// VERIFY USER KEY
// ==================================================

app.post(
  "/api/keys/verify",
  (req, res) => {

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
        error:
          "Invalid username."
      });

    }

    if (
      Date.now() >
      expiresAt
    ) {

      keys.delete(key);

      return res.status(401).json({
        valid: false,
        error:
          "Username expired."
      });

    }

    res.json({
      valid: true,
      expiresAt
    });

  }
);


// ==================================================
// ADMIN LOGIN
// ==================================================

app.post(
  "/api/admin/login",
  (req, res) => {

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
      crypto
        .randomBytes(32)
        .toString("hex");

    sessions.add(token);

    res.json({
      ok: true,
      token
    });

  }
);


// ==================================================
// GET MOVIES
// ==================================================

app.get(
  "/api/movies",
  (req, res) => {

    res.json(
      readMovies()
    );

  }
);


// ==================================================
// VIDEO STREAMING
// IMPORTANT: HTTP RANGE SUPPORT
// ==================================================

app.get(
  "/uploads/:filename",
  (req, res) => {

    try {

      const filename =
        path.basename(
          req.params.filename
        );

      const filePath =
        path.join(
          UPLOAD_DIR,
          filename
        );

      // ------------------------------------------
      // FILE EXISTS?
      // ------------------------------------------

      if (
        !fs.existsSync(filePath)
      ) {

        return res.status(404).send(
          "Video/file not found."
        );

      }

      const stat =
        fs.statSync(filePath);

      const fileSize =
        stat.size;

      // ------------------------------------------
      // MIME TYPE
      // ------------------------------------------

      const ext =
        path.extname(
          filePath
        ).toLowerCase();

      let contentType =
        "application/octet-stream";

      if (ext === ".mp4") {

        contentType =
          "video/mp4";

      } else if (
        ext === ".webm"
      ) {

        contentType =
          "video/webm";

      } else if (
        ext === ".ogg" ||
        ext === ".ogv"
      ) {

        contentType =
          "video/ogg";

      } else if (
        ext === ".jpg" ||
        ext === ".jpeg"
      ) {

        contentType =
          "image/jpeg";

      } else if (
        ext === ".png"
      ) {

        contentType =
          "image/png";

      } else if (
        ext === ".webp"
      ) {

        contentType =
          "image/webp";

      }

      // ------------------------------------------
      // NO RANGE
      // ------------------------------------------

      const range =
        req.headers.range;

      if (!range) {

        res.writeHead(
          200,
          {
            "Content-Length":
              fileSize,

            "Content-Type":
              contentType,

            "Accept-Ranges":
              "bytes",

            "Cache-Control":
              "public, max-age=3600"
          }
        );

        return fs
          .createReadStream(
            filePath
          )
          .pipe(res);

      }

      // ------------------------------------------
      // RANGE
      // ------------------------------------------

      const match =
        range.match(
          /bytes=(\d*)-(\d*)/
        );

      if (!match) {

        return res
          .status(416)
          .set({
            "Content-Range":
              `bytes */${fileSize}`
          })
          .end();

      }

      let start =
        match[1]
          ? parseInt(
              match[1],
              10
            )
          : 0;

      let end =
        match[2]
          ? parseInt(
              match[2],
              10
            )
          : fileSize - 1;

      // ------------------------------------------
      // SUFFIX RANGE
      // bytes=-500000
      // ------------------------------------------

      if (
        !match[1] &&
        match[2]
      ) {

        const suffix =
          parseInt(
            match[2],
            10
          );

        start =
          Math.max(
            fileSize - suffix,
            0
          );

        end =
          fileSize - 1;

      }

      // ------------------------------------------
      // VALIDATE RANGE
      // ------------------------------------------

      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 0 ||
        start >= fileSize ||
        end < start
      ) {

        return res
          .status(416)
          .set({
            "Content-Range":
              `bytes */${fileSize}`
          })
          .end();

      }

      if (
        end >= fileSize
      ) {

        end =
          fileSize - 1;

      }

      const chunkSize =
        end - start + 1;

      // ------------------------------------------
      // PARTIAL RESPONSE
      // ------------------------------------------

      res.writeHead(
        206,
        {
          "Content-Range":
            `bytes ${start}-${end}/${fileSize}`,

          "Accept-Ranges":
            "bytes",

          "Content-Length":
            chunkSize,

          "Content-Type":
            contentType,

          "Cache-Control":
            "public, max-age=3600"
        }
      );

      const stream =
        fs.createReadStream(
          filePath,
          {
            start,
            end
          }
        );

      stream.on(
        "error",
        () => {

          if (!res.headersSent) {
            res.status(500);
          }

          res.end();

        }
      );

      stream.pipe(res);

    } catch (error) {

      console.error(
        "STREAM ERROR:",
        error
      );

      if (!res.headersSent) {

        res.status(500).send(
          "Video streaming error."
        );

      } else {

        res.end();

      }

    }

  }
);


// ==================================================
// ADD MOVIE
// ==================================================

const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        cb(
          null,
          UPLOAD_DIR
        );

      },

    filename:
      (req, file, cb) => {

        const ext =
          path.extname(
            file.originalname || ""
          );

        const filename =
          Date.now() +
          "-" +
          crypto
            .randomBytes(5)
            .toString("hex") +
          ext;

        cb(
          null,
          filename
        );

      }

  });


const upload =
  multer({

    storage,

    limits: {

      fileSize:
        1024 *
        1024 *
        1024

    }

  });


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
          req.body?.category ||
          "movies"
        ).toLowerCase() ===
        "private"
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

      // ------------------------------------------
      // TITLE
      // ------------------------------------------

      if (!title) {

        return res.status(400).json({
          error:
            "Movie title is required."
        });

      }

      // ------------------------------------------
      // VIDEO
      // ------------------------------------------

      if (
        !videoUrl &&
        !req.files?.video?.[0]
      ) {

        return res.status(400).json({
          error:
            "Upload a video or provide a video URL."
        });

      }

      // ------------------------------------------
      // POSTER
      // ------------------------------------------

      let poster = "";

      if (
        req.files?.poster?.[0]
      ) {

        poster =
          "/uploads/" +
          req.files.poster[0]
            .filename;

      } else {

        poster =
          posterUrl;

      }

      // ------------------------------------------
      // VIDEO
      // ------------------------------------------

      let video = "";

      if (
        req.files?.video?.[0]
      ) {

        video =
          "/uploads/" +
          req.files.video[0]
            .filename;

      } else {

        video =
          videoUrl;

      }

      // ------------------------------------------
      // MOVIE
      // ------------------------------------------

      const movie = {

        id:
          crypto.randomUUID(),

        title,

        description,

        category,

        poster,

        video,

        createdAt:
          new Date()
            .toISOString()

      };

      const movies =
        readMovies();

      movies.unshift(
        movie
      );

      writeMovies(
        movies
      );

      res.json({
        ok: true,
        movie
      });

    } catch (error) {

      console.error(
        "ADD MOVIE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to add movie."
      });

    }

  }
);


// ==================================================
// DELETE MOVIE
// ==================================================

app.delete(
  "/api/movies/:id",

  adminAuth,

  (req, res) => {

    try {

      const movies =
        readMovies();

      const movie =
        movies.find(
          item =>
            item.id ===
            req.params.id
        );

      if (!movie) {

        return res.status(404).json({
          error:
            "Movie not found."
        });

      }

      // ------------------------------------------
      // DELETE POSTER
      // ------------------------------------------

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

      // ------------------------------------------
      // DELETE VIDEO
      // ------------------------------------------

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
            item.id !==
            req.params.id
        );

      writeMovies(
        remaining
      );

      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        "DELETE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Delete failed."
      });

    }

  }
);


// ==================================================
// 404
// ==================================================

app.use(
  (req, res) => {

    res.status(404).json({
      error:
        "API route not found."
    });

  }
);


// ==================================================
// ERROR HANDLER
// ==================================================

app.use(
  (error, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {

      return res.status(400).json({
        error:
          "Upload error: " +
          error.message
      });

    }

    res.status(500).json({
      error:
        "Internal server error."
    });

  }
);


// ==================================================
// START
// ==================================================

app.listen(
  PORT,
  () => {

    console.log(
      "================================"
    );

    console.log(
      "BIRUXY Movie API running"
    );

    console.log(
      "PORT:",
      PORT
    );

    console.log(
      "================================"
    );

  }
);
