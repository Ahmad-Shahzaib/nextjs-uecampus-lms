// Lightweight UI-only API shim
// This file removes remote API endpoints and network logic so the app
// can run purely as a UI/navigation shell. Networked features are disabled.

export const API_BASE_URL = "";

export function resolveStorageUrl(path?: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === "undefined") return path.startsWith("/") ? path : `/${path}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}

// Auth token helpers (local-only) — used by `useAuth`
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}

export type ApiInit = RequestInit & {
  timeoutMs?: number;
  skipAuthHeader?: boolean;
  token?: string | null;
};

export class ApiError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/* =========================
   In-memory mock data router
   - Provides canned responses for common endpoints used by the UI
   - Supports simple CRUD for lists: GET, POST, PATCH, DELETE
   - Keeps state in module-scope so pages can interact with it
========================= */

// Mock users
const USERS = [
  { id: "u1", full_name: "Alice Johnson", email: "alice@example.com" },
  { id: "u2", full_name: "Bob Smith", email: "bob@example.com" }
];

// Static auth users (email + password) for local UI-only auth
const AUTH_USERS: Array<{
  id: string;
  email: string;
  password: string;
  full_name?: string;
  avatar_url?: string | null;
  is_blocked?: boolean;
  roles?: string[];
}> = [
  {
    id: "admin",
    email: "admin@example.com",
    password: "adminpass",
    full_name: "Site Administrator",
    roles: ["admin"],
    avatar_url: null,
    is_blocked: false,
  },
  {
    id: "student",
    email: "student@example.com",
    password: "studentpass",
    full_name: "Sample Student",
    roles: ["student"],
    avatar_url: null,
    is_blocked: false,
  },
  {
    id: "teacher",
    email: "teacher@example.com",
    password: "teacherpass",
    full_name: "Sample Teacher",
    roles: ["teacher"],
    avatar_url: null,
    is_blocked: false,
  }
];

// Mock assignments
const ASSIGNMENTS: any[] = [
  {
    id: "a1",
    title: "Intro to React",
    course: "Web Dev",
    course_code: "WD101",
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    priority: "medium",
    hours_left: 72,
    points: 100,
    description: "Build a small React component",
    status: "pending",
    submitted_date: null,
    grade: null,
    feedback: null,
    attempts: 2,
    custom_deadline: null
  }
];

// Mock submissions
const SUBMISSIONS: any[] = [
  {
    id: "s1",
    assignment_id: "a1",
    user_id: "u1",
    submitted_at: new Date().toISOString(),
    profiles: { full_name: "Alice Johnson", email: "alice@example.com" },
    marks_obtained: null,
    feedback: null,
    submitted_file: null
  }
];

// Mock softwares
const SOFTWARES: any[] = [
  { id: "sw1", title: "Visual Studio Code", description: "Code editor", cover_image_url: null, download_url: "https://code.visualstudio.com/", version: "1.0", category: "Development", created_at: new Date().toISOString() }
];

// Helper: parse path and id
function splitPath(path: string) {
  const cleaned = path.replace(/^\//, "");
  const parts = cleaned.split("/").filter(Boolean);
  return parts;
}

async function delay<T>(value: T, ms = 100) {
  return new Promise<T>(res => setTimeout(() => res(value), ms));
}

export async function apiFetch<T = any>(path: string, options: ApiInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const parts = splitPath(path);

  // AUTH endpoints (mock)
  if (parts[0] === "auth") {
    const sub = parts[1] || "";

    // POST /auth/login
    if (sub === "login" && method === "POST") {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      const email = String(body?.email || "").trim().toLowerCase();
      const password = String(body?.password || "");

      const found = AUTH_USERS.find((u) => u.email.toLowerCase() === email);
      await delay(null, 200);
      if (!found || found.password !== password) {
        throw new ApiError("Invalid credentials", 401);
      }

      const token = `mock-${btoa(email)}`;
      const user = {
        id: found.id,
        email: found.email,
        full_name: found.full_name,
        avatar_url: found.avatar_url || "",
        is_blocked: !!found.is_blocked,
      };
      return delay(({ token, user, roles: found.roles || [] } as unknown) as T, 150);
    }

    // GET /auth/me
    if (sub === "me" && method === "GET") {
      const token = options.token || getAuthToken();
      await delay(null, 150);
      if (!token || typeof token !== "string") {
        throw new ApiError("Unauthorized", 401);
      }

      let email = "";
      if (token.startsWith("mock-")) {
        try {
          email = atob(token.replace(/^mock-/, ""));
        } catch (e) {
          throw new ApiError("Invalid token", 401);
        }
      }

      const found = AUTH_USERS.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
      if (!found) throw new ApiError("Unauthorized", 401);

      const user = {
        id: found.id,
        email: found.email,
        full_name: found.full_name,
        avatar_url: found.avatar_url || "",
        is_blocked: !!found.is_blocked,
      };
      return delay(({ user, roles: found.roles || [] } as unknown) as T, 100);
    }
  }

  // USERS
  if (parts[0] === "users") {
    if (method === "GET") return delay((USERS as unknown) as T);
    if (method === "POST") {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      const newU = { id: `u-${Date.now()}`, ...(body || {}) };
      USERS.unshift(newU);
      return delay((newU as unknown) as T);
    }
  }

  // ASSIGNMENTS
  if (parts[0] === "assignments") {
    const id = parts[1];
    if (method === "GET" && !id) return delay((ASSIGNMENTS as unknown) as T);
    if (method === "GET" && id) {
      const found = ASSIGNMENTS.find(a => a.id === id);
      return delay((found || null) as unknown as T);
    }
    if (method === "POST") {
      const body = options.body ? JSON.parse(String(options.body)) : {};
      const newA = { id: `a-${Date.now()}`, ...(body || {}) };
      ASSIGNMENTS.unshift(newA);
      return delay((newA as unknown) as T);
    }
    if (method === "PATCH" && id) {
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      const idx = ASSIGNMENTS.findIndex(a => a.id === id);
      if (idx >= 0) ASSIGNMENTS[idx] = { ...ASSIGNMENTS[idx], ...updates };
      return delay((ASSIGNMENTS[idx] as unknown) as T);
    }
    if (method === "DELETE" && id) {
      const idx = ASSIGNMENTS.findIndex(a => a.id === id);
      if (idx >= 0) ASSIGNMENTS.splice(idx, 1);
      return delay(({} as unknown) as T);
    }
    // special: submit
    if (parts[2] === "submit") {
      const form = options.body as any;
      const newS = { id: `s-${Date.now()}`, assignment_id: parts[1], user_id: "u1", submitted_at: new Date().toISOString(), profiles: USERS[0], submitted_file: form?.get ? form.get('file')?.name || null : null };
      SUBMISSIONS.push(newS);
      return delay((newS as unknown) as T);
    }
  }

  // SUBMISSIONS
  if (parts[0] === "submissions") {
    const id = parts[1];
    if (method === "GET") return delay((SUBMISSIONS as unknown) as T);
    if (method === "DELETE" && id) {
      const idx = SUBMISSIONS.findIndex(s => s.id === id);
      if (idx >= 0) SUBMISSIONS.splice(idx, 1);
      return delay(({} as unknown) as T);
    }
  }

  // SOFTWARES
  if (parts[0] === "softwares") {
    const id = parts[1];
    if (method === "GET") return delay((SOFTWARES as unknown) as T);
    if (method === "POST") {
      const body = options.body instanceof FormData ? Object.fromEntries((options.body as FormData).entries()) : (options.body ? JSON.parse(String(options.body)) : {});
      const newS = { id: `sw-${Date.now()}`, ...body, created_at: new Date().toISOString() };
      SOFTWARES.unshift(newS);
      return delay((newS as unknown) as T);
    }
    if ((method === "PATCH" || method === "DELETE") && id) {
      if (method === "DELETE") {
        const idx = SOFTWARES.findIndex(s => s.id === id);
        if (idx >= 0) SOFTWARES.splice(idx, 1);
        return delay(({} as unknown) as T);
      }
      const updates = options.body ? JSON.parse(String(options.body)) : {};
      const idx = SOFTWARES.findIndex(s => s.id === id);
      if (idx >= 0) SOFTWARES[idx] = { ...SOFTWARES[idx], ...updates };
      return delay((SOFTWARES[idx] as unknown) as T);
    }
  }

  // Default: return empty object to avoid runtime errors
  console.warn("apiFetch mock: no route matched", path, method);
  return delay(({} as unknown) as T);
}
