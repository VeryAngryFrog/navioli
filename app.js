// Navioli – shelf management: floor plan + shelf list with directions
let db = { shelves: {}, products: {}, beacons: {}, obstacle_messages: {} };
let dragging = null;

const SIDE_LABEL = { left: "left", right: "right" };
const FLIP_SIDE = { left: "right", right: "left" };
const sideWhenFacing = (side, heading) => (heading === "S" ? FLIP_SIDE[side] : side);
const $ = (sel, root = document) => root.querySelector(sel);

const productsOf = (shelfId) => Object.values(db.products).filter((p) => p.shelf_id === shelfId);
const productAt = (shelfId, board) =>
  Object.values(db.products).find((p) => p.shelf_id === shelfId && p.board === board) || null;
const shelvesIn = (aisle, side) =>
  Object.values(db.shelves).filter((s) => s.aisle === aisle && s.side === side).sort((a, b) => a.row - b.row);
const maxShelfAisle = () =>
  Object.values(db.shelves).reduce((m, s) => Math.max(m, s.aisle || 0), 0);
const aisleCount = () => {
  const c = db.layout && db.layout.aisle_count;
  return Math.max(1, maxShelfAisle(), typeof c === "number" ? c : 0);
};
const aislesList = () => Array.from({ length: aisleCount() }, (_, i) => i + 1);
const boardLabels = () => db.board_labels || ["Top shelf", "Middle shelf", "Bottom shelf"];
const BOARD_PHRASE = ["top shelf", "middle shelf", "bottom shelf"];
const boardPhrase = (i) => BOARD_PHRASE[i] || ("level " + (i + 1));
const ord = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const pathObstacles = (shelf) =>
  Object.values(db.shelves)
    .filter((s) => s.aisle === shelf.aisle && s.row < shelf.row)
    .sort((a, b) => a.row - b.row);

// --- automatic route calculation ---
const layoutCfg = () => db.layout || { meters_per_aisle: 2, meters_per_row: 1.5, aisles_per_row: 3 };
const aislesPerRow = () => Math.max(1, (db.layout && db.layout.aisles_per_row) || 3);
const fmtM = (x) => (Math.round(x * 10) / 10).toString();

function gridPos(aisle) {
  const R = aislesPerRow();
  const i = Math.max(0, aisle - 1);
  return { col: i % R, band: Math.floor(i / R) };
}
const DIRS = { N: 0, E: 1, S: 2, W: 3 };
function turnWord(from, to) {
  const d = ((DIRS[to] - DIRS[from]) % 4 + 4) % 4;
  return d === 1 ? "right" : d === 3 ? "left" : d === 2 ? "around" : null;
}

function generateRoute(shelf, startBeaconId) {
  const L = layoutCfg();
  const mpa = L.meters_per_aisle, mpr = L.meters_per_row;
  const a = shelf.aisle;
  const { col: tc, band: tb } = gridPos(a);
  const steps = [];

  const isEntrance = startBeaconId === "beacon_entrance";
  const km = /^beacon_aisle_(\d+)$/.exec(startBeaconId || "");
  const sk = km ? Number(km[1]) : null;

  if (sk === a) {
    if (shelf.row > 0) steps.push(`Walk about ${fmtM(shelf.row * mpr)} meters into the aisle.`);
    steps.push(`The shelf you want is on the ${SIDE_LABEL[shelf.side]}.`);
    return steps;
  }

  const ent = entranceCfg();
  let fromCol, fromBand, heading;
  if (isEntrance) {
    fromCol = ent.col; fromBand = 0; heading = ent.facing;
  } else if (sk !== null) {
    const sp = gridPos(sk);
    if (sp.band === tb) { fromCol = sp.col; fromBand = sp.band; heading = "N"; }
    else { steps.push("Go back to the entrance door."); fromCol = ent.col; fromBand = 0; heading = ent.facing; }
  } else {
    fromCol = ent.col; fromBand = 0; heading = ent.facing;
  }

  const walk = (dir, dist) => {
    const t = turnWord(heading, dir);
    steps.push(t ? `Turn ${t} and walk about ${fmtM(dist)} meters straight ahead.`
                 : `Walk about ${fmtM(dist)} meters straight ahead.`);
    heading = dir;
  };

  const kc = clampCol(checkoutCfg().col);
  const lo = Math.min(fromCol, tc), hi = Math.max(fromCol, tc);
  const frontCross = aislesPerRow() > 1 && fromBand === 0 && tb === 0 && kc > lo && kc < hi;
  const blockedByKasse = (tc === kc && (tb === 0 || fromBand !== tb) && aislesPerRow() > 1) || frontCross;
  // checkout column: enter the aisle from the top
  if (blockedByKasse) {
    let adj = fromCol < kc ? kc - 1 : kc + 1;
    adj = Math.min(Math.max(adj, 0), aislesPerRow() - 1);
    const d1 = adj - fromCol;
    if (d1 !== 0) walk(d1 > 0 ? "E" : "W", Math.abs(d1) * mpa);
    const tNa = turnWord(heading, "N");
    if (tNa) { steps.push(`Turn ${tNa}.`); heading = "N"; }
    const qw = Math.max(tb, 1);
    steps.push(`Walk straight to the ${ord(qw)} cross-aisle.`);
    const d2 = tc - adj;
    if (d2 !== 0) walk(d2 > 0 ? "E" : "W", Math.abs(d2) * mpa);
    if (tb === 0) {
      const tS = turnWord(heading, "S");
      steps.push(tS ? `Turn ${tS} into Aisle ${a}.` : `Go straight into Aisle ${a}.`);
      heading = "S";
      if (shelf.row > 0) steps.push(`Walk along the aisle to row ${shelf.row + 1} (towards the checkout).`);
    } else {
      const tNb = turnWord(heading, "N");
      steps.push(tNb ? `Turn ${tNb} into Aisle ${a}.` : `Go straight into Aisle ${a}.`);
      heading = "N";
      if (shelf.row > 0) steps.push(`Walk about ${fmtM(shelf.row * mpr)} meters into the aisle.`);
    }
    steps.push(`The shelf you want is on the ${SIDE_LABEL[sideWhenFacing(shelf.side, heading)]}.`);
    return steps;
  }

  const dCols = tc - fromCol;
  if (dCols !== 0) walk(dCols > 0 ? "E" : "W", Math.abs(dCols) * mpa);

  const tN = turnWord(heading, "N");
  if (fromBand === tb) {
    steps.push(tN ? `Turn ${tN} into Aisle ${a}.` : `Go straight into Aisle ${a}.`);
  } else {
    if (tN) steps.push(`Turn ${tN}.`);
    steps.push(`Walk straight to the ${ord(tb)} cross-aisle.`);
    steps.push(`Go straight into Aisle ${a}.`);
  }
  heading = "N";
  if (shelf.row > 0) steps.push(`Walk about ${fmtM(shelf.row * mpr)} meters into the aisle.`);
  steps.push(`The shelf you want is on the ${SIDE_LABEL[shelf.side]}.`);
  return steps;
}

