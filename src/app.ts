/// <reference types="@pptb/types" />

import { getActiveConnection } from "./hooks/useConnection";
import { initLogger, logMessage } from "./services/loggerService";
import {
	createPolymorphicLookup,
	filterTablesByMetadataId,
	getAllTables,
	getDefaultLanguageCode,
	getPolymorphicLookups,
	getPublisherPrefix,
	getSolutionTableIds,
	getUnmanagedSolutions,
	publishCustomizations,
	removePolymorphicLookup,
	updatePolymorphicLookupTargets,
	updatePolymorphicLookupMetadata,
	type PolymorphicLookupSummary,
	type SolutionSummary,
	type TableSummary,
} from "./services/dataverseService";

const toolboxAPI = (window as any).toolboxAPI;

const NEW_ATTRIBUTE_VALUE = "__new__";

const elements = {
	connectionBadge: document.getElementById("connection-badge") as HTMLDivElement,
	themeToggle: document.getElementById("theme-toggle") as HTMLButtonElement,
	solutionSelect: document.getElementById("solution-select") as HTMLSelectElement,
	tableSelect: document.getElementById("table-select") as HTMLSelectElement,
	attributeSelect: document.getElementById("attribute-select") as HTMLSelectElement,
	displayNameInput: document.getElementById("display-name") as HTMLInputElement,
	schemaPrefix: document.getElementById("schema-prefix") as HTMLSpanElement,
	schemaSuffix: document.getElementById("schema-suffix") as HTMLInputElement,
	schemaFull: document.getElementById("schema-full") as HTMLSpanElement,
  descriptionInput: document.getElementById("description-input") as HTMLInputElement,
  requiredLevelSelect: document.getElementById("required-level-select") as HTMLSelectElement,
	referenceButton: document.getElementById("reference-button") as HTMLButtonElement,
	referenceMenu: document.getElementById("reference-menu") as HTMLDivElement,
	referenceSearch: document.getElementById("reference-search") as HTMLInputElement,
	referenceList: document.getElementById("reference-list") as HTMLDivElement,
	referenceHint: document.getElementById("reference-hint") as HTMLSpanElement,
	changeSummary: document.getElementById("change-summary") as HTMLDivElement,
	submitButton: document.getElementById("submit-button") as HTMLButtonElement,
	deleteButton: document.getElementById("delete-button") as HTMLButtonElement,
	busyIndicator: document.getElementById("busy-indicator") as HTMLDivElement,
	modePill: document.getElementById("mode-pill") as HTMLSpanElement,
	statusMessage: document.getElementById("status-message") as HTMLDivElement,
	logTarget: document.getElementById("log") as HTMLPreElement,
};

let solutions: SolutionSummary[] = [];
let allTables: TableSummary[] = [];
let solutionTables: TableSummary[] = [];
let polymorphicLookups: PolymorphicLookupSummary[] = [];

let activeSolution: SolutionSummary | null = null;
let activeTable: TableSummary | null = null;
let activeLookup: PolymorphicLookupSummary | null = null;

let selectedTargets = new Set<string>();
let schemaManualEdit = false;
let schemaPrefix = "new_";

function setStatus(message: string) {
	elements.statusMessage.textContent = message;
}

function isNewLookup() {
	return elements.attributeSelect.value === NEW_ATTRIBUTE_VALUE;
}

function canDeleteLookup() {
	return !!activeTable && !!activeLookup && !isNewLookup();
	}

function setBusy(isBusy: boolean) {
	elements.solutionSelect.disabled = isBusy;
	elements.tableSelect.disabled = isBusy || !activeSolution;
	elements.attributeSelect.disabled = isBusy || !activeTable;
	elements.displayNameInput.disabled = isBusy || !isNewLookup();
	elements.schemaSuffix.disabled = isBusy || !isNewLookup();
	// Description and required level are always editable (disabled only during busy state)
	elements.descriptionInput.disabled = isBusy;
	elements.requiredLevelSelect.disabled = isBusy;
	elements.referenceButton.disabled = isBusy || !activeTable;
	elements.submitButton.disabled = isBusy || !canSubmit();
	elements.deleteButton.disabled = isBusy || !canDeleteLookup();
	elements.busyIndicator.classList.toggle("hidden", !isBusy);
	elements.busyIndicator.setAttribute("aria-hidden", isBusy ? "false" : "true");
}

