import type { ArchitectureMap } from "./types";

// Spec 4.1 fix: the exported file must render the full graph (phases + prereq
// connections), not just a flat checklist. Both views read/write the same
// completion state so checking a box in either place updates both.
export function buildOfflineExportHtml(map: ArchitectureMap): string {
  const data = JSON.stringify({
    topic: map.topic,
    slug: map.slug,
    phases: map.phases,
    nodes: map.nodes.map((n) => ({
      id: n.id,
      phaseId: n.phaseId,
      label: n.label,
      description: n.description,
      prereqIds: n.prereqIds,
    })),
    completedNodeIds: map.nodes.filter((n) => n.completed).map((n) => n.id),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(map.topic)} — Architecture Map</title>
<style>
  :root { --grey: #d1d5db; --grey-bg: #f3f4f6; --green: #16a34a; --green-bg: #dcfce7; --ink: #171717; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: var(--ink); }
  h1 { font-size: 28px; font-weight: 800; margin: 0 0 4px; }
  h2 { font-size: 18px; font-weight: 700; margin: 40px 0 16px; }
  p.sub { color: #6b7280; margin: 0 0 24px; }
  #graph { position: relative; display: flex; gap: 48px; overflow-x: auto; padding-bottom: 8px; }
  .phase-col { display: flex; flex-direction: column; gap: 16px; min-width: 240px; }
  .phase-title { font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
  .node-box { border: 2px solid var(--grey); background: var(--grey-bg); border-radius: 10px; padding: 12px; cursor: pointer; transition: box-shadow 0.15s; }
  .node-box.completed { border-color: var(--green); background: var(--green-bg); box-shadow: 0 0 0 3px rgba(22,163,74,0.15); }
  .node-box .label { font-weight: 700; font-size: 14px; }
  .node-box .desc { font-size: 12px; color: #4b5563; margin-top: 4px; }
  .node-box input { margin-right: 8px; }
  svg#lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  svg#lines path { stroke: var(--grey); stroke-width: 2; fill: none; }
  svg#lines path.completed { stroke: var(--green); }
  #checklist { list-style: none; padding: 0; margin: 0; max-width: 640px; }
  #checklist li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee; }
  #checklist .phase-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; display: block; }
</style>
</head>
<body>
  <h1>${escapeHtml(map.topic)}</h1>
  <p class="sub">Offline snapshot. Graph view above, flat checklist below. Check a box in either view to update both.</p>

  <h2>Graph view</h2>
  <div id="graph">
    <svg id="lines"></svg>
  </div>

  <h2>Checklist view</h2>
  <ul id="checklist"></ul>

<script>
(function () {
  var DATA = ${data};
  var STORAGE_KEY = "export-completed-" + DATA.slug;
  var stored = localStorage.getItem(STORAGE_KEY);
  var completed = new Set(stored ? JSON.parse(stored) : DATA.completedNodeIds);

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed)));
  }

  function toggle(nodeId) {
    if (completed.has(nodeId)) completed.delete(nodeId); else completed.add(nodeId);
    save();
    render();
  }

  function render() {
    renderGraph();
    renderChecklist();
    drawLines();
  }

  function renderGraph() {
    var graph = document.getElementById("graph");
    Array.from(graph.querySelectorAll(".phase-col")).forEach(function (el) { el.remove(); });
    DATA.phases.forEach(function (phase) {
      var col = document.createElement("div");
      col.className = "phase-col";
      var title = document.createElement("div");
      title.className = "phase-title";
      title.textContent = phase.title;
      col.appendChild(title);
      DATA.nodes.filter(function (n) { return n.phaseId === phase.id; }).forEach(function (node) {
        var box = document.createElement("div");
        box.className = "node-box" + (completed.has(node.id) ? " completed" : "");
        box.id = "box-" + node.id;
        box.onclick = function () { toggle(node.id); };
        box.innerHTML = '<div class="label"><input type="checkbox" ' + (completed.has(node.id) ? "checked" : "") + ' onclick="event.stopPropagation(); window.__toggle(\\'' + node.id + '\\')" />' + escapeHtml(node.label) + '</div><div class="desc">' + escapeHtml(node.description) + '</div>';
        col.appendChild(box);
      });
      graph.appendChild(col);
    });
  }

  function renderChecklist() {
    var list = document.getElementById("checklist");
    list.innerHTML = "";
    DATA.phases.forEach(function (phase) {
      DATA.nodes.filter(function (n) { return n.phaseId === phase.id; }).forEach(function (node) {
        var li = document.createElement("li");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = completed.has(node.id);
        cb.onclick = function () { toggle(node.id); };
        var textWrap = document.createElement("span");
        textWrap.innerHTML = '<span class="phase-label">' + escapeHtml(phase.title) + '</span>' + escapeHtml(node.label);
        li.appendChild(cb);
        li.appendChild(textWrap);
        list.appendChild(li);
      });
    });
  }

  function drawLines() {
    var svg = document.getElementById("lines");
    var graph = document.getElementById("graph");
    var graphRect = graph.getBoundingClientRect();
    svg.innerHTML = "";
    DATA.nodes.forEach(function (node) {
      node.prereqIds.forEach(function (prereqId) {
        var fromEl = document.getElementById("box-" + prereqId);
        var toEl = document.getElementById("box-" + node.id);
        if (!fromEl || !toEl) return;
        var fromRect = fromEl.getBoundingClientRect();
        var toRect = toEl.getBoundingClientRect();
        var x1 = fromRect.right - graphRect.left;
        var y1 = fromRect.top + fromRect.height / 2 - graphRect.top;
        var x2 = toRect.left - graphRect.left;
        var y2 = toRect.top + toRect.height / 2 - graphRect.top;
        var midX = (x1 + x2) / 2;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M" + x1 + "," + y1 + " C" + midX + "," + y1 + " " + midX + "," + y2 + " " + x2 + "," + y2);
        if (completed.has(prereqId) && completed.has(node.id)) path.setAttribute("class", "completed");
        svg.appendChild(path);
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  window.__toggle = toggle;
  window.addEventListener("resize", drawLines);
  render();
})();
</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadOfflineExport(map: ArchitectureMap): void {
  const html = buildOfflineExportHtml(map);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${map.slug || "architecture-map"}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
