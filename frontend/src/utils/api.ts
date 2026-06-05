const BASE = '/api';

function getToken(): string {
  return localStorage.getItem('token') ?? '';
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error);
  }
  return res.json() as Promise<{ token: string; username: string }>;
}

export async function register(username: string, password: string) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error);
  }
  return res.json() as Promise<{ token: string; username: string }>;
}

export async function getSessions() {
  const res = await fetch(`${BASE}/research/sessions`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load sessions');
  return res.json();
}

export async function getSessionDetail(id: string) {
  const res = await fetch(`${BASE}/research/sessions/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export function startResearch(topic: string, onEvent: (event: string, data: unknown) => void): () => void {
  // Use fetch with ReadableStream to handle SSE with POST + auth header
  const controller = new AbortController();

  fetch(`${BASE}/research/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ topic }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent('error', { message: 'Failed to start research' });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        let eventType = 'message';
        let dataStr = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7);
          if (line.startsWith('data: ')) dataStr = line.slice(6);
        }
        if (dataStr) {
          try {
            const data = JSON.parse(dataStr);
            onEvent(eventType, data);
          } catch {}
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      onEvent('error', { message: err.message });
    }
  });

  return () => controller.abort();
}
