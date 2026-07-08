const DATA_URL = "./workbook-data.json";

const FIELD = {
  drawing: "DRAWING #",
  tag: "TAG #",
  item: "ITEM DESCRIPTION",
  quantity: "QUANTITY",
  units: "UNITS",
  qtyDelivered: "QTY. DELIVERED",
  spec: "SPECIFICATION SECTION",
  provider: "PROVIDED BY:",
  area: "AREA / BUILDING",
  room: "ROOM",
  system: "SYSTEM",
  submittal: "SUBMITTAL #",
  status: "SUBMITTAL STATUS",
  released: "DATE RELEASED",
  lead: "LEAD TIME (DAYS)",
  delivery: "EXPECTED DELIVERY",
  required: "DATE REQUIRED ONSITE",
  critical: "Critical Item",
  delivered: "Delivered",
  deliveries: "Deliveries",
  stored: "Stored Location",
  remaining: "DAYS REMAININIG",
  notes: "NOTES",
};

const LEGACY_ROOM_SYSTEM_FIELD = "ROOM / SYSTEM";

const state = {
  data: null,
  rows: [],
  baseRows: [],
  rowsByProject: {},
  filtered: [],
  projects: [],
  activeProjectId: "hampton-wwtp-phase-ii",
  activeView: "dashboard",
  hiddenColumns: new Set(),
  logColumnFilters: {},
  logSort: { column: null, direction: "asc" },
  deletedRowKeys: new Set(),
  adminLists: {
    suppliers: [],
    statuses: [],
  },
  developmentNotes: [],
  userInitials: "",
  supabaseClient: null,
  cloudReady: false,
  cloudSaveTimer: null,
  adminListsLoadedFromCloud: false,
  deliveryEditor: {
    rowKey: "",
    index: null,
  },
};

const VALID_VIEWS = new Set(["dashboard", "log", "procurement", "development", "admin"]);
const AUTOCOMPLETE_FILTERS = new Set([
  FIELD.drawing,
  FIELD.spec,
  FIELD.provider,
  FIELD.area,
  FIELD.room,
  FIELD.system,
  FIELD.submittal,
  FIELD.status,
]);
const COLUMN_PREF_KEY = "equipmentMaterialHiddenColumns";
const LOG_FILTER_PREF_KEY = "equipmentMaterialLogColumnFilters";
const LOG_SORT_PREF_KEY = "equipmentMaterialLogSort";
const EDIT_PREF_KEY = "equipmentMaterialLogEdits";
const ADMIN_PREF_KEY = "equipmentMaterialAdminLists";
const INITIALS_PREF_KEY = "equipmentMaterialUserInitials";
const ADDED_ITEMS_PREF_KEY = "equipmentMaterialAddedItems";
const DELETED_ITEMS_PREF_KEY = "equipmentMaterialDeletedItems";
const ROW_ORDER_PREF_KEY = "equipmentMaterialRowOrder";
const PROJECTS_PREF_KEY = "equipmentMaterialProjects";
const ACTIVE_PROJECT_PREF_KEY = "equipmentMaterialActiveProject";
const PROJECT_ROWS_PREFIX = "equipmentMaterialProjectRows:";
const DEVELOPMENT_NOTES_PREF_KEY = "equipmentMaterialDevelopmentNotes";

const els = {
  viewTitle: document.querySelector("#view-title"),
  syncStatus: document.querySelector("#syncStatus"),
  projectSelect: document.querySelector("#projectSelect"),
  search: document.querySelector("#searchInput"),
  status: document.querySelector("#statusFilter"),
  area: document.querySelector("#areaFilter"),
  provider: document.querySelector("#providerFilter"),
  timing: document.querySelector("#timingFilter"),
  reset: document.querySelector("#resetFilters"),
  addItem: document.querySelector("#addItemButton"),
  exportExcel: document.querySelector("#exportExcelButton"),
  columnToggle: document.querySelector("#columnToggle"),
  columnMenu: document.querySelector("#columnMenu"),
  projectDashboard: document.querySelector("#projectDashboard"),
  kpiGrid: document.querySelector("#kpiGrid"),
  attentionCount: document.querySelector("#attentionCount"),
  attentionList: document.querySelector("#attentionList"),
  statusBars: document.querySelector("#statusBars"),
  providerBars: document.querySelector("#providerBars"),
  upcomingList: document.querySelector("#upcomingList"),
  logHead: document.querySelector("#logHead"),
  logBody: document.querySelector("#logBody"),
  tableShell: document.querySelector(".table-shell"),
  tableScrollTop: document.querySelector("#tableScrollTop"),
  tableScrollTopInner: document.querySelector("#tableScrollTopInner"),
  procurementBoard: document.querySelector("#procurementBoard"),
  developmentNoteForm: document.querySelector("#developmentNoteForm"),
  developmentNoteInput: document.querySelector("#developmentNoteInput"),
  developmentNoteInitials: document.querySelector("#developmentNoteInitials"),
  developmentNotesList: document.querySelector("#developmentNotesList"),
  developmentNotesCount: document.querySelector("#developmentNotesCount"),
  projectForm: document.querySelector("#projectForm"),
  projectInput: document.querySelector("#projectInput"),
  projectList: document.querySelector("#projectList"),
  projectCount: document.querySelector("#projectCount"),
  supplierForm: document.querySelector("#supplierForm"),
  supplierInput: document.querySelector("#supplierInput"),
  supplierList: document.querySelector("#supplierList"),
  supplierCount: document.querySelector("#supplierCount"),
  userInitialsInput: document.querySelector("#userInitialsInput"),
  statusAdminForm: document.querySelector("#statusAdminForm"),
  statusAdminInput: document.querySelector("#statusAdminInput"),
  statusAdminList: document.querySelector("#statusAdminList"),
  statusAdminCount: document.querySelector("#statusAdminCount"),
  downloadTemplate: document.querySelector("#downloadTemplateButton"),
  importMode: document.querySelector("#importMode"),
  importFile: document.querySelector("#importFileInput"),
  importLog: document.querySelector("#importLogButton"),
  importStatus: document.querySelector("#importStatus"),
  deliveryDialog: document.querySelector("#deliveryDialog"),
  deliveryForm: document.querySelector("#deliveryForm"),
  deliveryDialogTitle: document.querySelector("#deliveryDialogTitle"),
  deliveryDialogItem: document.querySelector("#deliveryDialogItem"),
  deliveryDialogClose: document.querySelector("#deliveryDialogClose"),
  deliveryCancel: document.querySelector("#deliveryCancelButton"),
  deliveryDate: document.querySelector("#deliveryDateInput"),
  deliveryTicket: document.querySelector("#deliveryTicketInput"),
  deliveryQty: document.querySelector("#deliveryQtyInput"),
  deliveryUnits: document.querySelector("#deliveryUnitsInput"),
  deliveryUnitPricePo: document.querySelector("#deliveryUnitPricePoInput"),
  deliveryUnitPriceInvoice: document.querySelector("#deliveryUnitPriceInvoiceInput"),
  deliveryNotes: document.querySelector("#deliveryNotesInput"),
};

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeKey(value) {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

function excelDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && Number.isNaN(Number(value))) return value;
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return clean(value);
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rowKey(row) {
  return String(row._rowNumber || row[FIELD.tag] || state.rows.indexOf(row));
}

function isAddedRow(row) {
  return rowKey(row).startsWith("new-");
}

function projectRowsKey(projectId = state.activeProjectId) {
  return `${PROJECT_ROWS_PREFIX}${projectId}`;
}

function defaultProjects() {
  return [{
    id: "hampton-wwtp-phase-ii",
    name: "Hampton WWTP Upgrade Phase II",
    archived: false,
    baseline: true,
  }];
}

function setSyncStatus(message, mode = "local") {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = message;
  els.syncStatus.dataset.mode = mode;
}

function projectRowsFromStorage(projectId) {
  const savedRows = localStorage.getItem(projectRowsKey(projectId));
  if (savedRows) {
    try {
      return JSON.parse(savedRows);
    } catch {
      localStorage.removeItem(projectRowsKey(projectId));
    }
  }
  return null;
}

function collectSharedState() {
  state.rowsByProject[state.activeProjectId] = state.rows;
  state.projects.forEach((project) => {
    if (!state.rowsByProject[project.id]) {
      state.rowsByProject[project.id] = projectRowsFromStorage(project.id)
        || (project.baseline ? state.baseRows.map((row) => ({ ...row })) : []);
    }
  });
  return {
    projects: state.projects,
    rowsByProject: state.rowsByProject,
    adminLists: state.adminLists,
    developmentNotes: state.developmentNotes,
    updatedAt: new Date().toISOString(),
  };
}

function initializeSupabase() {
  const config = window.EQUIPMENT_TRACKING_SUPABASE || {};
  if (!config.url || !config.anonKey || !window.supabase?.createClient) {
    setSyncStatus("Local mode - Supabase not configured", "local");
    return;
  }
  state.supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  setSyncStatus("Connecting to Supabase...", "pending");
}

async function loadSharedState() {
  if (!state.supabaseClient) return false;
  try {
    const { data, error } = await state.supabaseClient
      .from("equipment_material_app_state")
      .select("data")
      .eq("id", "main")
      .maybeSingle();
    if (error) throw error;

    if (data?.data) {
      const shared = data.data;
      state.projects = Array.isArray(shared.projects) && shared.projects.length ? shared.projects : state.projects;
      state.rowsByProject = shared.rowsByProject || {};
      state.adminLists = shared.adminLists || state.adminLists;
      state.developmentNotes = Array.isArray(shared.developmentNotes) ? shared.developmentNotes : [];
      state.adminListsLoadedFromCloud = Boolean(shared.adminLists);
      setSyncStatus("Shared database connected", "cloud");
    } else {
      state.rowsByProject = {
        [defaultProjects()[0].id]: state.baseRows.map((row) => ({ ...row })),
      };
      await saveSharedState();
      setSyncStatus("Shared database initialized", "cloud");
    }
    state.cloudReady = true;
    return true;
  } catch (error) {
    console.error(error);
    setSyncStatus("Local mode - Supabase connection failed", "local");
    state.supabaseClient = null;
    return false;
  }
}

async function maybeMigrateLocalStorageToSupabase() {
  const params = new URLSearchParams(location.search);
  if (params.get("migrateLocalToSupabase") !== "1") return false;
  if (!state.supabaseClient) {
    setSyncStatus("Migration failed - Supabase not configured", "local");
    return false;
  }

  try {
    setSyncStatus("Migrating local data to shared database...", "pending");
    const localState = collectLocalStorageSharedState();
    const { error } = await state.supabaseClient
      .from("equipment_material_app_state")
      .upsert({ id: "main", data: localState });
    if (error) throw error;
    state.projects = localState.projects;
    state.rowsByProject = localState.rowsByProject;
    state.adminLists = localState.adminLists;
    state.developmentNotes = localState.developmentNotes || [];
    state.adminListsLoadedFromCloud = true;
    state.cloudReady = true;
    setSyncStatus("Local data migrated to shared database", "cloud");
    history.replaceState(null, "", `${location.pathname}${location.hash || "#dashboard"}`);
    return true;
  } catch (error) {
    console.error(error);
    setSyncStatus("Migration failed - see console", "local");
    return false;
  }
}