function normalizePrefix(prefix: string | null) {
	if (!prefix) {
		return "new_";
	}
	return prefix.endsWith("_") ? prefix : `${prefix}_`;
}

function normalizeSchemaSuffix(value: string) {
	const cleaned = value.replace(/[^A-Za-z0-9_]/g, "");
	if (!cleaned) {
		return "";
	}
	return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function getFullSchemaName() {
	const suffix = elements.schemaSuffix.value.trim();
	if (!suffix) {
		return "";
	}
	return `${schemaPrefix}${suffix}`;
}

function updateSchemaFullHint(message?: string) {
	elements.schemaFull.textContent = message ?? `Full schema: ${getFullSchemaName()}`;
}

function updateSchemaFromDisplay() {
	if (schemaManualEdit || !isNewLookup()) {
		return;
	}
	const displayName = elements.displayNameInput.value.trim();
	elements.schemaSuffix.value = normalizeSchemaSuffix(displayName);
	updateSchemaFullHint();
}

function setSelectOptions(
	select: HTMLSelectElement,
	options: Array<{ value: string; label: string }>,
	placeholder: string,
) {
	select.innerHTML = "";
	const placeholderOption = document.createElement("option");
	placeholderOption.value = "";
	placeholderOption.textContent = placeholder;
	placeholderOption.disabled = true;
	placeholderOption.selected = true;
	select.appendChild(placeholderOption);

	for (const option of options) {
		const item = document.createElement("option");
		item.value = option.value;
		item.textContent = option.label;
		select.appendChild(item);
	}
}

function applyModeUI() {
	const isNew = isNewLookup();
	
	// Safely update mode pill if it exists
	if (elements.modePill) {
		elements.modePill.textContent = isNew ? "Create" : "Update";
	}
	
	if (elements.submitButton) {
		elements.submitButton.textContent = isNew
			? "Create lookup"
			: "Update lookup";
		elements.submitButton.title = "";
	}

	if (elements.deleteButton) {
		elements.deleteButton.classList.toggle("hidden", isNew);
		elements.deleteButton.disabled = !canDeleteLookup();
	}
	
	elements.displayNameInput.disabled = !isNew;
	
	// Schema name is only editable in create mode
	elements.schemaSuffix.disabled = !isNew;
	elements.schemaSuffix.readOnly = !isNew;
	
	if (!isNew) {
		elements.schemaSuffix.title = "Schema name cannot be changed after creation";
		elements.schemaSuffix.style.cursor = "not-allowed";
		elements.schemaPrefix.style.opacity = "0.6";
		schemaManualEdit = true;
	} else {
		elements.schemaSuffix.title = "";
		elements.schemaSuffix.style.cursor = "inherit";
		elements.schemaPrefix.style.opacity = "1";
	}
	
	// Description and required level are always editable
	elements.descriptionInput.disabled = false;
	elements.requiredLevelSelect.disabled = false;
}

function updateSubmitState() {
	elements.submitButton.disabled = !canSubmit();
}

function setActiveLookup(lookup: PolymorphicLookupSummary | null) {
	activeLookup = lookup;
	if (!lookup) {
		elements.displayNameInput.value = "";
		elements.schemaSuffix.value = "";
    elements.descriptionInput.value = "";
    elements.requiredLevelSelect.value = "None";
		updateSchemaFullHint();
		selectedTargets = new Set<string>();
		renderReferenceList();
		updateReferenceButton();
		renderChangeSummary();
		return;
	}

	elements.displayNameInput.value = lookup.displayName;
	const schemaName = lookup.schemaName;
	if (schemaName.toLowerCase().startsWith(schemaPrefix.toLowerCase())) {
		elements.schemaSuffix.value = schemaName.slice(schemaPrefix.length);
		updateSchemaFullHint();
	} else {
		elements.schemaSuffix.value = schemaName;
		updateSchemaFullHint(`Existing schema: ${schemaName}`);
	}
	elements.descriptionInput.value = lookup.description || "";
	elements.requiredLevelSelect.value = lookup.requiredLevel || "None";

	selectedTargets = new Set(lookup.targets ?? []);
	renderReferenceList();
	updateReferenceButton();
	renderChangeSummary();
}

function updateReferenceButton() {
	const count = selectedTargets.size;
	elements.referenceButton.textContent =
		count === 0 ? "Select referenced tables" : `${count} table(s) selected`;
	elements.referenceHint.textContent =
		count === 0
			? "Select one or more target tables."
			: "Use the search to refine the list.";
	renderChangeSummary();
}

function getTableLabel(logicalName: string) {
	const table = allTables.find((entry) => entry.logicalName === logicalName);
	if (!table) {
		return logicalName;
	}
	return `${table.displayName} (${table.logicalName})`;
}

function buildChangeGroup(title: string, items: string[]) {
	const group = document.createElement("div");
	group.className = "change-group";

	const heading = document.createElement("div");
	heading.className = "change-title";
	heading.textContent = title;

	const list = document.createElement("div");
	list.className = "change-list";

	for (const item of items) {
		const chip = document.createElement("span");
		chip.className = "change-chip";
		chip.textContent = item;
		list.appendChild(chip);
	}

	group.appendChild(heading);
	group.appendChild(list);
	return group;
}

function renderChangeSummary() {
	if (!elements.changeSummary) {
		return;
	}
	elements.changeSummary.innerHTML = "";
	if (!activeTable) {
		return;
	}

	const currentTargets = activeLookup?.targets ?? [];
	const selected = Array.from(selectedTargets);
	const currentSet = new Set(currentTargets);
	const selectedSet = new Set(selected);

	const existing = activeLookup ? currentTargets : [];
	const toAdd = selected.filter((value) => !currentSet.has(value));
	const toRemove = currentTargets.filter((value) => !selectedSet.has(value));

	if (existing.length > 0) {
		const labels = existing.map(getTableLabel);
		elements.changeSummary.appendChild(buildChangeGroup("Existing", labels));
	}

	if (toRemove.length > 0) {
		const labels = toRemove.map(getTableLabel);
		elements.changeSummary.appendChild(buildChangeGroup("To be removed", labels));
	}

	if (toAdd.length > 0) {
		const labels = toAdd.map(getTableLabel);
		elements.changeSummary.appendChild(buildChangeGroup("To be added", labels));
	}
}

function renderReferenceList() {
	const filterValue = elements.referenceSearch.value.trim().toLowerCase();
	const filteredTables = allTables.filter((table) => {
		const display = table.displayName.toLowerCase();
		const logical = table.logicalName.toLowerCase();
		return (
			!filterValue ||
			display.includes(filterValue) ||
			logical.includes(filterValue)
		);
	});

	elements.referenceList.innerHTML = "";
	for (const table of filteredTables) {
		const item = document.createElement("label");
		item.className = "multi-select-item";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = selectedTargets.has(table.logicalName);
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				selectedTargets.add(table.logicalName);
			} else {
				selectedTargets.delete(table.logicalName);
			}
			updateReferenceButton();
			updateSubmitState();
		});

		const meta = document.createElement("span");
		meta.className = "table-meta";

		const name = document.createElement("span");
		name.className = "table-name";
		name.textContent = table.displayName;

		const logical = document.createElement("span");
		logical.className = "table-logical";
		logical.textContent = table.logicalName;

		meta.appendChild(name);
		meta.appendChild(logical);

		item.appendChild(checkbox);
		item.appendChild(meta);
		elements.referenceList.appendChild(item);
	}
}

