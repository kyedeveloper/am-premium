export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    version: '5.1.0',
    env: {
      apiKey: !!process.env.API_KEY,
      alightToken: !!process.env.ALIGHT_TOKEN,
      firebaseToken: !!process.env.FIREBASE_TOKEN,
      redisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      redisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      jwtSecret: !!process.env.JWT_SECRET,
      pixpayz: !!process.env.PIXPAYZ_API_KEY,
      owner: !!process.env.OWNER_EMAIL,
    },
  });
}