function queueSharedSave() {
  if (!state.supabaseClient || !state.cloudReady) return;
  clearTimeout(state.cloudSaveTimer);
  state.cloudSaveTimer = setTimeout(() => {
    saveSharedState();
  }, 500);
}

async function saveSharedState() {
  if (!state.supabaseClient) return;
  try {
    const { error } = await state.supabaseClient
      .from("equipment_material_app_state")
      .upsert({ id: "main", data: collectSharedState() });
    if (error) throw error;
    setSyncStatus("Shared database saved", "cloud");
  } catch (error) {
    console.error(error);
    setSyncStatus("Shared database save failed", "local");
  }
}

function saveProjects() {
  localStorage.setItem(PROJECTS_PREF_KEY, JSON.stringify(state.projects));
  queueSharedSave();
}

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECTS_PREF_KEY) || "[]");
    state.projects = saved.length ? saved : defaultProjects();
  } catch {
    state.projects = defaultProjects();
  }
  if (!state.projects.some((project) => project.id === "hampton-wwtp-phase-ii")) {
    state.projects.unshift(defaultProjects()[0]);
  }
  saveProjects();
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function legacyBaselineRowsFromStorage() {
  let rows = state.baseRows.map((row) => ({ ...row }));
  const added = safeJsonParse(localStorage.getItem(ADDED_ITEMS_PREF_KEY), []);
  if (Array.isArray(added) && added.length) rows = [...added, ...rows];

  const edits = safeJsonParse(localStorage.getItem(EDIT_PREF_KEY), {});
  rows.forEach((row) => {
    const rowEdits = edits[rowKey(row)];
    if (rowEdits) Object.assign(row, rowEdits);
  });

  const deleted = new Set(safeJsonParse(localStorage.getItem(DELETED_ITEMS_PREF_KEY), []));
  rows = rows.filter((row) => !deleted.has(rowKey(row)));

  const order = safeJsonParse(localStorage.getItem(ROW_ORDER_PREF_KEY), []);
  if (Array.isArray(order) && order.length) {
    const rowMap = new Map(rows.map((row) => [rowKey(row), row]));
    const orderedRows = order.map((key) => rowMap.get(key)).filter(Boolean);
    const orderedKeys = new Set(orderedRows.map(rowKey));
    rows = [...orderedRows, ...rows.filter((row) => !orderedKeys.has(rowKey(row)))];
  }

  return rows;
}

function collectLocalStorageSharedState() {
  const projects = safeJsonParse(localStorage.getItem(PROJECTS_PREF_KEY), defaultProjects());
  const normalizedProjects = Array.isArray(projects) && projects.length ? projects : defaultProjects();
  if (!normalizedProjects.some((project) => project.id === "hampton-wwtp-phase-ii")) {
    normalizedProjects.unshift(defaultProjects()[0]);
  }

  const rowsByProject = {};
  normalizedProjects.forEach((project) => {
    const localRows = projectRowsFromStorage(project.id);
    const isBaselineProject = project.baseline || project.id === "hampton-wwtp-phase-ii";
    rowsByProject[project.id] = localRows?.length
      ? localRows
      : (isBaselineProject ? legacyBaselineRowsFromStorage() : []);
    if (isBaselineProject && !rowsByProject[project.id].length) {
      rowsByProject[project.id] = state.baseRows.map((row) => ({ ...row }));
    }
  });

  let adminLists = safeJsonParse(localStorage.getItem(ADMIN_PREF_KEY), null);
  if (!adminLists) {
    const allRows = Object.values(rowsByProject).flat();
    adminLists = {
      suppliers: uniqueSorted(allRows.map((row) => row[FIELD.provider])),
      statuses: uniqueSorted(allRows.map((row) => row[FIELD.status])),
    };
  }

  return {
    projects: normalizedProjects,
    rowsByProject,
    adminLists,
    developmentNotes: safeJsonParse(localStorage.getItem(DEVELOPMENT_NOTES_PREF_KEY), []),
    updatedAt: new Date().toISOString(),
    migratedFromLocalStorage: true,
  };
}

function activeProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
}

function saveCurrentProjectRows() {
  state.rowsByProject[state.activeProjectId] = state.rows;
  localStorage.setItem(projectRowsKey(), JSON.stringify(state.rows));
  queueSharedSave();
}

function loadRowsForProject(project) {
  if (state.rowsByProject[project.id]) {
    return state.rowsByProject[project.id].map((row) => ({ ...row }));
  }
  const savedRows = localStorage.getItem(projectRowsKey(project.id));
  if (savedRows) {
    try {
      return JSON.parse(savedRows);
    } catch {
      localStorage.removeItem(projectRowsKey(project.id));
    }
  }
  return project.baseline ? state.baseRows.map((row) => ({ ...row })) : [];
}

function resetLogControlsForProject() {
  els.search.value = "";
  els.status.value = "all";
  els.area.value = "all";
  els.provider.value = "all";
  els.timing.value = "all";
  state.logColumnFilters = {};
  state.logSort = { column: null, direction: "asc" };
  saveLogControls();
}

function loadProject(projectId) {
  const nextProject = state.projects.find((project) => project.id === projectId) || state.projects[0];
  if (!nextProject) return;
  saveCurrentProjectRows();
  state.activeProjectId = nextProject.id;
  localStorage.setItem(ACTIVE_PROJECT_PREF_KEY, state.activeProjectId);
  state.rows = loadRowsForProject(nextProject);
  state.filtered = state.rows.filter(matchesFilters);
  loadAdminLists();
  resetLogControlsForProject();
  populateGlobalFilters();
  populateProjectSelect();
  renderColumnMenu();
  render();
}

function slugProjectName(name) {
  const base = clean(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  let id = base;
  let index = 2;
  while (state.projects.some((project) => project.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function addProject(name) {
  const projectName = clean(name);
  if (!projectName) return;
  saveCurrentProjectRows();
  const project = {
    id: slugProjectName(projectName),
    name: projectName,
    archived: false,
    baseline: false,
  };
  state.projects.push(project);
  saveProjects();
  localStorage.setItem(projectRowsKey(project.id), JSON.stringify([]));
  loadProject(project.id);
}

function archiveProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || project.archived) return;
  if (!confirm(`Archive ${project.name}?`)) return;
  project.archived = true;
  saveProjects();
  if (projectId === state.activeProjectId) {
    const nextProject = state.projects.find((item) => !item.archived) || project;
    loadProject(nextProject.id);
  } else {
    renderAdmin();
    populateProjectSelect();
  }
}

function restoreProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.archived = false;
  saveProjects();
  renderAdmin();
  populateProjectSelect();
}

function excelSerialFromDate(value) {
  const text = clean(value);
  if (!text) return "";
  const dashedUsDate = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashedUsDate) {
    const [, monthText, dayText, yearText] = dashedUsDate;
    const month = Number(monthText);
    const day = Number(dayText);
    const year = Number(yearText);
    const utc = Date.UTC(year, month - 1, day);
    const parsed = new Date(utc);
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      return Math.round(utc / 86400000 + 25569);
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return value;
  const utc = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round(utc / 86400000 + 25569);
}

function todayExcelSerial() {
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(todayUtc / 86400000 + 25569);
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function requiredDateRangeOptions() {
  return [
    ["", "All required dates"],
    ["overdue", "Items overdue"],
    ["next-30", "Required onsite within next 30 days"],
    ["next-6-months", "Required onsite within next 6 months"],
    ["30-90", "Required onsite from 30 to 90 days"],
    ["90-6-months", "Required onsite 90 days to 6 months"],
    ["6-months-plus", "Required onsite 6 months or later"],
  ];
}

function matchesRequiredDateRange(row, range) {
  if (!range) return true;
  const required = numeric(row[FIELD.required]);
  if (required === null) return false;

  const today = new Date();
  const todaySerial = todayExcelSerial();
  const sixMonthsSerial = excelSerialFromDate(addMonths(today, 6).toISOString().slice(0, 10));
  const daysOut = required - todaySerial;
  const delivered = Boolean(row[FIELD.delivered]);

  if (range === "overdue") return daysOut < 0 && !delivered;
  if (range === "next-30") return daysOut >= 0 && daysOut <= 30 && !delivered;
  if (range === "30-90") return daysOut > 30 && daysOut <= 90;
  if (range === "90-6-months") return daysOut > 90 && required < sixMonthsSerial;
  if (range === "next-6-months") return daysOut >= 0 && required <= sixMonthsSerial && !delivered;
  if (range === "6-months-plus") return required >= sixMonthsSerial;
  return true;
}

function editableValue(row, header) {
  return displayValue(row, header) || "";
}

function normalizeEditedValue(header, value) {
  const text = clean(value);
  if (!text) return [FIELD.critical, FIELD.delivered].includes(header) ? false : null;
  if ([FIELD.released, FIELD.delivery, FIELD.required].includes(header)) {
    return excelSerialFromDate(text);
  }
  if ([FIELD.quantity, FIELD.lead, FIELD.remaining].includes(header)) {
    const valueNumber = Number(text);
    return Number.isFinite(valueNumber) ? valueNumber : text;
  }
  if ([FIELD.critical, FIELD.delivered].includes(header)) return Boolean(value);
  return text;
}

function rowDeliveries(row) {
  if (!Array.isArray(row._deliveries)) row._deliveries = [];
  return row._deliveries;
}

function quantityDelivered(row) {
  return rowDeliveries(row).reduce((total, delivery) => {
    const quantity = numeric(delivery.qtyDelivered);
    return total + (quantity === null ? 0 : quantity);
  }, 0);
}

function syncDeliveredFromDeliveryQuantity(row) {
  const requiredQuantity = numeric(row[FIELD.quantity]);
  if (requiredQuantity === null || requiredQuantity <= 0) return;
  row[FIELD.delivered] = quantityDelivered(row) >= requiredQuantity;
}

function formattedDeliveryDate(delivery) {
  return excelDate(delivery.deliveryDate) || clean(delivery.deliveryDate);
}

function formattedDeliveryMoney(value) {
  const amount = numeric(value);
  if (amount === null) return clean(value);
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function calculatedExpectedDelivery(row) {
  const released = numeric(row[FIELD.released]);
  const lead = numeric(row[FIELD.lead]);
  if (released === null || lead === null) return null;
  return released + lead;
}

function applyExpectedDeliveryCalculation(row, savedEdits = null, force = false) {
  const calculated = calculatedExpectedDelivery(row);
  if (calculated === null) return false;
  if (!force && clean(row[FIELD.delivery])) return false;
  row[FIELD.delivery] = calculated;
  if (savedEdits) savedEdits[FIELD.delivery] = calculated;
  return true;
}

function loadSavedEdits() {
  try {
    const saved = JSON.parse(localStorage.getItem(EDIT_PREF_KEY) || "{}");
    state.rows.forEach((row) => {
      const edits = saved[rowKey(row)];
      if (!edits) return;
      Object.entries(edits).forEach(([header, value]) => {
        row[header] = value;
      });
    });
  } catch {
    localStorage.removeItem(EDIT_PREF_KEY);
  }
}

function saveCellEdit(row, header, value) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(EDIT_PREF_KEY) || "{}");
  } catch {
    saved = {};
  }

  const key = rowKey(row);
  saved[key] = { ...(saved[key] || {}), [header]: value };
  row[header] = value;
  if ([FIELD.released, FIELD.lead].includes(header)) {
    applyExpectedDeliveryCalculation(row, saved[key], true);
  }
  if (header === FIELD.quantity) {
    syncDeliveredFromDeliveryQuantity(row);
    saved[key][FIELD.delivered] = row[FIELD.delivered];
  }
  localStorage.setItem(EDIT_PREF_KEY, JSON.stringify(saved));
  if (header === FIELD.provider) addAdminValue("suppliers", value, false);
  if (isAddedRow(row)) saveAddedItems();
  saveCurrentProjectRows();
}