// --- checkout & exit ---
function checkoutCfg() {
  const c = (db.layout && db.layout.checkout) || {};
  return { col: Number.isInteger(c.col) ? c.col : Math.max(0, aislesPerRow() - 1) };
}
const clampCol = (c) => Math.min(Math.max(c, 0), aislesPerRow() - 1);
const OPP = { N: "S", S: "N", E: "W", W: "E" };

function frontColRoute(startBeaconId, targetCol, endFacing, arriveText) {
  const mpa = layoutCfg().meters_per_aisle;
  const steps = [];
  const ent = entranceCfg();
  const km = /^beacon_aisle_(\d+)$/.exec(startBeaconId || "");
  const sk = km ? Number(km[1]) : null;
  let fromCol, heading;
  if (sk !== null) {
    const sp = gridPos(sk);
    steps.push("Turn around (towards the entrance).");
    steps.push("Walk straight to the front cross-aisle.");
    fromCol = sp.col; heading = "S";
  } else {
    fromCol = ent.col; heading = ent.facing;
  }
  const dCols = clampCol(targetCol) - fromCol;
  if (dCols !== 0) {
    const dir = dCols > 0 ? "E" : "W";
    const t = turnWord(heading, dir);
    steps.push(t ? `Turn ${t} and walk about ${fmtM(Math.abs(dCols) * mpa)} meters straight ahead.`
                 : `Walk about ${fmtM(Math.abs(dCols) * mpa)} meters straight ahead.`);
    heading = dir;
  }
  if (endFacing) {
    const t = turnWord(heading, endFacing);
    if (t) steps.push(`Turn ${t}.`);
  }
  steps.push(arriveText);
  return steps;
}
const routeToCheckout = (startBeaconId) =>
  frontColRoute(startBeaconId, checkoutCfg().col, "N", "You reach the checkout.");

function routeCheckoutToExit() {
  const mpa = layoutCfg().meters_per_aisle;
  const ent = entranceCfg();
  const exitDir = OPP[ent.facing] || "S";
  const steps = [];
  let heading = "S";
  const dCols = ent.col - clampCol(checkoutCfg().col);
  if (dCols !== 0) {
    const dir = dCols > 0 ? "E" : "W";
    const t = turnWord(heading, dir);
    steps.push(t ? `Turn ${t} and walk about ${fmtM(Math.abs(dCols) * mpa)} meters straight ahead.`
                 : `Walk about ${fmtM(Math.abs(dCols) * mpa)} meters straight ahead.`);
    heading = dir;
  }
  const tt = turnWord(heading, exitDir);
  steps.push(tt ? `Turn ${tt} and go out through the entrance/exit.`
                : "Go out through the entrance/exit.");
  return steps;
}

function startOptions(selected) {
  const opts = [["beacon_entrance", "Entrance"]];
  aislesList().forEach((a) => opts.push([`beacon_aisle_${a}`, `Aisle ${a}`]));
  return opts
    .map(([v, t]) => `<option value="${v}"${v === selected ? " selected" : ""}>${t}</option>`)
    .join("");
}

function overrideFor(shelf, startBeaconId) {
  const ov = (shelf.route_overrides || {})[startBeaconId];
  return Array.isArray(ov) && ov.length ? ov : null;
}

