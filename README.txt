BIRUXY CONNECTED SETUP

1) Deploy this folder as a Render Web Service.
   Build Command: npm install
   Start Command: npm start

2) Copy the backend URL (example: https://biruxy-access-api.onrender.com).

3) In BOTH adunlock-index.html and movie-index.html replace:
   https://YOUR-BACKEND.onrender.com
   with your real backend URL.

4) In adunlock-index.html replace:
   https://YOUR-MOVIE-SITE.onrender.com
   with your real Movie Website URL.

5) Upload/deploy the two updated index files to their respective sites.

Flow:
ADUNLOCK -> backend creates 12-hour key -> Open Movie Website with ?key=...
Movie Website -> backend verifies key -> Home -> MOVIES / PRIVATE.

NOTE: The backend above keeps keys in memory. A Render restart/redeploy clears them.
For persistent production access, add a database (e.g. Render Postgres/Supabase) later.