function canSubmit() {
	if (!activeSolution || !activeTable) {
		return false;
	}
	if (selectedTargets.size === 0) {
		return false;
	}
	if (isNewLookup()) {
		return (
			elements.displayNameInput.value.trim().length > 0 &&
			elements.schemaSuffix.value.trim().length > 0
		);
	}
	if (activeLookup) {
		// Check if any metadata changed
		const displayNameChanged = elements.displayNameInput.value.trim() !== activeLookup.displayName;
		const descriptionChanged = elements.descriptionInput.value.trim() !== (activeLookup.description || "");
		const requiredLevelChanged = elements.requiredLevelSelect.value !== (activeLookup.requiredLevel || "None");

		// Check if targets changed
		const current = new Set(activeLookup.targets ?? []);
		let targetsChanged = current.size !== selectedTargets.size;
		if (!targetsChanged) {
			for (const value of selectedTargets) {
				if (!current.has(value)) {
					targetsChanged = true;
					break;
				}
			}
		}

		return displayNameChanged || descriptionChanged || requiredLevelChanged || targetsChanged;
	}
	return false;
}

async function updateConnectionBadge() {
	const connection = await getActiveConnection();
	if (connection) {
		elements.connectionBadge.textContent = connection.name;
	} else {
		elements.connectionBadge.textContent = "Not connected";
	}
}