function routeSentences(shelf, startBeaconId) {
  const steps = overrideFor(shelf, startBeaconId) || generateRoute(shelf, startBeaconId);
  const onShelf = productsOf(shelf.id).sort((a, b) => a.board - b.board);
  return [
    ...steps,
    ...onShelf.map((p) => `The item ${p.name} is on the ${boardPhrase(p.board)}.`),
  ];
}

function routeBlockHTML(shelf, startBeaconId) {
  const override = !!overrideFor(shelf, startBeaconId);
  const nav = override ? overrideFor(shelf, startBeaconId) : generateRoute(shelf, startBeaconId);
  const onShelf = productsOf(shelf.id).sort((a, b) => a.board - b.board);
  const items = [
    ...nav.map((s) => `<li>${esc(s)}</li>`),
    ...onShelf.map((p) => `<li class="board-step">The item ${esc(p.name)} is on the ${boardPhrase(p.board)}.</li>`),
  ];
  return `<ol class="route">${items.join("")}</ol>`;
}

// finished texts for the device (rebuilt on save)
function buildRouteSnapshot() {
  const starts = ["beacon_entrance", ...aislesList().map((a) => "beacon_aisle_" + a)];
  for (const shelf of Object.values(db.shelves)) {
    const routes = {};
    for (const st of starts) routes[st] = routeSentences(shelf, st);
    shelf.routes = routes;
  }
  const toCheckout = {};
  for (const st of starts) toCheckout[st] = routeToCheckout(st);
  db.checkout_routes = { to_checkout: toCheckout, checkout_to_exit: routeCheckoutToExit() };
}

// --- load & save ---
async function load() {
  db = await (await fetch("/api/db")).json();
  let changed = false;
  if (!Array.isArray(db.board_labels)) {
    const sample = Object.values(db.shelves).find((s) => Array.isArray(s.boards));
    db.board_labels = sample ? sample.boards.slice() : ["Top shelf", "Middle shelf", "Bottom shelf"];
    changed = true;
  }
  for (const s of Object.values(db.shelves)) {
    if (s.boards) { delete s.boards; changed = true; }
    if (!s.route_overrides || typeof s.route_overrides !== "object" || Array.isArray(s.route_overrides)) {
      s.route_overrides = {};
      changed = true;
    }
    if (Array.isArray(s.route_steps)) {
      if (s.route_steps.length) {
        s.route_overrides[s.start_beacon_id || "beacon_entrance"] = s.route_steps;
      }
      delete s.route_steps;
      changed = true;
    }
  }
  if (!db.layout || typeof db.layout.meters_per_aisle !== "number") {
    const keep = (db.layout && typeof db.layout.aisle_count === "number") ? { aisle_count: db.layout.aisle_count } : {};
    db.layout = { meters_per_aisle: 2, meters_per_row: 1.5, aisles_per_row: 3, ...keep };
    changed = true;
  }
  if (typeof db.layout.aisles_per_row !== "number") {
    db.layout.aisles_per_row = 3;
    changed = true;
  }
  if (!db.layout.entrance || typeof db.layout.entrance.col !== "number") {
    db.layout.entrance = { col: 0, facing: "N" };
    changed = true;
  }
  if (!db.layout.checkout || typeof db.layout.checkout.col !== "number") {
    db.layout.checkout = { col: Math.max(0, (db.layout.aisles_per_row || 3) - 1) };
    changed = true;
  }
  if (normalizeAisles()) changed = true;
  aislesList().forEach((a) => { if (ensureAisleBeacon(a)) changed = true; });
  if (pruneAisleBeacons()) changed = true;
  if (!db.checkout_routes || Object.values(db.shelves).some((s) => !s.routes)) {
    changed = true;
  }
  render();
  if (changed) save();
}
let saveTimer;
async function save() {
  setStatus("Saving …");
  buildRouteSnapshot(); // also store finished texts
  try {
    await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(db),
    });
    setStatus("Saved ✓");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => setStatus(""), 1800);
  } catch (e) {
    setStatus("Save failed");
  }
}
const setStatus = (t) => ($("#saveStatus").textContent = t);

// --- rendering ---
function render() {
  const apr = $("#aislesPerRow");
  if (apr) apr.value = aislesPerRow();
  renderPlan();
  renderShelfList();
  renderCheckoutRoutes();
}

function renderCheckoutRoutes() {
  const sel = $("#checkoutFrom");
  if (!sel) return;
  const cur = sel.value || "beacon_entrance";
  sel.innerHTML = startOptions(cur);
  const from = sel.value || "beacon_entrance";
  const toLi = (s) => `<li>${esc(s)}</li>`;
  $("#toCheckoutRoute").innerHTML = routeToCheckout(from).map(toLi).join("");
  $("#checkoutExitRoute").innerHTML = routeCheckoutToExit().map(toLi).join("");
}

