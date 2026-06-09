// Local / Cloud Run entrypoint — starts a long-lived HTTP server.
// (Vercel uses api/index.js instead, which re-exports the same app.)
import app from "./app.js";

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`DynaCompliance listening on :${port}`));
