import type { ArchitectureMap } from "./types";

// Spec 4.1 fix: the exported file must render the full graph (phases + prereq
// connections), not just a flat checklist. Both views read/write the same
// completion state so checking a box in either place updates both.
//
// Also carries equations, references, and user notes, and lets you keep
// adding notes inside the exported file itself (its own localStorage, keyed
// by slug) so captured additions work whether the map was ever exported or
// not, not just live in the app.
export function buildOfflineExportHtml(map: ArchitectureMap): string {
  const data = JSON.stringify({
    topic: map.topic,
    slug: map.slug,
    phases: map.phases.map((p) => ({ id: p.id, title: p.title, summary: p.summary, notes: p.notes })),
    nodes: map.nodes.map((n) => ({
      id: n.id,
      phaseId: n.phaseId,
      label: n.label,
      what: n.what,
      why: n.why,
      how: n.how,
      equation: n.equation,
      prereqIds: n.prereqIds,
      notes: n.notes,
    })),
    references: map.references,
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
  .phase-col { display: flex; flex-direction: column; gap: 16px; min-width: 260px; }
  .phase-title { font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
  .node-box { border: 2px solid var(--grey); background: var(--grey-bg); border-radius: 10px; padding: 12px; cursor: pointer; transition: box-shadow 0.15s; }
  .node-box.completed { border-color: var(--green); background: var(--green-bg); box-shadow: 0 0 0 3px rgba(22,163,74,0.15); }
  .node-box .label { font-weight: 700; font-size: 14px; }
  .node-box dl { margin: 6px 0 0; font-size: 12px; color: #4b5563; }
  .node-box dt { display: inline; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #9ca3af; }
  .node-box dd { display: inline; margin: 0; }
  .node-box .field { display: block; margin-top: 3px; }
  .node-box input[type="checkbox"] { margin-right: 8px; }
  .equation-box { margin-top: 6px; background: #111827; color: #86efac; font-family: "SF Mono", Menlo, monospace; font-size: 11px; padding: 6px 8px; border-radius: 6px; overflow-x: auto; }
  .note-tag { display: inline-block; font-size: 11px; color: #374151; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 3px 8px; margin: 4px 4px 0 0; }
  .note-input { font-size: 11px; padding: 4px 10px; border-radius: 12px; border: 2px solid var(--grey); width: 100%; margin-top: 6px; }
  svg#lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  svg#lines path { stroke: var(--grey); stroke-width: 2; fill: none; }
  svg#lines path.completed { stroke: var(--green); }
  #checklist { list-style: none; padding: 0; margin: 0; max-width: 640px; }
  #checklist li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee; }
  #checklist .phase-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; display: block; }
  #refs-notes .phase-block { margin-bottom: 20px; }
  #refs-notes .phase-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
  #refs-notes .node-block { margin-top: 8px; padding-left: 12px; border-left: 2px solid #f3f4f6; }
  #refs-notes .node-heading { font-weight: 600; font-size: 13px; }
  #refs-notes .ref-line { font-size: 12px; margin-top: 2px; }
  #refs-notes .ref-line a { color: #15803d; font-weight: 600; text-decoration: underline; }
</style>
</head>
<body>
  <h1>${escapeHtml(map.topic)}</h1>
  <p class="sub">Offline snapshot. Graph view above, flat checklist below. Check a box in either view to update both. Notes you add here are saved in this file's own browser storage, whether you ever re-export or not.</p>

  <h2>Graph view</h2>
  <div id="graph">
    <svg id="lines"></svg>
  </div>

  <h2>Checklist view</h2>
  <ul id="checklist"></ul>

  <h2>References &amp; Notes</h2>
  <div id="refs-notes"></div>

<script>
(function () {
  var DATA = ${data};
  var COMPLETED_KEY = "export-completed-" + DATA.slug;
  var storedCompleted = localStorage.getItem(COMPLETED_KEY);
  var completed = new Set(storedCompleted ? JSON.parse(storedCompleted) : DATA.completedNodeIds);

  var NOTES_KEY = "export-notes-" + DATA.slug;
  var storedNotes = localStorage.getItem(NOTES_KEY);
  var notes = storedNotes ? JSON.parse(storedNotes) : {
    nodeNotes: DATA.nodes.reduce(function (acc, n) { acc[n.id] = n.notes || []; return acc; }, {}),
    phaseNotes: DATA.phases.reduce(function (acc, p) { acc[p.id] = p.notes || []; return acc; }, {}),
  };

  function saveCompleted() {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(completed)));
  }
  function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }
  function makeNoteId() {
    return "note_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function toggle(nodeId) {
    if (completed.has(nodeId)) completed.delete(nodeId); else completed.add(nodeId);
    saveCompleted();
    render();
  }

  function addNodeNote(nodeId, text) {
    if (!text.trim()) return;
    if (!notes.nodeNotes[nodeId]) notes.nodeNotes[nodeId] = [];
    notes.nodeNotes[nodeId].push({ id: makeNoteId(), text: text.trim() });
    saveNotes();
    render();
  }

  function addPhaseNote(phaseId, text) {
    if (!text.trim()) return;
    if (!notes.phaseNotes[phaseId]) notes.phaseNotes[phaseId] = [];
    notes.phaseNotes[phaseId].push({ id: makeNoteId(), text: text.trim() });
    saveNotes();
    render();
  }

  function render() {
    renderGraph();
    renderChecklist();
    renderRefsNotes();
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

      (notes.phaseNotes[phase.id] || []).forEach(function (note) {
        var tag = document.createElement("span");
        tag.className = "note-tag";
        tag.textContent = note.text;
        col.appendChild(tag);
      });

      var phaseInput = document.createElement("input");
      phaseInput.className = "note-input";
      phaseInput.placeholder = "Add a note…";
      phaseInput.onclick = function (e) { e.stopPropagation(); };
      phaseInput.onkeydown = function (e) {
        if (e.key === "Enter") { addPhaseNote(phase.id, phaseInput.value); }
      };
      col.appendChild(phaseInput);

      DATA.nodes.filter(function (n) { return n.phaseId === phase.id; }).forEach(function (node) {
        var box = document.createElement("div");
        box.className = "node-box" + (completed.has(node.id) ? " completed" : "");
        box.id = "box-" + node.id;
        box.onclick = function () { toggle(node.id); };

        var html = '<div class="label"><input type="checkbox" ' + (completed.has(node.id) ? "checked" : "") + ' onclick="event.stopPropagation(); window.__toggle(\\'' + node.id + '\\')" />' + escapeHtml(node.label) + '</div><dl>' +
          '<span class="field"><dt>What </dt><dd>' + escapeHtml(node.what) + '</dd></span>' +
          '<span class="field"><dt>Why </dt><dd>' + escapeHtml(node.why) + '</dd></span>' +
          '<span class="field"><dt>How </dt><dd>' + escapeHtml(node.how) + '</dd></span>' +
          '</dl>';
        if (node.equation) {
          html += '<div class="equation-box">' + escapeHtml(node.equation) + '</div>';
        }
        box.innerHTML = html;

        (notes.nodeNotes[node.id] || []).forEach(function (note) {
          var tag = document.createElement("span");
          tag.className = "note-tag";
          tag.textContent = note.text;
          box.appendChild(tag);
        });

        var nodeInput = document.createElement("input");
        nodeInput.className = "note-input";
        nodeInput.placeholder = "Add a note…";
        nodeInput.onclick = function (e) { e.stopPropagation(); };
        nodeInput.onkeydown = function (e) {
          if (e.key === "Enter") { addNodeNote(node.id, nodeInput.value); }
        };
        box.appendChild(nodeInput);

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

  function renderRefsNotes() {
    var container = document.getElementById("refs-notes");
    container.innerHTML = "";
    DATA.phases.forEach(function (phase) {
      var phaseNodes = DATA.nodes.filter(function (n) { return n.phaseId === phase.id; });
      var phaseNoteList = notes.phaseNotes[phase.id] || [];
      var anyNodeContent = phaseNodes.some(function (n) {
        var refs = DATA.references[n.id] || [];
        var nNotes = notes.nodeNotes[n.id] || [];
        return refs.length > 0 || nNotes.length > 0;
      });
      if (phaseNoteList.length === 0 && !anyNodeContent) return;

      var block = document.createElement("div");
      block.className = "phase-block";
      var heading = document.createElement("div");
      heading.className = "phase-heading";
      heading.textContent = phase.title;
      block.appendChild(heading);

      phaseNoteList.forEach(function (note) {
        var tag = document.createElement("span");
        tag.className = "note-tag";
        tag.textContent = note.text;
        block.appendChild(tag);
      });

      phaseNodes.forEach(function (node) {
        var refs = DATA.references[node.id] || [];
        var nNotes = notes.nodeNotes[node.id] || [];
        if (refs.length === 0 && nNotes.length === 0) return;

        var nodeBlock = document.createElement("div");
        nodeBlock.className = "node-block";
        var nodeHeading = document.createElement("div");
        nodeHeading.className = "node-heading";
        nodeHeading.textContent = node.label;
        nodeBlock.appendChild(nodeHeading);

        refs.forEach(function (ref) {
          var refLine = document.createElement("div");
          refLine.className = "ref-line";
          refLine.innerHTML = '<a href="' + escapeHtml(ref.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(ref.title) + '</a> — ' + escapeHtml(ref.why);
          nodeBlock.appendChild(refLine);
        });

        nNotes.forEach(function (note) {
          var tag = document.createElement("span");
          tag.className = "note-tag";
          tag.textContent = note.text;
          nodeBlock.appendChild(tag);
        });

        block.appendChild(nodeBlock);
      });

      container.appendChild(block);
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