function populateProjectSelect() {
  const activeProjects = state.projects.filter((project) => !project.archived || project.id === state.activeProjectId);
  els.projectSelect.innerHTML = activeProjects.map((project) => (
    `<option value="${escapeHtml(project.id)}" ${project.id === state.activeProjectId ? "selected" : ""}>${escapeHtml(project.name)}${project.archived ? " (Archived)" : ""}</option>`
  )).join("");
}

function saveAddedItems() {
  localStorage.setItem(ADDED_ITEMS_PREF_KEY, JSON.stringify(state.rows.filter(isAddedRow)));
  saveCurrentProjectRows();
}

function saveRowOrder() {
  localStorage.setItem(ROW_ORDER_PREF_KEY, JSON.stringify(state.rows.map(rowKey)));
}

function loadAddedItems() {
  try {
    const added = JSON.parse(localStorage.getItem(ADDED_ITEMS_PREF_KEY) || "[]");
    state.rows = [...added, ...state.rows];
  } catch {
    localStorage.removeItem(ADDED_ITEMS_PREF_KEY);
  }
}

function applySavedRowOrder() {
  try {
    const order = JSON.parse(localStorage.getItem(ROW_ORDER_PREF_KEY) || "[]");
    if (!order.length) return;
    const rowMap = new Map(state.rows.map((row) => [rowKey(row), row]));
    const orderedRows = order.map((key) => rowMap.get(key)).filter(Boolean);
    const orderedKeys = new Set(orderedRows.map(rowKey));
    const remainingRows = state.rows.filter((row) => !orderedKeys.has(rowKey(row)));
    state.rows = [...orderedRows, ...remainingRows];
  } catch {
    localStorage.removeItem(ROW_ORDER_PREF_KEY);
  }
}

function loadDeletedItems() {
  try {
    state.deletedRowKeys = new Set(JSON.parse(localStorage.getItem(DELETED_ITEMS_PREF_KEY) || "[]"));
    state.rows = state.rows.filter((row) => !state.deletedRowKeys.has(rowKey(row)));
  } catch {
    state.deletedRowKeys = new Set();
    localStorage.removeItem(DELETED_ITEMS_PREF_KEY);
  }
}

function saveDeletedItems() {
  localStorage.setItem(DELETED_ITEMS_PREF_KEY, JSON.stringify([...state.deletedRowKeys]));
  saveCurrentProjectRows();
}

function addItem() {
  const row = { _rowNumber: `new-${Date.now()}` };
  allTableHeaders().forEach((header) => {
    row[header] = [FIELD.critical, FIELD.delivered].includes(header) ? false : null;
  });
  state.rows.unshift(row);
  saveAddedItems();
  saveRowOrder();
  els.search.value = "";
  els.status.value = "all";
  els.area.value = "all";
  els.provider.value = "all";
  els.timing.value = "all";
  state.logColumnFilters = {};
  state.logSort = { column: null, direction: "asc" };
  saveLogControls();
  state.filtered = state.rows.filter(matchesFilters);
  renderColumnMenu();
  render();
  setView("log");
}

function clearLogPlacementFilters() {
  els.search.value = "";
  els.status.value = "all";
  els.area.value = "all";
  els.provider.value = "all";
  els.timing.value = "all";
  state.logColumnFilters = {};
  state.logSort = { column: null, direction: "asc" };
  saveLogControls();
}

function createBlankItem() {
  const row = { _rowNumber: `new-${Date.now()}-${Math.floor(Math.random() * 1000)}` };
  allTableHeaders().forEach((header) => {
    row[header] = [FIELD.critical, FIELD.delivered].includes(header) ? false : null;
  });
  return row;
}

function insertItemNearRow(targetRowKey, position) {
  const targetIndex = state.rows.findIndex((row) => rowKey(row) === targetRowKey);
  const row = createBlankItem();
  const insertIndex = targetIndex === -1
    ? 0
    : targetIndex + (position === "below" ? 1 : 0);
  state.rows.splice(insertIndex, 0, row);
  saveAddedItems();
  saveRowOrder();
  clearLogPlacementFilters();
  state.filtered = state.rows.filter(matchesFilters);
  renderColumnMenu();
  render();
  setView("log");
}

function removeItem(rowKeyValue) {
  const row = state.rows.find((candidate) => rowKey(candidate) === rowKeyValue);
  const label = clean(row?.[FIELD.tag]) || clean(row?.[FIELD.item]) || "this item";
  if (!confirm(`Remove ${label} from the log?`)) return;
  state.deletedRowKeys.add(rowKeyValue);
  state.rows = state.rows.filter((candidate) => rowKey(candidate) !== rowKeyValue);
  saveDeletedItems();
  saveAddedItems();
  saveRowOrder();
  state.filtered = state.rows.filter(matchesFilters);
  renderColumnMenu();
  render();
}

function formatNoteTimestamp(date = new Date()) {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseNotes(value) {
  const text = clean(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter((note) => note && clean(note.text));
  } catch {
    return [{ timestamp: "", initials: "Source", text }];
  }
  return [{ timestamp: "", initials: "Source", text }];
}

function serializeNotes(notes) {
  return JSON.stringify(notes);
}

function notesForExport(value) {
  return parseNotes(value).map((note) => {
    const meta = [note.timestamp, note.initials].filter(Boolean).join(" - ");
    const editedMeta = [note.editedTimestamp, note.editedInitials].filter(Boolean).join(" - ");
    const editedText = editedMeta ? `\nEdited ${editedMeta}` : "";
    return `${meta ? `${meta}: ` : ""}${note.text}${editedText}`;
  }).join("\n");
}

function deliveriesForExport(row) {
  return rowDeliveries(row).map((delivery, index) => {
    const parts = [
      `Delivery ${index + 1}`,
      formattedDeliveryDate(delivery),
      clean(delivery.ticketNumber) ? `Ticket: ${delivery.ticketNumber}` : "",
      clean(delivery.qtyDelivered) ? `Qty: ${delivery.qtyDelivered}` : "",
      clean(delivery.units) ? `Units: ${delivery.units}` : "",
      clean(delivery.unitPricePo) ? `Unit Price - PO: ${formattedDeliveryMoney(delivery.unitPricePo)}` : "",
      clean(delivery.unitPriceInvoice) ? `Unit Price - Invoice: ${formattedDeliveryMoney(delivery.unitPriceInvoice)}` : "",
      clean(delivery.notes) ? `Notes: ${delivery.notes}` : "",
    ].filter(Boolean);
    return parts.join(" | ");
  }).join("\n");
}

function xmlEscape(value) {
  return clean(value).replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[char]));
}

function exportValue(row, header) {
  if (header === FIELD.qtyDelivered) return quantityDelivered(row);
  if (header === FIELD.deliveries) return deliveriesForExport(row);
  if ([FIELD.critical, FIELD.delivered].includes(header)) return row[header] ? "Yes" : "No";
  if (header === FIELD.notes) return notesForExport(row[FIELD.notes]);
  if ([FIELD.released, FIELD.delivery, FIELD.required].includes(header)) return excelDate(row[header]) || "";
  if (header === FIELD.system) return displayValue(row, header);
  return row[header] ?? "";
}

