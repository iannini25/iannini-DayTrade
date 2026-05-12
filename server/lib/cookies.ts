import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  const isSecure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
  };
}