async function loadSolutionsAndTables() {
	setStatus("Loading solutions and tables...");
	setBusy(true);
	try {
		const [solutionData, tablesData] = await Promise.all([
			getUnmanagedSolutions(),
			getAllTables(),
		]);
		solutions = solutionData;
		allTables = tablesData;

		setSelectOptions(
			elements.solutionSelect,
			solutions.map((solution) => ({
				value: solution.id,
				label: `${solution.friendlyName} (${solution.uniqueName})`,
			})),
			"Select a solution",
		);

		if (solutions.length > 0) {
			elements.solutionSelect.disabled = false;
		}
		setStatus("Ready.");
	} catch (error) {
		console.error("Failed to load solutions or tables", error);
		setStatus("Failed to load solutions or tables.");
		await toolboxAPI?.utils?.showNotification?.({
			title: "Load failed",
			body: "Could not load solutions or tables.",
			type: "error",
		});
	} finally {
		setBusy(false);
	}
}

async function handleSolutionChange() {
	const selectedId = elements.solutionSelect.value;
	activeSolution = solutions.find((solution) => solution.id === selectedId) ?? null;
	activeTable = null;
	activeLookup = null;
	elements.tableSelect.innerHTML = "";
	elements.attributeSelect.innerHTML = "";
	elements.tableSelect.disabled = true;
	elements.attributeSelect.disabled = true;
	selectedTargets = new Set();
	updateReferenceButton();
	renderReferenceList();
	updateSubmitState();

	if (!activeSolution) {
		return;
	}

	setStatus("Loading solution tables...");
	setBusy(true);
	try {
		const publisher = await getPublisherPrefix(activeSolution.publisherId);
		schemaPrefix = normalizePrefix(publisher?.prefix ?? null);
		elements.schemaPrefix.textContent = schemaPrefix;
		updateSchemaFullHint();

		const tableIds = await getSolutionTableIds(activeSolution.id);
		solutionTables = filterTablesByMetadataId(allTables, tableIds);

		setSelectOptions(
			elements.tableSelect,
			solutionTables.map((table) => ({
				value: table.logicalName,
				label: `${table.displayName} (${table.logicalName})`,
			})),
			"Select a table",
		);

		elements.tableSelect.disabled = solutionTables.length === 0;
		setStatus("Solution loaded.");
	} catch (error) {
		console.error("Failed to load solution tables", error);
		setStatus("Failed to load solution tables.");
	} finally {
		setBusy(false);
	}
}

async function handleTableChange() {
	const tableLogicalName = elements.tableSelect.value;
	activeTable = solutionTables.find((table) => table.logicalName === tableLogicalName) ?? null;
	activeLookup = null;
	selectedTargets = new Set();
	renderReferenceList();
	updateReferenceButton();
	renderChangeSummary();
	renderChangeSummary();
	updateSubmitState();

	if (!activeTable) {
		return;
	}

	setStatus("Loading polymorphic lookups...");
	setBusy(true);
	try {
		polymorphicLookups = await getPolymorphicLookups(activeTable.logicalName);
		const options = [
			{ value: NEW_ATTRIBUTE_VALUE, label: "Create new lookup" },
			...polymorphicLookups.map((lookup) => ({
				value: lookup.logicalName,
				label: `${lookup.displayName} (${lookup.logicalName})`,
			})),
		];
		setSelectOptions(elements.attributeSelect, options, "Select lookup");
		elements.attributeSelect.disabled = false;
		elements.attributeSelect.value = NEW_ATTRIBUTE_VALUE;
		schemaManualEdit = false;
		elements.displayNameInput.value = "";
		elements.schemaSuffix.value = "";
		updateSchemaFullHint();
		applyModeUI();
		updateSubmitState();
		setStatus("Table loaded.");
	} catch (error) {
		console.error("Failed to load polymorphic lookups", error);
		setStatus("Failed to load polymorphic lookups.");
	} finally {
		setBusy(false);
	}
}

