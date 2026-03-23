/**
 * Creates the minimal DOM structure expected by app.js and the UI components.
 */
function setupDOM() {
  document.body.innerHTML = `
    <div id="project-switcher-mount"></div>
    <div id="kanban-mount"></div>
    <div id="list-mount"></div>
    <div id="settings-mount" style="display:none"></div>
    <button id="new-task-btn"></button>
    <span id="ws-indicator"></span>
    <button class="tab-btn" data-view="kanban" class="active">Kanban</button>
    <button class="tab-btn" data-view="list">List</button>
  `;
}

module.exports = { setupDOM };
