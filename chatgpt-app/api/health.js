export default function handler(_req, res) {
  res.status(200).json({
    name: "StudyFlow ChatGPT app",
    status: "ready",
    endpoint: "/mcp",
    authentication: "Supabase access token required",
    oauthConfigured: false
  });
}