function safeFileName(value) {
  return clean(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "material-log";
}

function buildExcelXml(title, worksheetRows) {
  const xmlRows = worksheetRows.map((row) => `
    <Row>
      ${row.map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join("")}
    </Row>
  `).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${xmlEscape(title)}</Title>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Material Log">
    <Table>
      ${xmlRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function downloadTextFile(contents, fileName, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
  const worksheetRows = [
    allTableHeaders(),
    allTableHeaders().map(() => ""),
  ];
  const xml = buildExcelXml("Material Log Import Template", worksheetRows);
  downloadTextFile(xml, "material-log-import-template.xls", "application/vnd.ms-excel;charset=utf-8");
}

function exportMaterialLog() {
  const project = activeProject();
  const headers = allTableHeaders();
  const rows = state.rows;
  const worksheetRows = [
    headers,
    ...rows.map((row) => headers.map((header) => exportValue(row, header))),
  ];
  const xml = buildExcelXml(project?.name || "Material Log", worksheetRows);
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(xml, `${safeFileName(project?.name)}-material-log-${dateStamp}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((line) => line.some((value) => clean(value)));
}

function parseExcelXml(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const rows = [...doc.getElementsByTagName("Row")];
  return rows.map((row) => [...row.getElementsByTagName("Cell")].map((cell) => {
    const data = cell.getElementsByTagName("Data")[0];
    return data?.textContent || "";
  })).filter((line) => line.some((value) => clean(value)));
}

function importedValue(header, value) {
  const text = clean(value);
  if ([FIELD.qtyDelivered, FIELD.deliveries].includes(header)) return null;
  if (!text) return [FIELD.critical, FIELD.delivered].includes(header) ? false : null;
  if ([FIELD.critical, FIELD.delivered].includes(header)) return ["YES", "TRUE", "Y", "1", "CRITICAL", "DELIVERED"].includes(normalizeKey(text));
  if (header === FIELD.notes) {
    return serializeNotes([{ timestamp: formatNoteTimestamp(), initials: "Import", text }]);
  }
  return normalizeEditedValue(header, text);
}

function rowsFromImportGrid(grid) {
  if (!grid.length) return [];
  const expectedHeaders = allTableHeaders();
  const headerRow = grid[0].map(clean);
  const headerMap = new Map(headerRow.map((header, index) => [normalizeKey(header), index]));
  const hasKnownHeaders = expectedHeaders.some((header) => headerMap.has(normalizeKey(header)));
  const dataRows = hasKnownHeaders ? grid.slice(1) : grid;

  return dataRows.map((line) => {
    const row = { _rowNumber: `new-${Date.now()}-${Math.floor(Math.random() * 1000000)}` };
    expectedHeaders.forEach((header, index) => {
      const sourceIndex = hasKnownHeaders ? headerMap.get(normalizeKey(header)) : index;
      row[header] = importedValue(header, sourceIndex === undefined ? "" : line[sourceIndex]);
    });
    applyExpectedDeliveryCalculation(row);
    return row;
  }).filter((row) => expectedHeaders.some((header) => ![FIELD.critical, FIELD.delivered, FIELD.qtyDelivered, FIELD.deliveries].includes(header) && clean(row[header])));
}

async function importMaterialLog() {
  const file = els.importFile.files?.[0];
  if (!file) {
    els.importStatus.textContent = "Choose a file first";
    return;
  }

  const text = await file.text();
  const extension = file.name.split(".").pop().toLowerCase();
  const grid = extension === "xls" || extension === "xml"
    ? parseExcelXml(text)
    : parseDelimited(text, extension === "csv" ? "," : "\t");
  const rows = rowsFromImportGrid(grid);

  if (!rows.length) {
    els.importStatus.textContent = "No rows found";
    return;
  }

  if (els.importMode.value === "replace" && !confirm(`Replace the current project log with ${rows.length} imported item(s)?`)) {
    return;
  }

  state.rows = els.importMode.value === "replace" ? rows : [...state.rows, ...rows];
  state.filtered = state.rows.filter(matchesFilters);
  saveCurrentProjectRows();
  loadAdminLists();
  populateGlobalFilters();
  populateProjectSelect();
  renderColumnMenu();
  render();
  setView("log");
  els.importStatus.textContent = `${rows.length} item(s) imported`;
  els.importFile.value = "";
}

function ensureUserInitials() {
  if (clean(state.userInitials)) return clean(state.userInitials).toUpperCase();
  const entered = prompt("Enter your initials for timeline notes:");
  const initials = clean(entered).toUpperCase();
  if (!initials) return "";
  state.userInitials = initials;
  localStorage.setItem(INITIALS_PREF_KEY, initials);
  if (els.userInitialsInput) els.userInitialsInput.value = initials;
  return initials;
}

function appendNote(row) {
  const initials = ensureUserInitials();
  if (!initials) return;
  const text = prompt("Add note:");
  if (!clean(text)) return;
  const notes = parseNotes(row[FIELD.notes]);
  notes.push({
    timestamp: formatNoteTimestamp(),
    initials,
    text: clean(text),
  });
  saveCellEdit(row, FIELD.notes, serializeNotes(notes));
  state.filtered = state.rows.filter(matchesFilters);
  renderLog();
  renderDashboard();
  renderProcurement();
}

function editItemNote(row, noteIndex) {
  const notes = parseNotes(row[FIELD.notes]);
  const note = notes[noteIndex];
  if (!note) return;
  const updatedText = prompt("Edit note:", note.text);
  if (updatedText === null) return;
  if (!clean(updatedText)) return;
  const initials = ensureUserInitials();
  if (!initials) return;
  notes[noteIndex] = {
    ...note,
    text: clean(updatedText),
    editedTimestamp: formatNoteTimestamp(),
    editedInitials: initials,
  };
  saveCellEdit(row, FIELD.notes, serializeNotes(notes));
  state.filtered = state.rows.filter(matchesFilters);
  renderLog();
  renderDashboard();
  renderProcurement();
}

function developmentNoteCounts() {
  return state.developmentNotes.reduce((counts, note) => {
    const status = note.status || "open";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { open: 0, implemented: 0, rejected: 0 });
}

function saveDevelopmentNotes() {
  localStorage.setItem(DEVELOPMENT_NOTES_PREF_KEY, JSON.stringify(state.developmentNotes));
  queueSharedSave();
}

function loadDevelopmentNotes() {
  if (state.cloudReady) return;
  state.developmentNotes = safeJsonParse(localStorage.getItem(DEVELOPMENT_NOTES_PREF_KEY), []);
}

function addDevelopmentNote(text, initials) {
  const noteText = clean(text);
  if (!noteText) return;
  const author = clean(initials || state.userInitials).toUpperCase() || "USER";
  state.developmentNotes.unshift({
    id: `dev-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    text: noteText,
    initials: author,
    createdAt: new Date().toISOString(),
    status: "open",
  });
  state.userInitials = author === "USER" ? state.userInitials : author;
  if (state.userInitials) {
    localStorage.setItem(INITIALS_PREF_KEY, state.userInitials);
    if (els.userInitialsInput) els.userInitialsInput.value = state.userInitials;
  }
  saveDevelopmentNotes();
  renderDevelopmentNotes();
}

function updateDevelopmentNoteStatus(noteId, status) {
  const note = state.developmentNotes.find((item) => item.id === noteId);
  if (!note) return;
  note.status = status;
  note.resolvedAt = status === "open" ? "" : new Date().toISOString();
  saveDevelopmentNotes();
  renderDevelopmentNotes();
}

function uniqueSorted(values) {
  return [...new Set(values.map(clean).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function seedAdminLists() {
  state.adminLists = {
    suppliers: uniqueSorted(state.rows.map((row) => row[FIELD.provider])),
    statuses: uniqueSorted(state.rows.map((row) => row[FIELD.status])),
  };
}

function loadAdminLists() {
  if (state.adminListsLoadedFromCloud) {
    state.adminLists = {
      suppliers: uniqueSorted(state.adminLists.suppliers || []),
      statuses: uniqueSorted(state.adminLists.statuses || []),
    };
    return;
  }
  seedAdminLists();
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_PREF_KEY) || "{}");
    state.adminLists.suppliers = uniqueSorted([...(state.adminLists.suppliers || []), ...(saved.suppliers || [])]);
    state.adminLists.statuses = uniqueSorted([...(state.adminLists.statuses || []), ...(saved.statuses || [])]);
  } catch {
    localStorage.removeItem(ADMIN_PREF_KEY);
  }
}

function saveAdminLists() {
  localStorage.setItem(ADMIN_PREF_KEY, JSON.stringify(state.adminLists));
  queueSharedSave();
}

function addAdminValue(listName, value, rerender = true) {
  const text = clean(value);
  if (!text) return;
  state.adminLists[listName] = uniqueSorted([...(state.adminLists[listName] || []), text]);
  saveAdminLists();
  if (rerender) {
    renderAdmin();
    renderLog();
    populateGlobalFilters();
  }
}

function removeAdminValue(listName, value) {
  const text = clean(value);
  state.adminLists[listName] = (state.adminLists[listName] || []).filter((item) => item !== text);
  saveAdminLists();
  renderAdmin();
  renderLog();
  populateGlobalFilters();
}

function renameStatus(oldValue) {
  const oldStatus = clean(oldValue);
  if (!oldStatus) return;
  const newStatus = clean(prompt("Rename submittal status:", oldStatus));
  if (!newStatus || newStatus === oldStatus) return;

  state.adminLists.statuses = uniqueSorted(
    state.adminLists.statuses.map((status) => (status === oldStatus ? newStatus : status)),
  );

  state.rows.forEach((row) => {
    if (clean(row[FIELD.status]) === oldStatus) {
      saveCellEdit(row, FIELD.status, newStatus);
    }
  });

  saveAdminLists();
  state.filtered = state.rows.filter(matchesFilters);
  renderAdmin();
  renderLog();
  renderDashboard();
  renderProcurement();
  populateGlobalFilters();
}

function statusClass(status) {
  const key = normalizeKey(status);
  if (key.includes("APPROVED") || key === "CLOSED" || key === "PURCHASED") return "ok";
  if (key.includes("REQUEST") || key.includes("QUOTE") || key.includes("SUBMIT")) return "warn";
  if (key.includes("RAN") || key.includes("RAR") || key.includes("NET")) return "danger";
  return "";
}

function timing(row) {
  const remaining = numeric(row[FIELD.remaining]);
  if (remaining === null) return "No timing";
  if (remaining <= 0) return "Late / due now";
  if (remaining <= 30) return "Due within 30 days";
  return `${remaining} days out`;
}

function attentionRank(row) {
  const remaining = numeric(row[FIELD.remaining]);
  const releaseMissing = !clean(row[FIELD.released]);
  const deliveryMissing = !clean(row[FIELD.delivery]);
  let score = 0;
  if (remaining !== null && remaining <= 0) score += 4;
  if (remaining !== null && remaining <= 30) score += 2;
  if (releaseMissing) score += 2;
  if (deliveryMissing) score += 2;
  if (!clean(row[FIELD.status])) score += 1;
  return score;
}

function countBy(rows, field) {
  return rows.reduce((map, row) => {
    const key = clean(row[field]) || "Blank";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function sortedCounts(rows, field) {
  return [...countBy(rows, field).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function populateSelect(select, label, rows, field) {
  const options = [...new Set(rows.map((row) => clean(row[field])).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  select.innerHTML = [`<option value="all">All ${label}</option>`]
    .concat(options.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
}

function populateGlobalFilters() {
  const statusRows = uniqueSorted([...state.adminLists.statuses, ...state.rows.map((row) => row[FIELD.status])])
    .map((status) => ({ [FIELD.status]: status }));
  const providerRows = uniqueSorted([...state.adminLists.suppliers, ...state.rows.map((row) => row[FIELD.provider])])
    .map((provider) => ({ [FIELD.provider]: provider }));
  populateSelect(els.status, "statuses", statusRows, FIELD.status);
  populateSelect(els.area, "areas", state.rows, FIELD.area);
  populateSelect(els.provider, "providers", providerRows, FIELD.provider);
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function matchesFilters(row) {
  const term = normalizeKey(els.search.value);
  const searchable = normalizeKey([
    row[FIELD.drawing],
    row[FIELD.tag],
    row[FIELD.item],
    row[FIELD.quantity],
    row[FIELD.units],
    quantityDelivered(row),
    deliveriesForExport(row),
    row[FIELD.spec],
    row[FIELD.provider],
    row[FIELD.area],
    row[FIELD.room],
    displayValue(row, FIELD.system),
    row[FIELD.submittal],
    row[FIELD.status],
    row[FIELD.notes],
  ].join(" "));

  if (term && !searchable.includes(term)) return false;
  if (els.status.value !== "all" && clean(row[FIELD.status]) !== els.status.value) return false;
  if (els.area.value !== "all" && clean(row[FIELD.area]) !== els.area.value) return false;
  if (els.provider.value !== "all" && clean(row[FIELD.provider]) !== els.provider.value) return false;

  const remaining = numeric(row[FIELD.remaining]);
  if (els.timing.value === "late" && !(remaining !== null && remaining <= 0)) return false;
  if (els.timing.value === "30" && !(remaining !== null && remaining >= 0 && remaining <= 30)) return false;
  if (els.timing.value === "missing-release" && clean(row[FIELD.released])) return false;
  if (els.timing.value === "missing-delivery" && clean(row[FIELD.delivery])) return false;

  return true;
}

function applyFilters() {
  state.filtered = state.rows.filter(matchesFilters);
  render();
}

function renderKpis(rows) {
  const late = rows.filter((row) => numeric(row[FIELD.remaining]) !== null && numeric(row[FIELD.remaining]) <= 0).length;
  const dueSoon = rows.filter((row) => {
    const days = numeric(row[FIELD.remaining]);
    return days !== null && days > 0 && days <= 30;
  }).length;
  const missingDelivery = rows.filter((row) => !clean(row[FIELD.delivery])).length;
  const providers = new Set(rows.map((row) => clean(row[FIELD.provider])).filter(Boolean)).size;

  const cards = [
    ["Total Items", rows.length, "Rows from the imported log"],
    ["Late / Due Now", late, "Based on days remaining"],
    ["Due Within 30", dueSoon, "Upcoming required onsite dates"],
    ["Providers", providers, `${missingDelivery} missing expected delivery`],
  ];

  els.kpiGrid.innerHTML = cards.map(([label, value, note]) => `
    <article class="panel kpi">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${note}</p>
    </article>
  `).join("");
}

function projectMetrics(rows) {
  const today = todayExcelSerial();
  const sixMonths = excelSerialFromDate(addMonths(new Date(), 6).toISOString().slice(0, 10));
  return rows.reduce((metrics, row) => {
    const required = numeric(row[FIELD.required]);
    const delivered = Boolean(row[FIELD.delivered]);
    metrics.total += 1;
    if (row[FIELD.critical]) metrics.critical += 1;
    if (required !== null && required < today && !delivered) metrics.overdue += 1;
    if (required !== null && required >= today && required <= today + 30 && !delivered) metrics.due30 += 1;
    if (required !== null && required >= today && required <= sixMonths && !delivered) metrics.due6Months += 1;
    return metrics;
  }, {
    total: 0,
    overdue: 0,
    due30: 0,
    due6Months: 0,
    critical: 0,
  });
}

function resetTopFilters() {
  els.search.value = "";
  els.status.value = "all";
  els.area.value = "all";
  els.provider.value = "all";
  els.timing.value = "all";
}

function openProjectLogWithRequiredDateFilter(projectId, range) {
  loadProject(projectId);
  resetTopFilters();
  state.logColumnFilters = range ? { [FIELD.required]: range } : {};
  state.logSort = { column: FIELD.required, direction: "asc" };
  saveLogControls();
  state.filtered = state.rows.filter(matchesFilters);
  renderLog();
  setView("log");
}

function openProjectLogWithCriticalFilter(projectId) {
  loadProject(projectId);
  resetTopFilters();
  state.logColumnFilters = { [FIELD.critical]: "true" };
  state.logSort = { column: FIELD.critical, direction: "desc" };
  saveLogControls();
  state.filtered = state.rows.filter(matchesFilters);
  renderLog();
  setView("log");
}

function renderDashboard() {
  els.projectDashboard.innerHTML = state.projects.map((project) => {
    const rows = loadRowsForProject(project);
    const metrics = projectMetrics(rows);
    return `
      <article class="panel project-card ${project.archived ? "is-archived" : ""}">
        <div class="project-card-header">
          <div>
            <h3>${escapeHtml(project.name)}</h3>
            <span class="badge ${project.archived ? "warn" : "ok"}">${project.archived ? "Archived" : "Active"}</span>
          </div>
          <button class="ghost-button" type="button" data-open-project="${escapeHtml(project.id)}">${project.archived ? "View" : "Open"}</button>
        </div>
        <div class="project-metrics">
          <div><span>Total Items</span><strong>${metrics.total}</strong></div>
          <button class="metric-button" type="button" data-project-filter="${escapeHtml(project.id)}" data-required-range="overdue"><span>Items Overdue</span><strong>${metrics.overdue}</strong></button>
          <button class="metric-button" type="button" data-project-filter="${escapeHtml(project.id)}" data-required-range="next-30"><span>Items Due Within 30-Days</span><strong>${metrics.due30}</strong></button>
          <button class="metric-button" type="button" data-project-filter="${escapeHtml(project.id)}" data-required-range="next-6-months"><span>Items Due Within 6-Months</span><strong>${metrics.due6Months}</strong></button>
          <button class="metric-button" type="button" data-critical-project="${escapeHtml(project.id)}"><span>Critical Items</span><strong>${metrics.critical}</strong></button>
        </div>
      </article>
    `;
  }).join("") || `<p class="empty">No projects have been added.</p>`;

  document.querySelectorAll("[data-open-project]").forEach((button) => {
    button.addEventListener("click", () => {
      loadProject(button.dataset.openProject);
      setView("log");
    });
  });

  document.querySelectorAll("[data-project-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      openProjectLogWithRequiredDateFilter(button.dataset.projectFilter, button.dataset.requiredRange);
    });
  });

  document.querySelectorAll("[data-critical-project]").forEach((button) => {
    button.addEventListener("click", () => {
      openProjectLogWithCriticalFilter(button.dataset.criticalProject);
    });
  });
}

function renderList(target, rows, emptyText) {
  if (!rows.length) {
    target.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }

  target.innerHTML = rows.map((row) => `
    <article class="list-row">
      <div class="title-line">
        <span>${escapeHtml(row[FIELD.tag] || "No tag")} · ${escapeHtml(row[FIELD.item])}</span>
        <span class="badge ${statusClass(row[FIELD.status])}">${escapeHtml(row[FIELD.status] || "No status")}</span>
      </div>
      <div class="meta">${escapeHtml(row[FIELD.area])} · ${escapeHtml(row[FIELD.provider])}</div>
      <div class="meta">Required onsite: ${escapeHtml(excelDate(row[FIELD.required]) || "Not set")} · ${escapeHtml(timing(row))}</div>
    </article>
  `).join("");
}

function renderBars(target, rows, field, limit = 8) {
  const counts = sortedCounts(rows, field).slice(0, limit);
  const max = counts[0]?.[1] || 1;
  target.innerHTML = counts.map(([label, value]) => `
    <div class="bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${(value / max) * 100}%"></div></div>
      <strong>${value}</strong>
    </div>
  `).join("") || `<p class="empty">No records match the current filters.</p>`;
}

function renderTable(head, body, rows, headers, raw = false) {
  const visibleHeaders = headers.filter((header) => !state.hiddenColumns.has(header));
  head.innerHTML = visibleHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  body.innerHTML = rows.map((row) => `
    <tr>
      ${visibleHeaders.map((header) => {
        const value = raw ? row[header] : row[header];
        const isDate = [FIELD.released, FIELD.delivery, FIELD.required].includes(header);
        const display = isDate ? excelDate(value) : value;
        const dateConflict = numeric(row[FIELD.delivery]) !== null
          && numeric(row[FIELD.required]) !== null
          && numeric(row[FIELD.delivery]) > numeric(row[FIELD.required])
          && [FIELD.delivery, FIELD.required].includes(header);
        if (header === FIELD.status) {
          return `<td><span class="badge ${statusClass(display)}">${escapeHtml(display)}</span></td>`;
        }
        return `<td class="${dateConflict ? "date-conflict" : ""}">${escapeHtml(display)}</td>`;
      }).join("")}
    </tr>
  `).join("");
}

function displayValue(row, header) {
  if (header === FIELD.system) return row[FIELD.system] ?? row[LEGACY_ROOM_SYSTEM_FIELD] ?? "";
  const value = row[header];
  if (header === FIELD.qtyDelivered) return quantityDelivered(row);
  if (header === FIELD.deliveries) return deliveriesForExport(row);
  if (header === FIELD.critical) return value ? "Critical" : "";
  if (header === FIELD.delivered) return value ? "Delivered" : "";
  return [FIELD.released, FIELD.delivery, FIELD.required].includes(header) ? excelDate(value) : value;
}

function sortValue(row, header) {
  if (header === FIELD.qtyDelivered) return quantityDelivered(row);
  if (header === FIELD.critical) return row[FIELD.critical] ? 1 : 0;
  if (header === FIELD.delivered) return row[FIELD.delivered] ? 1 : 0;
  if ([FIELD.quantity, FIELD.released, FIELD.delivery, FIELD.required, FIELD.lead, FIELD.remaining].includes(header)) {
    const value = numeric(row[header]);
    return value === null ? Number.POSITIVE_INFINITY : value;
  }
  return normalizeKey(displayValue(row, header));
}

function dateConflict(row, header) {
  return numeric(row[FIELD.delivery]) !== null
    && numeric(row[FIELD.required]) !== null
    && numeric(row[FIELD.delivery]) > numeric(row[FIELD.required])
    && [FIELD.delivery, FIELD.required].includes(header);
}

function logHeaders() {
  return [FIELD.drawing, FIELD.tag, FIELD.item, FIELD.quantity, FIELD.units, FIELD.qtyDelivered, FIELD.spec, FIELD.provider, FIELD.area, FIELD.room, FIELD.system, FIELD.submittal, FIELD.status, FIELD.released, FIELD.lead, FIELD.delivery, FIELD.required, FIELD.critical, FIELD.delivered, FIELD.deliveries, FIELD.stored, FIELD.remaining, FIELD.notes];
}

function columnOptions(header) {
  if (header === FIELD.provider) return state.adminLists.suppliers;
  if (header === FIELD.status) return state.adminLists.statuses;
  return [...new Set(state.rows.map((row) => clean(displayValue(row, header))).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function listIdForColumn(header) {
  return `list-${header.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
}

function visibleLogHeaders() {
  return logHeaders().filter((header) => !state.hiddenColumns.has(header));
}

function getLogRows() {
  const activeFilters = Object.entries(state.logColumnFilters)
    .filter(([, value]) => clean(value));

  let rows = state.filtered.filter((row) => activeFilters.every(([header, value]) => {
    if (header === FIELD.required) return matchesRequiredDateRange(row, value);
    if (header === FIELD.critical) return value === "true" ? Boolean(row[FIELD.critical]) : !Boolean(row[FIELD.critical]);
    return normalizeKey(displayValue(row, header)).includes(normalizeKey(value));
  }));

  if (state.logSort.column) {
    const { column, direction } = state.logSort;
    rows = [...rows].sort((a, b) => {
      const aValue = sortValue(a, column);
      const bValue = sortValue(b, column);
      const result = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue));
      return direction === "asc" ? result : -result;
    });
  }

  return rows;
}

function saveLogControls() {
  localStorage.setItem(LOG_FILTER_PREF_KEY, JSON.stringify(state.logColumnFilters));
  localStorage.setItem(LOG_SORT_PREF_KEY, JSON.stringify(state.logSort));
}

function syncTopScrollbarWidth() {
  if (!els.tableShell || !els.tableScrollTopInner) return;
  els.tableScrollTopInner.style.width = `${els.tableShell.scrollWidth}px`;
  if (els.tableScrollTop) {
    els.tableScrollTop.scrollLeft = els.tableShell.scrollLeft;
  }
}

function bindTableScrollbars() {
  if (!els.tableShell || !els.tableScrollTop) return;
  let syncing = false;
  els.tableShell.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    els.tableScrollTop.scrollLeft = els.tableShell.scrollLeft;
    syncing = false;
  });
  els.tableScrollTop.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    els.tableShell.scrollLeft = els.tableScrollTop.scrollLeft;
    syncing = false;
  });
  window.addEventListener("resize", syncTopScrollbarWidth);
}

function closeColumnFilterMenus(exceptId = "") {
  els.logHead.querySelectorAll(".column-filter-menu").forEach((menu) => {
    if (menu.id !== exceptId) menu.hidden = true;
  });
}

function openColumnFilterMenu(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  closeColumnFilterMenus(menuId);
  menu.hidden = false;
}

function renderLogHead() {
  const headers = visibleLogHeaders();
  els.logHead.innerHTML = `
    <th>
      <div class="th-control">
        <span>Actions</span>
      </div>
    </th>
    ${headers.map((header) => {
    const isSorted = state.logSort.column === header;
    const indicator = isSorted ? (state.logSort.direction === "asc" ? "ASC" : "DESC") : "";
    const hasAutocomplete = AUTOCOMPLETE_FILTERS.has(header);
    const datalistId = listIdForColumn(header);
    const options = hasAutocomplete ? columnOptions(header) : [];
    let filterControl = hasAutocomplete
      ? `
        <div class="column-filter-combo">
          <input class="column-filter-input" data-filter-column="${escapeHtml(header)}" data-filter-menu="${escapeHtml(datalistId)}" value="${escapeHtml(state.logColumnFilters[header] || "")}" placeholder="Filter" autocomplete="off" />
          <button class="filter-menu-button" type="button" data-filter-menu-toggle="${escapeHtml(datalistId)}" aria-label="Show ${escapeHtml(header)} filter options">▾</button>
          <div class="column-filter-menu" id="${escapeHtml(datalistId)}" hidden>
            ${options.map((value) => `<button type="button" data-filter-option="${escapeHtml(header)}" data-filter-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("") || `<span>No values yet</span>`}
          </div>
        </div>
      `
      : `
        <input class="column-filter-input" data-filter-column="${escapeHtml(header)}" value="${escapeHtml(state.logColumnFilters[header] || "")}" placeholder="Filter" />
      `;
    if (header === FIELD.required) {
      filterControl = `
        <select class="column-filter-input" data-filter-column="${escapeHtml(header)}">
          ${requiredDateRangeOptions().map(([value, label]) => `<option value="${escapeHtml(value)}" ${state.logColumnFilters[header] === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      `;
    }
    if (header === FIELD.critical) {
      filterControl = `
        <select class="column-filter-input" data-filter-column="${escapeHtml(header)}">
          <option value="" ${state.logColumnFilters[header] ? "" : "selected"}>All items</option>
          <option value="true" ${state.logColumnFilters[header] === "true" ? "selected" : ""}>Critical only</option>
          <option value="false" ${state.logColumnFilters[header] === "false" ? "selected" : ""}>Not critical</option>
        </select>
      `;
    }
    return `
      <th>
        <div class="th-control">
          <button class="sort-button" type="button" data-sort-column="${escapeHtml(header)}">
            <span>${escapeHtml(header)}</span>
            <span class="sort-indicator">${indicator}</span>
          </button>
          ${filterControl}
        </div>
      </th>
    `;
  }).join("")}
  `;

  els.logHead.querySelectorAll("[data-sort-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const column = button.dataset.sortColumn;
      if (state.logSort.column === column) {
        state.logSort.direction = state.logSort.direction === "asc" ? "desc" : "asc";
      } else {
        state.logSort = { column, direction: "asc" };
      }
      saveLogControls();
      renderLog();
    });
  });

  els.logHead.querySelectorAll("[data-filter-column]").forEach((input) => {
    input.addEventListener("input", () => {
      state.logColumnFilters[input.dataset.filterColumn] = input.value;
      saveLogControls();
      renderLogBody();
    });
    input.addEventListener("focus", () => {
      if (input.dataset.filterMenu) openColumnFilterMenu(input.dataset.filterMenu);
    });
    input.addEventListener("click", () => {
      if (input.dataset.filterMenu) openColumnFilterMenu(input.dataset.filterMenu);
    });
  });

  els.logHead.querySelectorAll("[data-filter-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      openColumnFilterMenu(button.dataset.filterMenuToggle);
    });
  });

  els.logHead.querySelectorAll("[data-filter-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const header = button.dataset.filterOption;
      const input = [...els.logHead.querySelectorAll("[data-filter-column]")]
        .find((control) => control.dataset.filterColumn === header);
      if (!input) return;
      input.value = button.dataset.filterValue;
      state.logColumnFilters[header] = input.value;
      saveLogControls();
      closeColumnFilterMenus();
      renderLogBody();
    });
  });
}

function tabbableLogHeaders() {
  return visibleLogHeaders().filter((header) => ![FIELD.qtyDelivered, FIELD.deliveries, FIELD.notes].includes(header));
}

function focusLogField(rowKeyValue, header) {
  const escapeSelector = (value) => (window.CSS?.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"'));
  const selector = `[data-log-field-row="${escapeSelector(rowKeyValue)}"][data-log-field-column="${escapeSelector(header)}"]`;
  const target = els.logBody.querySelector(selector);
  if (!target) return;
  target.focus();
  if (target.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function focusAdjacentLogField(rowKeyValue, header, direction = 1) {
  const rows = getLogRows();
  const headers = tabbableLogHeaders();
  const positions = [];
  rows.forEach((row) => {
    headers.forEach((fieldHeader) => {
      positions.push({ rowKeyValue: rowKey(row), header: fieldHeader });
    });
  });
  if (!positions.length) return;
  const currentIndex = positions.findIndex((position) => position.rowKeyValue === rowKeyValue && position.header === header);
  const fallbackIndex = direction > 0 ? 0 : positions.length - 1;
  const nextIndex = currentIndex === -1
    ? fallbackIndex
    : Math.min(Math.max(currentIndex + direction, 0), positions.length - 1);
  const next = positions[nextIndex];
  requestAnimationFrame(() => focusLogField(next.rowKeyValue, next.header));
}

function bindLogFieldTabbing() {
  els.logBody.querySelectorAll("[data-log-field-row]").forEach((control) => {
    if (control.isContentEditable) return;
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      focusAdjacentLogField(control.dataset.logFieldRow, control.dataset.logFieldColumn, event.shiftKey ? -1 : 1);
    });
  });
}

function commitEditableCell(cell) {
  const row = state.rows.find((candidate) => rowKey(candidate) === cell.dataset.editRow);
  if (!row) return false;
  const header = cell.dataset.editColumn;
  const value = normalizeEditedValue(header, cell.textContent);
  saveCellEdit(row, header, value);
  state.filtered = state.rows.filter(matchesFilters);
  renderAdmin();
  populateGlobalFilters();
  renderColumnMenu();
  renderLog();
  renderDashboard();
  renderProcurement();
  return true;
}

function bindEditableCells() {
  els.logBody.querySelectorAll("[data-edit-column]").forEach((cell) => {
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        cell.blur();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const rowKeyValue = cell.dataset.editRow;
        const header = cell.dataset.editColumn;
        cell.dataset.skipBlurCommit = "true";
        commitEditableCell(cell);
        focusAdjacentLogField(rowKeyValue, header, event.shiftKey ? -1 : 1);
      }
    });

    cell.addEventListener("blur", () => {
      if (cell.dataset.skipBlurCommit === "true") return;
      commitEditableCell(cell);
    });
  });
}

function bindStatusSelects() {
  els.logBody.querySelectorAll("[data-status-row]").forEach((select) => {
    select.addEventListener("change", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === select.dataset.statusRow);
      if (!row) return;
      saveCellEdit(row, FIELD.status, normalizeEditedValue(FIELD.status, select.value));
      state.filtered = state.rows.filter(matchesFilters);
      renderLog();
      renderDashboard();
      renderProcurement();
      populateGlobalFilters();
    });
  });
}

function bindLogCheckboxes() {
  els.logBody.querySelectorAll("[data-checkbox-row]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === checkbox.dataset.checkboxRow);
      if (!row) return;
      saveCellEdit(row, checkbox.dataset.checkboxColumn, checkbox.checked);
      state.filtered = state.rows.filter(matchesFilters);
      renderLog();
      renderDashboard();
      renderProcurement();
    });
  });
}

function normalizedNumberOrText(value) {
  const text = clean(value);
  if (!text) return null;
  const valueNumber = Number(text.replace(/[$,]/g, ""));
  return Number.isFinite(valueNumber) ? valueNumber : text;
}

function deliveryDetailsFromForm(existing = {}) {
  return {
    ...existing,
    id: existing.id || `delivery-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    deliveryDate: clean(els.deliveryDate.value) ? excelSerialFromDate(els.deliveryDate.value) : null,
    ticketNumber: clean(els.deliveryTicket.value),
    qtyDelivered: normalizedNumberOrText(els.deliveryQty.value),
    units: clean(els.deliveryUnits.value),
    unitPricePo: normalizedNumberOrText(els.deliveryUnitPricePo.value),
    unitPriceInvoice: normalizedNumberOrText(els.deliveryUnitPriceInvoice.value),
    notes: clean(els.deliveryNotes.value),
    updatedAt: new Date().toISOString(),
  };
}

function closeDeliveryDialog() {
  if (!els.deliveryDialog) return;
  els.deliveryDialog.close();
  state.deliveryEditor = { rowKey: "", index: null };
}

function openDeliveryDialog(row, index = null) {
  const deliveries = rowDeliveries(row);
  const existing = index === null ? {} : deliveries[index] || {};
  state.deliveryEditor = { rowKey: rowKey(row), index };
  els.deliveryDialogTitle.textContent = index === null ? "Add Delivery" : "Edit Delivery";
  const itemLabel = clean(row[FIELD.item]) || "No item description";
  const itemContext = [
    clean(row[FIELD.tag]) ? `Tag: ${clean(row[FIELD.tag])}` : "",
    clean(row[FIELD.quantity]) ? `Qty: ${clean(row[FIELD.quantity])}` : "",
    clean(row[FIELD.units]) ? `Units: ${clean(row[FIELD.units])}` : "",
  ].filter(Boolean).join(" | ");
  els.deliveryDialogItem.textContent = itemContext ? `${itemLabel} (${itemContext})` : itemLabel;
  els.deliveryDate.value = formattedDeliveryDate(existing) || "";
  els.deliveryTicket.value = clean(existing.ticketNumber);
  els.deliveryQty.value = clean(existing.qtyDelivered);
  els.deliveryUnits.value = clean(existing.units);
  els.deliveryUnitPricePo.value = clean(existing.unitPricePo);
  els.deliveryUnitPriceInvoice.value = clean(existing.unitPriceInvoice);
  els.deliveryNotes.value = clean(existing.notes);
  els.deliveryDialog.showModal();
  els.deliveryDate.focus();
}

function saveDeliveryDialog() {
  const row = state.rows.find((candidate) => rowKey(candidate) === state.deliveryEditor.rowKey);
  if (!row) return;
  const deliveries = rowDeliveries(row);
  const index = state.deliveryEditor.index;
  const existing = index === null ? {} : deliveries[index] || {};
  const delivery = deliveryDetailsFromForm(existing);
  if (index === null) {
    deliveries.push({
      ...delivery,
      createdAt: delivery.updatedAt,
    });
  } else {
    deliveries[index] = delivery;
  }
  closeDeliveryDialog();
  saveDeliveryChanges(row);
}

function saveDeliveryChanges(row) {
  syncDeliveredFromDeliveryQuantity(row);
  if (isAddedRow(row)) saveAddedItems();
  saveCurrentProjectRows();
  state.filtered = state.rows.filter(matchesFilters);
  renderLog();
  renderDashboard();
  renderProcurement();
}

function addDelivery(row) {
  openDeliveryDialog(row);
}

function editDelivery(row, index) {
  const deliveries = rowDeliveries(row);
  const delivery = deliveries[index];
  if (!delivery) return;
  openDeliveryDialog(row, index);
}

function removeDelivery(row, index) {
  const deliveries = rowDeliveries(row);
  const delivery = deliveries[index];
  if (!delivery) return;
  const label = clean(delivery.ticketNumber) || formattedDeliveryDate(delivery) || `delivery ${index + 1}`;
  if (!confirm(`Remove ${label}?`)) return;
  deliveries.splice(index, 1);
  saveDeliveryChanges(row);
}

function bindDeliveryButtons() {
  els.logBody.querySelectorAll("[data-add-delivery-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === button.dataset.addDeliveryRow);
      if (row) addDelivery(row);
    });
  });
  els.logBody.querySelectorAll("[data-edit-delivery-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === button.dataset.editDeliveryRow);
      if (row) editDelivery(row, Number(button.dataset.deliveryIndex));
    });
  });
  els.logBody.querySelectorAll("[data-remove-delivery-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === button.dataset.removeDeliveryRow);
      if (row) removeDelivery(row, Number(button.dataset.deliveryIndex));
    });
  });
}

function bindNoteButtons() {
  els.logBody.querySelectorAll("[data-add-note-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === button.dataset.addNoteRow);
      if (row) appendNote(row);
    });
  });
  els.logBody.querySelectorAll("[data-edit-note-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = state.rows.find((candidate) => rowKey(candidate) === button.dataset.editNoteRow);
      if (row) editItemNote(row, Number(button.dataset.noteIndex));
    });
  });
}