function handleAttributeChange() {
	const selectedValue = elements.attributeSelect.value;
	if (selectedValue === NEW_ATTRIBUTE_VALUE) {
		schemaManualEdit = false;
		elements.displayNameInput.value = "";
		elements.schemaSuffix.value = "";
		updateSchemaFullHint();
		selectedTargets = new Set();
		setActiveLookup(null);
		applyModeUI();
		updateReferenceButton();
		renderChangeSummary();
		updateSubmitState();
		setBusy(false);
		return;
	}

	const lookup = polymorphicLookups.find((item) => item.logicalName === selectedValue) ?? null;
	setActiveLookup(lookup);
	applyModeUI();
	renderChangeSummary();
	updateSubmitState();
	setBusy(false);
}

async function handleSubmit() {
	if (!activeSolution || !activeTable) {
		return;
	}
	setBusy(true);
	const isNew = isNewLookup();
	const targets = Array.from(selectedTargets.values());

	try {
		if (isNew) {
			const displayName = elements.displayNameInput.value.trim();
			const description = elements.descriptionInput.value.trim();
			const requiredLevel = elements.requiredLevelSelect.value;
			const schemaName = getFullSchemaName();
			await createPolymorphicLookup(
				activeTable.logicalName,
				displayName,
				schemaName,
				targets,
				activeSolution.uniqueName,
				description,
				requiredLevel,
				schemaPrefix,
			);
			logMessage(`Created polymorphic lookup ${schemaName} on ${activeTable.logicalName}, now publishing customizations, please wait...`);
			await publishCustomizations(activeTable.logicalName);
			await toolboxAPI?.utils?.showNotification?.({
				title: "Lookup created",
				body: "The polymorphic lookup was created and published.",
				type: "success",
			});
		} else if (activeLookup) {
			const targets = Array.from(selectedTargets.values());
			const description = elements.descriptionInput.value.trim();
			const requiredLevel = elements.requiredLevelSelect.value;
			const displayName = elements.displayNameInput.value.trim();

			// Ensure we have valid lookup data before updating
			if (!activeLookup.logicalName) {
				throw new Error("Lookup logical name is missing");
			}
			if (!activeTable.logicalName) {
				throw new Error("Table logical name is missing");
			}

			console.log("Update payload being sent:", {
				entityLogicalName: activeTable.logicalName,
				lookupLogicalName: activeLookup.logicalName,
				displayName: displayName || activeLookup.displayName,
				description,
				requiredLevel,
			});

			// Update metadata first
			await updatePolymorphicLookupMetadata(
				activeTable.logicalName,
				activeLookup.logicalName,
				displayName || activeLookup.displayName,
				description || "",
				requiredLevel,
				activeLookup.schemaName,
				activeLookup.metadataId,
			);

			// Then update targets
			const result = await updatePolymorphicLookupTargets(
				activeTable.logicalName,
				activeLookup.logicalName,
				activeLookup.schemaName,
				activeLookup.targets,
				targets,
				schemaPrefix,
			);
			logMessage(`Updated lookup: metadata changed, +${result.added} target(s) added, -${result.removed} target(s) removed, now publishing customizations, please wait...`);
			await publishCustomizations(activeTable.logicalName);
			await toolboxAPI?.utils?.showNotification?.({
				title: "Lookup updated",
				body: `Updated metadata, added ${result.added} target(s), removed ${result.removed} target(s), and published.`,
				type: "success",
			});
		}

		await handleTableChange();
		setStatus("Changes published.");
	} catch (error: any) {
		console.error("Operation failed: ", error);
		logMessage("Operation failed. Error: " + (error.message || error));
		setStatus("Operation failed, please retry.");
		await toolboxAPI?.utils?.showNotification?.({
			title: "Operation failed",
			body: "Error: " + (error.message || "Unknown error"),
			type: "error",
		});
	} finally {
		setBusy(false);
	}
}

