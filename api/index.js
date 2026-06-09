// Vercel serverless entrypoint. An Express app is itself a (req, res) handler,
// so re-exporting it as the default export makes Vercel route requests through it.
// vercel.json rewrites all paths here; Express serves both the static UI and the API.
import app from "../src/app.js";

export default app;