function renderNotesCell(row) {
  const notes = parseNotes(row[FIELD.notes]);
  const key = rowKey(row);
  return `
    <td class="notes-cell">
      <div class="note-timeline">
        ${notes.map((note, index) => `
          <div class="note-entry">
            <div class="note-entry-header">
              <div class="note-meta">${escapeHtml([note.timestamp, note.initials].filter(Boolean).join(" · "))}</div>
              <button class="note-edit-button" type="button" data-edit-note-row="${escapeHtml(key)}" data-note-index="${index}">Edit</button>
            </div>
            <div class="note-text">${escapeHtml(note.text)}</div>
            ${note.editedTimestamp ? `<div class="note-edited-meta">${escapeHtml(["Edited", note.editedTimestamp, note.editedInitials].filter(Boolean).join(" · "))}</div>` : ""}
          </div>
        `).join("") || `<div class="meta">No notes yet.</div>`}
        <button class="add-note-button" type="button" data-add-note-row="${escapeHtml(key)}">Add Note</button>
      </div>
    </td>
  `;
}

function renderDeliveriesCell(row) {
  const deliveries = rowDeliveries(row);
  const key = rowKey(row);
  const deliveredQuantity = quantityDelivered(row);
  const requiredQuantity = numeric(row[FIELD.quantity]);
  const units = clean(deliveries.find((delivery) => clean(delivery.units))?.units);
  const summary = requiredQuantity === null
    ? `${deliveredQuantity}${units ? ` ${units}` : ""} delivered`
    : `${deliveredQuantity}${units ? ` ${units}` : ""} of ${requiredQuantity} delivered`;

  return `
    <td class="deliveries-cell">
      <div class="delivery-tracker">
        <strong>${escapeHtml(summary)}</strong>
        <div class="delivery-list">
          ${deliveries.map((delivery, index) => `
            <div class="delivery-entry">
              <div class="delivery-entry-header">
                <span>${escapeHtml(formattedDeliveryDate(delivery) || "No date")}</span>
                <div class="delivery-actions">
                  <button class="note-edit-button" type="button" data-edit-delivery-row="${escapeHtml(key)}" data-delivery-index="${index}">Edit</button>
                  <button class="note-edit-button danger" type="button" data-remove-delivery-row="${escapeHtml(key)}" data-delivery-index="${index}">Remove</button>
                </div>
              </div>
              <div class="meta">${escapeHtml([
                clean(delivery.ticketNumber) ? `Ticket ${delivery.ticketNumber}` : "",
                clean(delivery.qtyDelivered) ? `Qty ${delivery.qtyDelivered}` : "",
                clean(delivery.units),
              ].filter(Boolean).join(" · "))}</div>
              <div class="meta">${escapeHtml([
                clean(delivery.unitPricePo) ? `PO ${formattedDeliveryMoney(delivery.unitPricePo)}` : "",
                clean(delivery.unitPriceInvoice) ? `Invoice ${formattedDeliveryMoney(delivery.unitPriceInvoice)}` : "",
              ].filter(Boolean).join(" · "))}</div>
              ${clean(delivery.notes) ? `<div class="note-text">${escapeHtml(delivery.notes)}</div>` : ""}
            </div>
          `).join("") || `<div class="meta">No deliveries yet.</div>`}
        </div>
        <button class="add-note-button" type="button" data-add-delivery-row="${escapeHtml(key)}">Add Delivery</button>
      </div>
    </td>
  `;
}

