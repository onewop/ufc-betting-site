const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

// Tries to extract FastAPI's `detail` field from error response bodies
// so validation / auth error messages are surfaced to the UI as-is.
const handleResponse = async (response) => {
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `API Error: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};

const api = {
  get: async (endpoint, token = null) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${endpoint}`, { headers });
    return handleResponse(response);
  },

  post: async (endpoint, data = {}, token = null) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  del: async (endpoint, token = null) => {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "DELETE",
      headers,
    });
    return handleResponse(response);
  },
};

export default api;