async function handleDeleteLookup() {
	if (!activeTable || !activeLookup) {
		return;
	}

	const confirmed = window.confirm(
		`Delete polymorphic lookup ${activeLookup.displayName} (${activeLookup.logicalName}) from ${activeTable.logicalName}? This permanently removes the full attribute.`,
	);
	if (!confirmed) {
		return;
	}

	setBusy(true);
	try {
		const attributeIdentifier = activeLookup.metadataId || activeLookup.logicalName;
		await removePolymorphicLookup(activeTable.logicalName, attributeIdentifier);
		logMessage(`Deleted polymorphic lookup ${activeLookup.logicalName} from ${activeTable.logicalName}, now publishing customizations, please wait...`);
		await publishCustomizations(activeTable.logicalName);
		await toolboxAPI?.utils?.showNotification?.({
			title: "Lookup deleted",
			body: "The polymorphic lookup was deleted and published.",
			type: "success",
		});
		await handleTableChange();
		setStatus("Lookup deleted and published.");
	} catch (error: any) {
		console.error("Delete failed:", error);
		logMessage("Delete failed. Error: " + (error.message || error));
		setStatus("Delete failed, please retry.");
		await toolboxAPI?.utils?.showNotification?.({
			title: "Delete failed",
			body: "Error: " + (error.message || "Unknown error"),
			type: "error",
		});
	} finally {
		setBusy(false);
	}
}

function applyTheme(theme: "light" | "dark") {
	document.body.classList.toggle("theme-dark", theme === "dark");
	localStorage.setItem("pptb-theme", theme);
}

async function loadTheme() {
	const stored = localStorage.getItem("pptb-theme") as "light" | "dark" | null;
	if (stored) {
		applyTheme(stored);
		return;
	}
	const apiTheme = await toolboxAPI?.utils?.getTheme?.();
	if (apiTheme === "dark" || apiTheme === "light") {
		applyTheme(apiTheme);
		return;
	}
	const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
	applyTheme(prefersDark ? "dark" : "light");
}

function bindEvents() {
	elements.solutionSelect?.addEventListener("change", handleSolutionChange);
	elements.tableSelect?.addEventListener("change", handleTableChange);
	elements.attributeSelect?.addEventListener("change", handleAttributeChange);
	elements.displayNameInput?.addEventListener("input", () => {
		updateSchemaFromDisplay();
		updateSubmitState();
	});
	elements.schemaSuffix?.addEventListener("input", () => {
		// Prevent any schema name changes in update mode
		if (!isNewLookup()) {
			// Immediately reset to original value
			if (activeLookup) {
				const original = activeLookup.schemaName.startsWith(schemaPrefix)
					? activeLookup.schemaName.slice(schemaPrefix.length)
					: activeLookup.schemaName;
				elements.schemaSuffix.value = original;
			}
			return;
		}
		
		// Only process input in create mode
		schemaManualEdit = true;
		elements.schemaSuffix.value = normalizeSchemaSuffix(
			elements.schemaSuffix.value,
		);
		updateSchemaFullHint();
		updateSubmitState();
	});
	
	elements.schemaSuffix?.addEventListener("beforeinput", (event: any) => {
		// Block input events in update mode
		if (!isNewLookup()) {
			event.preventDefault();
		}
	});
	
	elements.schemaSuffix?.addEventListener("keydown", (event: any) => {
		// Block keyboard in update mode (except Tab and arrow keys for accessibility)
		if (!isNewLookup() && !["Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
			event.preventDefault();
		}
	});
	
	elements.schemaSuffix?.addEventListener("paste", (event: any) => {
		// Prevent pasting in update mode
		if (!isNewLookup()) {
			event.preventDefault();
		}
	});
	
	elements.referenceButton?.addEventListener("click", () => {
		elements.referenceMenu?.classList.toggle("hidden");
	});
	elements.referenceSearch?.addEventListener("input", () => {
		renderReferenceList();
	});
	document.addEventListener("click", (event) => {
		if (elements.referenceMenu &&
			!elements.referenceMenu.contains(event.target as Node) &&
			elements.referenceButton &&
			!elements.referenceButton.contains(event.target as Node)) {
			elements.referenceMenu.classList.add("hidden");
		}
	});
	elements.submitButton.addEventListener("click", handleSubmit);
	elements.deleteButton.addEventListener("click", handleDeleteLookup);
	elements.themeToggle.addEventListener("click", () => {
		const nextTheme = document.body.classList.contains("theme-dark")
			? "light"
			: "dark";
		applyTheme(nextTheme as "light" | "dark");
	});
}

async function initialize() {
	initLogger(elements.logTarget);
	await loadTheme();
	bindEvents();
	await updateConnectionBadge();
	await loadSolutionsAndTables();
	await getDefaultLanguageCode();

	toolboxAPI?.events?.on?.((event: any, payload: any) => {
		if (payload?.event === "connection:updated") {
			updateConnectionBadge();
			loadSolutionsAndTables();
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initialize);
} else {
	initialize();
}