function renderLogBody() {
  const headers = visibleLogHeaders();
  const rows = getLogRows();
  els.logBody.innerHTML = rows.map((row) => `
    <tr>
      <td class="action-cell">
        <button class="icon-row-button remove-row-button" type="button" data-remove-row="${escapeHtml(rowKey(row))}" aria-label="Remove item" title="Remove item">×</button>
        <button class="icon-row-button insert-row-button" type="button" data-insert-row="${escapeHtml(rowKey(row))}" data-insert-position="below" aria-label="Insert row below" title="Insert row below">+</button>
      </td>
      ${headers.map((header) => {
        const display = displayValue(row, header);
        const key = rowKey(row);
        if (header === FIELD.status) {
          const current = clean(display);
          const options = uniqueSorted([current, ...state.adminLists.statuses]);
          return `
            <td>
              <select class="cell-select" data-status-row="${escapeHtml(key)}" data-log-field-row="${escapeHtml(key)}" data-log-field-column="${escapeHtml(header)}">
                <option value=""></option>
                ${options.map((status) => `<option value="${escapeHtml(status)}" ${status === current ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
              </select>
            </td>
          `;
        }
        if ([FIELD.critical, FIELD.delivered].includes(header)) {
          return `
            <td class="checkbox-cell">
              <input type="checkbox" data-checkbox-row="${escapeHtml(key)}" data-checkbox-column="${escapeHtml(header)}" data-log-field-row="${escapeHtml(key)}" data-log-field-column="${escapeHtml(header)}" ${row[header] ? "checked" : ""} aria-label="${escapeHtml(header)}" />
            </td>
          `;
        }
        if (header === FIELD.qtyDelivered) {
          return `<td class="calculated-cell">${escapeHtml(display)}</td>`;
        }
        if (header === FIELD.deliveries) {
          return renderDeliveriesCell(row);
        }
        if (header === FIELD.notes) {
          return renderNotesCell(row);
        }
        return `<td class="editable-cell ${dateConflict(row, header) ? "date-conflict" : ""}" contenteditable="true" tabindex="0" data-edit-row="${escapeHtml(key)}" data-edit-column="${escapeHtml(header)}" data-log-field-row="${escapeHtml(key)}" data-log-field-column="${escapeHtml(header)}">${escapeHtml(editableValue(row, header))}</td>`;
      }).join("")}
    </tr>
  `).join("");
  bindEditableCells();
  bindLogFieldTabbing();
  bindStatusSelects();
  bindLogCheckboxes();
  bindDeliveryButtons();
  bindNoteButtons();
  bindInsertButtons();
  bindRemoveButtons();
  syncTopScrollbarWidth();
}

function bindInsertButtons() {
  els.logBody.querySelectorAll("[data-insert-row]").forEach((button) => {
    button.addEventListener("click", () => {
      insertItemNearRow(button.dataset.insertRow, button.dataset.insertPosition);
    });
  });
}

function bindRemoveButtons() {
  els.logBody.querySelectorAll("[data-remove-row]").forEach((button) => {
    button.addEventListener("click", () => removeItem(button.dataset.removeRow));
  });
}

function allTableHeaders() {
  return [FIELD.drawing, FIELD.tag, FIELD.item, FIELD.quantity, FIELD.units, FIELD.qtyDelivered, FIELD.spec, FIELD.provider, FIELD.area, FIELD.room, FIELD.system, FIELD.submittal, FIELD.status, FIELD.released, FIELD.lead, FIELD.delivery, FIELD.required, FIELD.critical, FIELD.delivered, FIELD.deliveries, FIELD.stored, FIELD.remaining, FIELD.notes];
}

function saveColumnPrefs() {
  localStorage.setItem(COLUMN_PREF_KEY, JSON.stringify([...state.hiddenColumns]));
}

function renderColumnMenu() {
  const headers = allTableHeaders();
  els.columnMenu.innerHTML = `
    <header>
      <span>Visible Columns</span>
      <button id="showAllColumns" type="button">Show all</button>
    </header>
    ${headers.map((header) => `
      <label class="column-option">
        <input type="checkbox" value="${escapeHtml(header)}" ${state.hiddenColumns.has(header) ? "" : "checked"} />
        <span>${escapeHtml(header)}</span>
      </label>
    `).join("")}
  `;

  els.columnMenu.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.hiddenColumns.delete(checkbox.value);
      } else {
        state.hiddenColumns.add(checkbox.value);
      }
      saveColumnPrefs();
      render();
    });
  });

  els.columnMenu.querySelector("#showAllColumns").addEventListener("click", () => {
    state.hiddenColumns.clear();
    saveColumnPrefs();
    renderColumnMenu();
    render();
  });
}

function renderLog() {
  renderLogHead();
  renderLogBody();
}

function procurementBucket(row) {
  const status = normalizeKey(row[FIELD.status]);
  if (!clean(row[FIELD.released]) || status.includes("REQUEST") || status.includes("QUOTE") || status.includes("SUBMIT")) return "Pre-release";
  if (!clean(row[FIELD.delivery]) || status.includes("RAN") || status.includes("RAR") || status.includes("NET")) return "Pending delivery";
  if (numeric(row[FIELD.remaining]) !== null && numeric(row[FIELD.remaining]) <= 30) return "Due onsite";
  return "Released / tracking";
}

function renderProcurement() {
  const buckets = ["Pre-release", "Pending delivery", "Due onsite", "Released / tracking"];
  els.procurementBoard.innerHTML = buckets.map((bucket) => {
    const rows = state.filtered.filter((row) => procurementBucket(row) === bucket);
    return `
      <section class="board-column">
        <header><span>${bucket}</span><span>${rows.length}</span></header>
        <div class="cards">
          ${rows.slice(0, 30).map((row) => `
            <article class="list-row">
              <div class="title-line">
                <span>${escapeHtml(row[FIELD.tag] || "No tag")}</span>
                <span class="badge ${statusClass(row[FIELD.status])}">${escapeHtml(row[FIELD.status] || "No status")}</span>
              </div>
              <strong>${escapeHtml(row[FIELD.item])}</strong>
              <div class="meta">${escapeHtml(row[FIELD.provider])}</div>
              <div class="meta">Delivery: ${escapeHtml(excelDate(row[FIELD.delivery]) || "Not set")}</div>
            </article>
          `).join("") || `<p class="empty">No matching records.</p>`}
        </div>
      </section>
    `;
  }).join("");
}

function renderDevelopmentNotes() {
  const notes = [...state.developmentNotes].sort((a, b) => {
    const statusOrder = { open: 0, implemented: 1, rejected: 2 };
    const statusA = statusOrder[a.status || "open"] ?? 0;
    const statusB = statusOrder[b.status || "open"] ?? 0;
    if (statusA !== statusB) return statusA - statusB;
    return clean(b.createdAt).localeCompare(clean(a.createdAt));
  });
  const counts = developmentNoteCounts();
  els.developmentNotesCount.textContent = `${notes.length} notes - ${counts.open || 0} open`;
  els.developmentNoteInitials.value = state.userInitials;
  els.developmentNotesList.innerHTML = notes.map((note) => {
    const status = note.status || "open";
    const created = note.createdAt ? formatNoteTimestamp(new Date(note.createdAt)) : "";
    const resolved = note.resolvedAt ? formatNoteTimestamp(new Date(note.resolvedAt)) : "";
    return `
      <article class="development-note-card is-${escapeHtml(status)}">
        <div class="development-note-header">
          <span class="badge note-status ${escapeHtml(status)}">${escapeHtml(status)}</span>
          <span class="development-note-meta">${escapeHtml([created, note.initials].filter(Boolean).join(" - "))}</span>
        </div>
        <p>${escapeHtml(note.text)}</p>
        ${resolved ? `<div class="meta">Updated: ${escapeHtml(resolved)}</div>` : ""}
        <div class="development-note-status-actions">
          <button class="text-button neutral" type="button" data-note-status="implemented" data-note-id="${escapeHtml(note.id)}">Implemented</button>
          <button class="text-button" type="button" data-note-status="rejected" data-note-id="${escapeHtml(note.id)}">Rejected</button>
          ${status !== "open" ? `<button class="text-button neutral" type="button" data-note-status="open" data-note-id="${escapeHtml(note.id)}">Reopen</button>` : ""}
        </div>
      </article>
    `;
  }).join("") || `<section class="panel empty-state"><p class="empty">No development notes yet.</p></section>`;

  document.querySelectorAll("[data-note-status]").forEach((button) => {
    button.addEventListener("click", () => {
      updateDevelopmentNoteStatus(button.dataset.noteId, button.dataset.noteStatus);
    });
  });
}

function renderAdminList(target, listName, values) {
  target.innerHTML = values.map((value) => `
    <div class="admin-row">
      <span>${escapeHtml(value)}</span>
      <div class="admin-row-actions">
        ${listName === "statuses" ? `<button class="text-button neutral" type="button" data-rename-status="${escapeHtml(value)}">Rename</button>` : ""}
        <button class="text-button" type="button" data-remove-list="${listName}" data-remove-value="${escapeHtml(value)}">Remove</button>
      </div>
    </div>
  `).join("") || `<p class="empty">No values yet.</p>`;
}

function renderProjectList() {
  els.projectCount.textContent = `${state.projects.length} projects`;
  els.projectList.innerHTML = state.projects.map((project) => `
    <div class="admin-row">
      <span>${escapeHtml(project.name)}${project.archived ? " (Archived)" : ""}</span>
      <div class="admin-row-actions">
        ${project.archived
          ? `<button class="text-button neutral" type="button" data-restore-project="${escapeHtml(project.id)}">Restore</button>`
          : `<button class="text-button" type="button" data-archive-project="${escapeHtml(project.id)}">Archive</button>`}
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-archive-project]").forEach((button) => {
    button.addEventListener("click", () => archiveProject(button.dataset.archiveProject));
  });

  document.querySelectorAll("[data-restore-project]").forEach((button) => {
    button.addEventListener("click", () => restoreProject(button.dataset.restoreProject));
  });
}

