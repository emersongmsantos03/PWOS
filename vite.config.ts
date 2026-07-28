import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

type User = { id: string; name: string; email: string; profile: string; role: string; salt: string; passwordHash: string };
const sessions = new Map<string, string>();
const users = new Map<string, User>();
const hash = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const publicUser = ({ passwordHash: _, salt: __, ...user }: User) => user;
const cookies = (request: IncomingMessage) => Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map(value => value.trim().split("=")));
const body = async (request: IncomingMessage) => {
  let value = "";
  for await (const chunk of request) value += chunk;
  return JSON.parse(value || "{}") as Record<string, string>;
};
const json = (response: ServerResponse, status: number, value: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
};

function localApi(masterEmail: string, masterPassword: string): Plugin {
  const localUsersPath = "data/users.local.json";
  const salt = randomBytes(16).toString("hex");
  const master: User = { id: randomUUID(), name: "Emerson Santos", email: masterEmail.toLowerCase(), profile: "MASTER", role: "Administrador", salt, passwordHash: hash(masterPassword, salt) };
  users.set(master.id, master);
  if (existsSync(localUsersPath)) {
    const storedUsers = JSON.parse(readFileSync(localUsersPath, "utf8")) as User[];
    storedUsers.forEach(user => users.set(user.id, user));
  }
  const persistUsers = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(localUsersPath, JSON.stringify([...users.values()].filter(user => user.profile !== "MASTER"), null, 2), { mode: 0o600 });
  };
  return {
    name: "pw-os-local-api",
    configureServer(server) {
      server.middlewares.use("/api", async (request, response) => {
        const url = request.url || "/";
        const sessionId = cookies(request).pw_os_session;
        const userId = sessionId && sessions.get(sessionId);
        const currentUser = userId && users.get(userId);
        if (url === "/auth/login" && request.method === "POST") {
          const input = await body(request);
          const user = [...users.values()].find(item => item.email === input.email?.toLowerCase());
          if (!user || !safeEqual(user.passwordHash, hash(input.password || "", user.salt))) return json(response, 401, { message: "E-mail ou senha inválidos." });
          const token = randomBytes(32).toString("hex");
          sessions.set(token, user.id);
          response.setHeader("Set-Cookie", `pw_os_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
          return json(response, 200, { user: publicUser(user) });
        }
        if (url === "/auth/session" && request.method === "GET") return currentUser ? json(response, 200, { user: publicUser(currentUser) }) : json(response, 401, { message: "Sessão necessária." });
        if (url === "/auth/logout" && request.method === "POST") {
          if (sessionId) sessions.delete(sessionId);
          response.setHeader("Set-Cookie", "pw_os_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
          return json(response, 200, { ok: true });
        }
        if (!currentUser) return json(response, 401, { message: "Sessão necessária." });
        if (url === "/users" && request.method === "GET") return json(response, 200, { users: [...users.values()].map(publicUser) });
        if (url === "/users" && request.method === "POST") {
          if (currentUser.profile !== "MASTER") return json(response, 403, { message: "Permissão insuficiente." });
          const input = await body(request);
          if (!input.name || !input.email || !input.password) return json(response, 400, { message: "Preencha nome, e-mail e senha inicial." });
          if ([...users.values()].some(item => item.email === input.email.toLowerCase())) return json(response, 409, { message: "E-mail já cadastrado." });
          const userSalt = randomBytes(16).toString("hex");
          const user: User = { id: randomUUID(), name: input.name, email: input.email.toLowerCase(), profile: input.profile || "COLLABORATOR", role: input.role || "Colaborador", salt: userSalt, passwordHash: hash(input.password, userSalt) };
          users.set(user.id, user);
          persistUsers();
          return json(response, 201, { user: publicUser(user) });
        }
        return json(response, 404, { message: "Rota não encontrada." });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PW_OS_");
  const masterEmail = env.PW_OS_MASTER_EMAIL;
  const masterPassword = env.PW_OS_MASTER_INITIAL_PASSWORD;
  if (!masterEmail || !masterPassword) throw new Error("Configure PW_OS_MASTER_EMAIL e PW_OS_MASTER_INITIAL_PASSWORD no arquivo .env.local.");
  return {
    plugins: [
      react(),
      localApi(masterEmail, masterPassword),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "PW OS — Performance Workspace", short_name: "PW OS", description: "ERP + CRM da PW Media",
          theme_color: "#1b2838", background_color: "#f4f6f8", display: "standalone",
          icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
        }
      })
    ],
    resolve: { alias: { "@": "/apps/web/src" } },
    build: { outDir: "dist" }
  };
});