function perRow() {
  return aislesPerRow();
}
function entranceCfg() {
  const e = (db.layout && db.layout.entrance) || {};
  const col = Number.isInteger(e.col) ? e.col : 0;
  const facing = ["N", "E", "W"].includes(e.facing) ? e.facing : "N";
  return { col, facing };
}
const ARROW = { N: "↑", E: "→", W: "←", S: "↓" };
// --- floor plan ---
function corridor(kind, inner) {
  const d = document.createElement("div");
  d.className = "corridor " + kind;
  d.innerHTML = inner;
  return d;
}
function frontCorridor(cols) {
  const e = entranceCfg();
  const doorCol = clampCol(e.col);
  const kasseCol = clampCol(checkoutCfg().col);
  const d = document.createElement("div");
  d.className = "corridor front";
  for (let c = 0; c < cols; c++) {
    const cell = document.createElement("div");
    cell.className = "qw-cell";
    cell.dataset.col = c;
    if (c === doorCol)
      cell.appendChild(frontPin("entrance", "door-pin",
        `<span class="door">🚪 Entrance/Exit</span><span class="enter-arrow">${ARROW[e.facing]}</span>`));
    if (c === kasseCol)
      cell.appendChild(frontPin("checkout", "kasse-pin", `<span>🛒 Checkout</span>`));
    attachFrontDrop(cell, c);
    d.appendChild(cell);
  }
  const name = document.createElement("span");
  name.className = "qw-name";
  name.textContent = "Cross-aisle";
  d.appendChild(name);
  return d;
}
function frontPin(kind, cls, innerHTML) {
  const pin = document.createElement("div");
  pin.className = cls;
  pin.innerHTML = innerHTML;
  pin.draggable = true;
  pin.title = "Drag to move";
  pin.addEventListener("dragstart", (ev) => {
    dragging = { kind };
    ev.dataTransfer.setData("text/plain", kind);
    ev.dataTransfer.effectAllowed = "move";
    pin.classList.add("dragging");
  });
  pin.addEventListener("dragend", () => { dragging = null; pin.classList.remove("dragging"); });
  return pin;
}
function attachFrontDrop(cell, col) {
  cell.addEventListener("dragover", (ev) => {
    if (dragging && (dragging.kind === "entrance" || dragging.kind === "checkout")) {
      ev.preventDefault(); cell.classList.add("qw-drop");
    }
  });
  cell.addEventListener("dragleave", () => cell.classList.remove("qw-drop"));
  cell.addEventListener("drop", (ev) => {
    cell.classList.remove("qw-drop");
    if (!dragging) return;
    if (dragging.kind === "entrance") { ev.preventDefault(); moveFront("entrance", col); }
    else if (dragging.kind === "checkout") { ev.preventDefault(); moveFront("checkout", col); }
  });
}
function moveFront(which, col) {
  if (!db.layout) db.layout = {};
  if (which === "entrance")
    db.layout.entrance = Object.assign({ facing: "N" }, db.layout.entrance, { col });
  else
    db.layout.checkout = Object.assign({}, db.layout.checkout, { col });
  for (const s of Object.values(db.shelves)) s.route_overrides = {};
  render();
  save();
}

function renderPlan() {
  const plan = $("#plan");
  plan.innerHTML = "";
  if (Object.keys(db.shelves).length === 0) {
    plan.innerHTML = '<p class="empty">No shelves yet. Add your first shelf above.</p>';
    return;
  }
  const inner = document.createElement("div");
  inner.className = "plan-inner";
  const nums = aislesList();
  const n = perRow();
  const bands = [];
  for (let i = 0; i < nums.length; i += n) bands.push(nums.slice(i, i + n));

  const stack = [];
  stack.push(frontCorridor(n));
  bands.forEach((band, bi) => {
    const row = document.createElement("div");
    row.className = "aisle-row";
    band.forEach((a) => row.appendChild(aisleColumn(a)));
    for (let k = band.length; k < n; k++) {
      const ph = document.createElement("div");
      ph.className = "aisle placeholder";
      row.appendChild(ph);
    }
    stack.push(row);
    if (bi < bands.length - 1) stack.push(corridor("cross", '<span class="back-label">Cross-aisle</span>'));
  });

  if(bands.length === 1)
    stack.push(corridor("cross", '<span class="back-label">Cross-aisle</span>'));

  // reverse so the door ends up at the bottom
  stack.reverse().forEach((el) => inner.appendChild(el));
  plan.appendChild(inner);
}

function aisleColumn(aisleNum) {
  const col = document.createElement("div");
  col.className = "aisle";
  const empty = !Object.values(db.shelves).some((s) => s.aisle === aisleNum);
  const canDelete = empty && aisleCount() > 1;
  const head = document.createElement("div");
  head.className = "aisle-name";
  head.innerHTML = `<span class="aisle-label">Aisle ${aisleNum}</span>`;
  if (canDelete) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "aisle-del";
    del.title = "Delete empty aisle";
    del.textContent = "×";
    del.addEventListener("click", () => deleteAisle(aisleNum));
    head.appendChild(del);
  }
  col.appendChild(head);
  const body = document.createElement("div");
  body.className = "aisle-body";
  body.appendChild(sideColumn(aisleNum, "left"));
  const lane = document.createElement("div");
  lane.className = "lane";
  const p = gridPos(aisleNum);
  const kasseAisle = p.col === clampCol(checkoutCfg().col) && p.band === 0;
  lane.innerHTML = kasseAisle ? "<span>↓</span>" : "<span>↕</span>";
  body.appendChild(lane);
  body.appendChild(sideColumn(aisleNum, "right"));
  col.appendChild(body);
  return col;
}