function renderAdmin() {
  renderProjectList();
  els.userInitialsInput.value = state.userInitials;
  els.supplierCount.textContent = `${state.adminLists.suppliers.length} values`;
  els.statusAdminCount.textContent = `${state.adminLists.statuses.length} values`;
  renderAdminList(els.supplierList, "suppliers", state.adminLists.suppliers);
  renderAdminList(els.statusAdminList, "statuses", state.adminLists.statuses);

  document.querySelectorAll("[data-remove-list]").forEach((button) => {
    button.addEventListener("click", () => {
      removeAdminValue(button.dataset.removeList, button.dataset.removeValue);
    });
  });

  document.querySelectorAll("[data-rename-status]").forEach((button) => {
    button.addEventListener("click", () => {
      renameStatus(button.dataset.renameStatus);
    });
  });
}

function render() {
  renderDashboard();
  renderLog();
  renderProcurement();
  renderDevelopmentNotes();
  renderAdmin();
}

function setView(view) {
  if (!VALID_VIEWS.has(view)) view = "dashboard";
  state.activeView = view;
  localStorage.setItem("equipmentMaterialActiveView", view);
  if (location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.id === `${view}View`);
  });
  els.viewTitle.textContent = {
    dashboard: "Dashboard",
    log: "Material Log",
    procurement: "Procurement",
    development: "Development Notes",
    admin: "Admin",
  }[view];
  const showColumnControls = view === "log";
  document.querySelector(".column-controls").style.display = showColumnControls ? "flex" : "none";
  if (els.tableScrollTop) {
    els.tableScrollTop.style.display = showColumnControls ? "block" : "none";
  }
  document.querySelector(".filters").style.display = ["admin", "development"].includes(view) ? "none" : "grid";
  if (!showColumnControls) {
    els.columnMenu.hidden = true;
    els.columnToggle.setAttribute("aria-expanded", "false");
  }
}

