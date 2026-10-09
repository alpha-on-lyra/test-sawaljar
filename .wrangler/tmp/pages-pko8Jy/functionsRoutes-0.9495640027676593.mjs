import { onRequestGet as __api_ga_ts_onRequestGet } from "/home/qwee/JAR/Gravity/sawaljar/functions/api/ga.ts"

export const routes = [
    {
      routePath: "/api/ga",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_ga_ts_onRequestGet],
    },
  ]