function sideColumn(aisle, side) {
  const zone = document.createElement("div");
  zone.className = "side-col side-" + side;
  zone.dataset.aisle = aisle;
  zone.dataset.side = side;
  const list = shelvesIn(aisle, side);
  if (list.length === 0) zone.classList.add("empty");
  [...list].reverse().forEach((s) => zone.appendChild(planShelf(s)));

  zone.addEventListener("dragover", (e) => {
    if (dragging && dragging.kind === "shelf") { e.preventDefault(); zone.classList.add("drop-shelf"); }
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drop-shelf"));
  zone.addEventListener("drop", (e) => {
    zone.classList.remove("drop-shelf");
    if (!dragging || dragging.kind !== "shelf") return;
    e.preventDefault();
    moveShelf(dragging.id, aisle, side, dropRow(zone, e.clientY, dragging.id));
  });
  return zone;
}

function dropRow(zone, y, draggedId) {
  const cards = [...zone.querySelectorAll(".plan-shelf")].filter((c) => c.dataset.shelf !== draggedId);
  let row = 0;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (r.top + r.height / 2 > y) row++;
  }
  return row;
}

function planShelf(shelf) {
  const el = document.createElement("div");
  el.className = "plan-shelf side-" + shelf.side;
  el.dataset.shelf = shelf.id;
  el.innerHTML = `
    <div class="ps-head" draggable="true" title="Drag to move">
      <span class="ps-title">${esc(shelf.name)}</span>
      <button class="ps-edit" data-edit-shelf="${shelf.id}" title="Edit shelf">✎</button>
    </div>
    <div class="ps-boards"></div>`;

  const boardsEl = $(".ps-boards", el);
  boardLabels().forEach((label, i) => {
    const row = document.createElement("div");
    row.className = "ps-board";
    const p = productAt(shelf.id, i);
    row.innerHTML = `<span class="psb-label">${esc(label)}</span>
      <div class="psb-slot">${p ? "" : '<span class="psb-free">empty</span>'}</div>`;
    if (p) $(".psb-slot", row).appendChild(productItem(p));
    attachBoardDrop(row, shelf.id, i);
    boardsEl.appendChild(row);
  });

  const head = $(".ps-head", el);
  head.addEventListener("dragstart", (e) => {
    dragging = { kind: "shelf", id: shelf.id };
    e.dataTransfer.setData("text/plain", "shelf:" + shelf.id);
    el.classList.add("dragging-shelf");
  });
  head.addEventListener("dragend", () => { dragging = null; el.classList.remove("dragging-shelf"); });
  return el;
}

function productItem(p) {
  const item = document.createElement("button");
  item.className = "item";
  item.draggable = true;
  item.dataset.product = p.id;
  item.innerHTML = `<span class="dot ${p.available ? "ok" : "off"}"></span>
    <span class="item-name">${esc(p.name)}</span>
    <span class="item-stock">${p.stock_count}×</span>`;
  item.addEventListener("dragstart", (e) => {
    dragging = { kind: "product", id: p.id };
    e.dataTransfer.setData("text/plain", "product:" + p.id);
    item.classList.add("dragging");
  });
  item.addEventListener("dragend", () => { dragging = null; item.classList.remove("dragging"); });
  item.addEventListener("click", () => openProductDialog(p.id));
  return item;
}

function attachBoardDrop(row, shelfId, i) {
  row.addEventListener("dragover", (e) => {
    if (dragging && dragging.kind === "product") { e.preventDefault(); row.classList.add("drop"); }
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop"));
  row.addEventListener("drop", (e) => {
    row.classList.remove("drop");
    if (!dragging || dragging.kind !== "product") return;
    e.preventDefault();
    moveProduct(dragging.id, shelfId, i);
  });
}

// --- shelf list ---
function renderShelfList() {
  const wrap = $("#shelfList");
  wrap.innerHTML = "";
  Object.values(db.shelves)
    .sort((a, b) => a.aisle - b.aisle || a.side.localeCompare(b.side) || a.row - b.row)
    .forEach((s) => wrap.appendChild(slCard(s)));
}

function mountRouteUI(card, shelf) {
  let curStart = "beacon_entrance";
  let editing = false;
  const block = $(".route-block", card);
  const editBtn = $(".route-edit-btn", card);
  const startSel = $(".route-start", card);

  function paint() {
    const ov = overrideFor(shelf, curStart);
    if (!editing) {
      editBtn.style.display = "";
      startSel.disabled = false;
      block.innerHTML = routeBlockHTML(shelf, curStart);
      return;
    }
    editBtn.style.display = "none";
    startSel.disabled = true;
    const steps = ov || generateRoute(shelf, curStart);
    block.innerHTML = `
      <textarea class="route-edit-area" rows="5">${esc(steps.join("\n"))}</textarea>
      <p class="route-edit-hint">One step per line. The shelf-level sentence is added automatically.</p>
      <div class="route-edit-actions">
        ${ov ? '<button type="button" class="btn-mini route-auto">Reset to automatic</button>' : ""}
        <button type="button" class="btn-mini route-cancel">Cancel</button>
        <button type="button" class="btn-mini btn-mini-primary route-save">Save</button>
      </div>`;
    $(".route-save", card).addEventListener("click", () => {
      const steps2 = $(".route-edit-area", card).value.split("\n").map((l) => l.trim()).filter(Boolean);
      shelf.route_overrides = shelf.route_overrides || {};
      if (steps2.length) shelf.route_overrides[curStart] = steps2;
      else delete shelf.route_overrides[curStart];
      editing = false;
      paint();
      save();
    });
    $(".route-cancel", card).addEventListener("click", () => { editing = false; paint(); });
    const autoBtn = $(".route-auto", card);
    if (autoBtn) autoBtn.addEventListener("click", () => {
      if (shelf.route_overrides) delete shelf.route_overrides[curStart];
      editing = false;
      paint();
      save();
    });
  }

  startSel.addEventListener("change", (e) => { curStart = e.target.value; editing = false; paint(); });
  editBtn.addEventListener("click", () => { editing = true; paint(); });
  paint();
}

function slCard(shelf) {
  const items = productsOf(shelf.id).length;
  const total = boardLabels().length;
  const obst = pathObstacles(shelf);
  const onWayParts = obst.map((s) => `${esc(s.name)} (${SIDE_LABEL[s.side]})`);
  const colRows = shelvesIn(shelf.aisle, shelf.side).map((s) => s.row);
  const maxRow = colRows.length ? Math.max(...colRows) : 0;
  if (shelf.row === maxRow && maxRow >= 1) onWayParts.push("wall at the end of the aisle");
  const onWayLine = onWayParts.length
    ? `<p class="meta">On the way you pass: ${onWayParts.join(", ")}</p>`
    : "";

  const card = document.createElement("article");
  card.className = "sl-card";
  card.innerHTML = `
    <div class="sl-head">
      <div>
        <h3>${esc(shelf.name)}</h3>
        <span class="sl-sub">Aisle ${shelf.aisle} · ${items}/${total} filled</span>
      </div>
      <div class="sl-head-right">
        <span class="badge badge-obst">Obstacle: ${SIDE_LABEL[shelf.side]}</span>
        <button class="icon-edit" data-edit-shelf="${shelf.id}" title="Edit shelf">✎</button>
      </div>
    </div>
    <div class="sl-boards"></div>
    <details class="sl-info">
      <summary>Directions</summary>
      <p class="meta">Aisle ${shelf.aisle} · ${SIDE_LABEL[shelf.side]} · Row ${shelf.row + 1}</p>
      ${onWayLine}
      <div class="route-head">
        <button type="button" class="route-edit-btn" title="Edit these directions">✎ Edit</button>
      </div>
      <label class="route-start-l">From:
        <select class="route-start">${startOptions("beacon_entrance")}</select></label>
      <div class="route-block"></div>
    </details>`;

  mountRouteUI(card, shelf);

  const boardsEl = $(".sl-boards", card);
  boardLabels().forEach((label, i) => {
    const p = productAt(shelf.id, i);
    const row = document.createElement("div");
    row.className = "sl-board";
    row.innerHTML = `<span class="psb-label">${esc(label)}</span>
      <div class="psb-slot">${p ? "" : '<span class="psb-free">free</span>'}</div>`;
    if (p) $(".psb-slot", row).appendChild(productItem(p));
    attachBoardDrop(row, shelf.id, i);
    boardsEl.appendChild(row);
  });
  return card;
}

// --- moving ---
function moveProduct(productId, toShelf, toBoard) {
  const p = db.products[productId];
  if (!p || (p.shelf_id === toShelf && p.board === toBoard)) return;
  const occ = productAt(toShelf, toBoard);
  if (occ && occ.id !== p.id) { occ.shelf_id = p.shelf_id; occ.board = p.board; }
  p.shelf_id = toShelf;
  p.board = toBoard;
  render();
  save();
}
function deleteProduct(id) {
  const p = db.products[id];
  if (!p) return;
  if (!confirm(`Delete ${p.name}?`)) return;
  delete db.products[id];
  productDialog.close();
  render();
  save();
}
function moveShelf(shelfId, toAisle, toSide, index) {
  const sh = db.shelves[shelfId];
  if (!sh) return;
  sh.aisle = Math.min(Math.max(1, toAisle), aisleCount());
  sh.side = toSide;
  sh.row = index - 0.5;
  sh.route_overrides = {};
  renumberAll();
  renumberShelfNames();
  render();
  save();
}
function renumberAll() {
  const groups = {};
  for (const s of Object.values(db.shelves)) {
    const k = s.aisle + "|" + s.side;
    (groups[k] = groups[k] || []).push(s);
  }
  for (const k in groups)
    groups[k].sort((a, b) => a.row - b.row).forEach((s, i) => {
      if (s.row !== i && s.route_overrides && Object.keys(s.route_overrides).length) s.route_overrides = {};
      s.row = i;
    });
}
function rebuildAisleBeacons() {
  for (const id of Object.keys(db.beacons))
    if (/^beacon_aisle_\d+$/.test(id)) delete db.beacons[id];
  aislesList().forEach((a) => ensureAisleBeacon(a));
}
function pruneAisleBeacons() {
  let changed = false;
  const keep = new Set(aislesList().map((a) => "beacon_aisle_" + a));
  for (const id of Object.keys(db.beacons))
    if (/^beacon_aisle_\d+$/.test(id) && !keep.has(id)) { delete db.beacons[id]; changed = true; }
  return changed;
}
function normalizeAisles() {
  let changed = false;
  const hasCount = db.layout && typeof db.layout.aisle_count === "number";
  if (!hasCount) {
    const used = [...new Set(Object.values(db.shelves).map((s) => s.aisle))].sort((a, b) => a - b);
    const map = new Map(); used.forEach((a, i) => map.set(a, i + 1));
    for (const s of Object.values(db.shelves)) {
      const to = map.get(s.aisle);
      if (to && to !== s.aisle) { s.aisle = to; changed = true; }
    }
    db.layout.aisle_count = Math.max(1, used.length);
    changed = true;
  } else {
    const want = Math.max(1, maxShelfAisle(), db.layout.aisle_count);
    if (want !== db.layout.aisle_count) { db.layout.aisle_count = want; changed = true; }
    for (const s of Object.values(db.shelves)) {
      const c = Math.min(Math.max(1, s.aisle || 1), db.layout.aisle_count);
      if (c !== s.aisle) { s.aisle = c; changed = true; }
    }
  }
  return changed;
}
function newAisle() {
  db.layout.aisle_count = aisleCount() + 1;
  rebuildAisleBeacons();
  render();
  save();
}
function deleteAisle(n) {
  const count = aisleCount();
  if (n < 1 || n > count) return;
  if (Object.values(db.shelves).some((s) => s.aisle === n)) return;
  if (count <= 1) return;
  for (const s of Object.values(db.shelves)) if (s.aisle > n) s.aisle -= 1;
  db.layout.aisle_count = count - 1;
  rebuildAisleBeacons();
  renumberAll();
  renumberShelfNames();
  render();
  save();
}
const sideRank = (s) => (s.side === "left" ? 0 : 1);
function renumberShelfNames() {
  Object.values(db.shelves)
    .filter((s) => shelfNumber(s) > 0)
    .sort((a, b) => a.aisle - b.aisle || a.row - b.row || sideRank(a) - sideRank(b))
    .forEach((s, i) => { s.name = "Shelf " + (i + 1); });
}
function resetShelfName(id) {
  const s = db.shelves[id];
  if(!s) return;
  s.name = nextShelfName();
  renumberShelfNames();
  shelfDialog.close();
  render();
  save();
}
function ensureAisleBeacon(aisle) {
  const id = "beacon_aisle_" + aisle;
  if (db.beacons[id]) return false;
  db.beacons[id] = {
    id, name: "Aisle " + aisle,
    description: "Beacon at the start of Aisle " + aisle + ".",
    x: aisle * 2, y: 1,
  };
  return true;
}
function deleteShelf(id) {
  const sh = db.shelves[id];
  if (!sh) return;
  const prods = productsOf(id);
  const msg = prods.length
    ? `Delete ${sh.name}? The ${prods.length} items on it will also be removed.`
    : `Delete ${sh.name}?`;
  if (!confirm(msg)) return;
  prods.forEach((p) => delete db.products[p.id]);
  delete db.shelves[id];
  renumberAll();
  renumberShelfNames();
  shelfDialog.close();
  render();
  save();
}

// --- shelf dialog ---
const shelfDialog = $("#shelfDialog");
const shelfForm = $("#shelfForm");
let editingShelf = null;

function openShelfDialog(shelfId) {
  editingShelf = shelfId || null;
  $("#shelfDialogTitle").textContent = shelfId ? "Edit shelf" : "New shelf";
  $("#shelfDeleteBtn").style.display = shelfId ? "" : "none";
  const s = shelfId ? db.shelves[shelfId] : null;
  $("#shelfResetNameBtn").style.display = (s && shelfNumber(s) === 0) ? "" : "none";
  shelfForm.aisle.value = s ? s.aisle : 1;
  shelfForm.shelfname.value = s ? s.name : "";
  shelfDialog.showModal();
}

shelfForm.addEventListener("submit", (e) => {
  const f = shelfForm;
  let aisle = Number(f.aisle.value) || 1;
  aisle = Math.min(Math.max(1, aisle), aisleCount() + 1);
  if (aisle > aisleCount()) db.layout.aisle_count = aisle;
  const typed = f.shelfname.value.trim();
  ensureAisleBeacon(aisle);
  const id = editingShelf || nextId("shelf", db.shelves);
  const existing = editingShelf ? db.shelves[id] : null;
  const name = typed || nextShelfName();
  const side = existing ? existing.side : "left";
  const sameSpot = existing && existing.aisle === aisle && existing.side === side;
  const row = sameSpot ? existing.row : shelvesIn(aisle, side).length;
  db.shelves[id] = {
    id,
    name,
    aisle, side, row,
    start_beacon_id: "beacon_entrance",
    route_overrides: existing && sameSpot ? (existing.route_overrides || {}) : {},
  };
  renumberAll();
  renumberShelfNames();
  render();
  save();
});

// --- item dialog ---
const productDialog = $("#productDialog");
const productForm = $("#productForm");
let editingProduct = null;

function openProductDialog(productId) {
  editingProduct = productId || null;
  $("#productDialogTitle").textContent = productId ? "Edit item" : "New item";
  $("#productDeleteBtn").style.display = productId ? "" : "none";
  fillShelfSelect();
  const p = productId ? db.products[productId] : null;
  productForm.name.value = p ? p.name : "";
  productForm.stock_count.value = p ? p.stock_count : 0;
  productForm.shelf_id.value = p ? p.shelf_id : firstShelf();
  productForm.available.checked = p ? p.available : true;
  productForm.keywords.value = p ? (p.keywords || []).join(", ") : "";
  fillBoardSelect(p ? p.board : null);
  productDialog.showModal();
}
productForm.shelf_id.addEventListener("change", () => fillBoardSelect(null));
productForm.addEventListener("submit", (e) => {
  const f = productForm;
  if (!f.board.value) { e.preventDefault(); alert("There is no free space on this shelf."); return; }
  const keywords = f.keywords.value.split(",").map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) { e.preventDefault(); alert("Please enter at least one keyword."); return; }
  const name = f.name.value.trim();
  const id = editingProduct || nextProductId(name);
  db.products[id] = {
    id, name, keywords,
    available: f.available.checked,
    stock_count: Number(f.stock_count.value),
    shelf_id: f.shelf_id.value,
    board: Number(f.board.value),
  };
  render();
  save();
});

// --- selects ---
function fillShelfSelect() {
  $("#productShelfSelect").innerHTML = Object.values(db.shelves)
    .map((s) => `<option value="${s.id}">${esc(s.name)} (Aisle ${s.aisle}, ${SIDE_LABEL[s.side]})</option>`).join("");
}
function fillBoardSelect(currentBoard) {
  const shelfId = productForm.shelf_id.value;
  const shelf = db.shelves[shelfId];
  const sel = $("#productBoardSelect");
  if (!shelf) { sel.innerHTML = ""; return; }
  sel.innerHTML = boardLabels().map((label, i) => {
    const taken = productAt(shelfId, i);
    const isCurrent = editingProduct && currentBoard === i && taken && taken.id === editingProduct;
    const disabled = taken && !isCurrent ? "disabled" : "";
    const suffix = taken && !isCurrent ? " (occupied)" : "";
    return `<option value="${i}" ${disabled} ${isCurrent ? "selected" : ""}>${esc(label)}${suffix}</option>`;
  }).join("");
  if (currentBoard == null) {
    const firstFree = boardLabels().findIndex((_, i) => !productAt(shelfId, i));
    sel.value = firstFree >= 0 ? String(firstFree) : "";
  }
}

// --- helpers ---
const beaconName = (id) => (db.beacons[id] ? db.beacons[id].name : id || "—");
const firstBeacon = () => Object.keys(db.beacons)[0] || "";
const firstShelf = () => Object.keys(db.shelves)[0] || "";
function nextId(prefix, obj) { let n = 1; while (obj[`${prefix}_${n}`]) n++; return `${prefix}_${n}`; }
function shelfNumber(s) {
  const m = /^Shelf\s+(\d+)$/.exec((s && s.name) || "");
  return m ? Number(m[1]) : 0;
}
function nextShelfNumber() {
  let max = 0;
  for (const s of Object.values(db.shelves)) max = Math.max(max, shelfNumber(s));
  return max + 1;
}
function nextShelfName() {
  return "Shelf " + nextShelfNumber();
}
function nextProductId(name) {
  let b = name.toLowerCase().replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item";
  let id = b, n = 2; while (db.products[id]) id = `${b}_${n++}`; return id;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// --- wiring ---
$("#newShelfBtn").addEventListener("click", () => openShelfDialog(null));
$("#newAisleBtn").addEventListener("click", () => newAisle());
$("#newProductBtn").addEventListener("click", () => openProductDialog(null));
$("#shelfDeleteBtn").addEventListener("click", () => { if (editingShelf) deleteShelf(editingShelf); });
$("#shelfResetNameBtn").addEventListener("click", () => { if (editingShelf) resetShelfName(editingShelf); });
$("#productDeleteBtn").addEventListener("click", () => { if (editingProduct) deleteProduct(editingProduct); });
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close()));
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-shelf]");
  if (editBtn) openShelfDialog(editBtn.dataset.editShelf);
});
$("#checkoutFrom").addEventListener("change", renderCheckoutRoutes);

const aprInput = $("#aislesPerRow");
aprInput.addEventListener("change", () => {
  let v = Math.round(Number(aprInput.value));
  if (!Number.isFinite(v) || v < 1) v = 1;
  if (v > 12) v = 12;
  aprInput.value = v;
  if (!db.layout) db.layout = {};
  db.layout.aisles_per_row = v;
  for (const s of Object.values(db.shelves)) s.route_overrides = {};
  render();
  save();
});

load();