async function init() {
  state.data = await fetch(DATA_URL).then((response) => response.json());
  state.baseRows = state.data.sheets[0].rows.map((row) => ({ ...row }));
  loadProjects();
  initializeSupabase();
  const didMigrate = await maybeMigrateLocalStorageToSupabase();
  await loadSharedState();
  state.activeProjectId = localStorage.getItem(ACTIVE_PROJECT_PREF_KEY) || state.projects[0].id;
  if (!state.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.projects[0].id;
  }
  state.rows = loadRowsForProject(activeProject());
  if (activeProject()?.baseline && !localStorage.getItem(projectRowsKey())) {
    loadAddedItems();
    loadSavedEdits();
    loadDeletedItems();
    applySavedRowOrder();
    saveCurrentProjectRows();
  }
  loadAdminLists();
  loadDevelopmentNotes();
  state.userInitials = clean(localStorage.getItem(INITIALS_PREF_KEY)).toUpperCase();
  state.filtered = state.rows;
  const initialView = location.hash.slice(1) || localStorage.getItem("equipmentMaterialActiveView") || "dashboard";
  try {
    const savedHiddenColumns = JSON.parse(localStorage.getItem(COLUMN_PREF_KEY) || "[]");
    state.hiddenColumns = new Set(savedHiddenColumns.filter((header) => allTableHeaders().includes(header)));
  } catch {
    state.hiddenColumns = new Set();
  }
  try {
    const savedColumnFilters = JSON.parse(localStorage.getItem(LOG_FILTER_PREF_KEY) || "{}");
    state.logColumnFilters = Object.fromEntries(
      Object.entries(savedColumnFilters).filter(([header]) => logHeaders().includes(header)),
    );
  } catch {
    state.logColumnFilters = {};
  }
  try {
    const savedSort = JSON.parse(localStorage.getItem(LOG_SORT_PREF_KEY) || "{}");
    if (logHeaders().includes(savedSort.column) && ["asc", "desc"].includes(savedSort.direction)) {
      state.logSort = savedSort;
    }
  } catch {
    state.logSort = { column: null, direction: "asc" };
  }

  populateGlobalFilters();
  populateProjectSelect();

  [els.search, els.status, els.area, els.provider, els.timing].forEach((control) => {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  });

  els.reset.addEventListener("click", () => {
    els.search.value = "";
    els.status.value = "all";
    els.area.value = "all";
    els.provider.value = "all";
    els.timing.value = "all";
    state.logColumnFilters = {};
    state.logSort = { column: null, direction: "asc" };
    saveLogControls();
    applyFilters();
  });

  els.columnToggle.addEventListener("click", () => {
    els.columnMenu.hidden = !els.columnMenu.hidden;
    els.columnToggle.setAttribute("aria-expanded", String(!els.columnMenu.hidden));
  });

  els.addItem.addEventListener("click", addItem);

  els.exportExcel.addEventListener("click", exportMaterialLog);

  els.downloadTemplate.addEventListener("click", downloadImportTemplate);

  els.importLog.addEventListener("click", importMaterialLog);

  els.deliveryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveDeliveryDialog();
  });

  els.deliveryCancel.addEventListener("click", closeDeliveryDialog);
  els.deliveryDialogClose.addEventListener("click", closeDeliveryDialog);

  els.developmentNoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addDevelopmentNote(els.developmentNoteInput.value, els.developmentNoteInitials.value);
    els.developmentNoteInput.value = "";
  });

  els.projectSelect.addEventListener("change", () => {
    saveCurrentProjectRows();
    loadProject(els.projectSelect.value);
  });

  els.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addProject(els.projectInput.value);
    els.projectInput.value = "";
  });

  els.supplierForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addAdminValue("suppliers", els.supplierInput.value);
    els.supplierInput.value = "";
  });

  els.statusAdminForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addAdminValue("statuses", els.statusAdminInput.value);
    els.statusAdminInput.value = "";
  });

  els.userInitialsInput.addEventListener("input", () => {
    state.userInitials = clean(els.userInitialsInput.value).toUpperCase();
    els.userInitialsInput.value = state.userInitials;
    localStorage.setItem(INITIALS_PREF_KEY, state.userInitials);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".column-controls")) {
      els.columnMenu.hidden = true;
      els.columnToggle.setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest(".column-filter-combo")) {
      closeColumnFilterMenus();
    }
  });

  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  renderColumnMenu();
  bindTableScrollbars();
  render();
  setView(initialView);
}

init().catch((error) => {
  document.body.innerHTML = `<main class="main"><section class="panel" style="padding: 20px;"><h1>Unable to load app data</h1><p>${escapeHtml(error.message)}</p></section></main>`;
});
