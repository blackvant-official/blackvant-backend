export function requireWritable(req, res, next) {
  if (process.env.READ_ONLY === "true") {
    return res.status(403).json({
      error: "System is in read-only mode",
      phase: "Phase A"
    });
  }
  next();
}
