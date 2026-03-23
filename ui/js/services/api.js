/* HTTP client for Kaizen API */
const API = (() => {
  const BASE = '/api';

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    // Projects
    getProjects:   ()           => req('GET',    '/projects'),
    getProject:    (name)       => req('GET',    `/projects/${name}`),
    createProject: (body)       => req('POST',   '/projects', body),
    deleteProject: (name)       => req('DELETE', `/projects/${name}`),

    // Tasks
    getTasks:   (project, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return req('GET', `/projects/${project}/tasks${qs ? '?' + qs : ''}`);
    },
    getTask:    (project, id)        => req('GET',    `/projects/${project}/tasks/${id}`),
    createTask: (project, body)      => req('POST',   `/projects/${project}/tasks`, body),
    updateTask: (project, id, body)  => req('PUT',    `/projects/${project}/tasks/${id}`, body),
    patchTask:  (project, id, body)  => req('PATCH',  `/projects/${project}/tasks/${id}`, body),
    deleteTask: (project, id)        => req('DELETE', `/projects/${project}/tasks/${id}`),

    // Board
    getBoard:   (project)            => req('GET',   `/projects/${project}/board`),
    moveTask:   (project, taskId, newStatus) =>
      req('PATCH', `/projects/${project}/board/move`, { taskId, newStatus }),
  };
})();
