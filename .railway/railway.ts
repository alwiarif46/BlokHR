import { defineRailway, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const backendVolume = volume("backend-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "sfo",
    sizeMB: 500,
  });
  const backend = service("backend", {
    replicas: { sfo: 1 },
    volumeMounts: { "/data": backendVolume },
    env: {
      ACTION_LINK_SECRET: preserve(),
      CORS_ORIGINS: preserve(),
      DB_ENGINE: preserve(),
      DB_PATH: preserve(),
      DEPLOYMENT_MODE: preserve(),
      INTERNAL_SECRET: preserve(),
      LICENSE_SIGNING_SECRET: preserve(),
      NODE_ENV: preserve(),
      PORT: preserve(),
      RAILWAY_DOCKERFILE_PATH: preserve(),
    },
  });
  const gateway = service("gateway", {
    replicas: { sfo: 1 },
    env: {
      FRONTEND_DIR: preserve(),
      INTERNAL_SECRET: preserve(),
      MONOLITH_URL: preserve(),
      NODE_ENV: preserve(),
      PORT: preserve(),
      RAILWAY_DOCKERFILE_PATH: preserve(),
    },
  });

  return project("blokhr", {
    resources: [backend, gateway, backendVolume],
  });
});
