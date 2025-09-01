export const websocketConfig = {
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const allowed = [
        `https://${process.env.LOCAL_IP}:${process.env.FRONTEND_PORT}`,
        `http://${process.env.LOCAL_IP}:${process.env.FRONTEND_PORT}`,
        `https://${process.env.PRODUCTION_IP}`,
        `http://${process.env.PRODUCTION_IP}`,
        `https://${process.env.STAGING_IP}`,
        `http://${process.env.STAGING_IP}`,
      ];
      const isLocalNetwork = /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:\d+)?$/.test(origin);
      if (allowed.includes(origin) || isLocalNetwork) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
};