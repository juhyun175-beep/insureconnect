import { onRequestPost as __api_notify_comment_js_onRequestPost } from "C:\\Users\\최주현\\OneDrive\\Desktop\\insureconnect\\functions\\api\\notify-comment.js"
import { onRequest as ___middleware_js_onRequest } from "C:\\Users\\최주현\\OneDrive\\Desktop\\insureconnect\\functions\\_middleware.js"

export const routes = [
    {
      routePath: "/api/notify-comment",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_notify_comment_js_onRequestPost],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]