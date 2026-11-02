const MODULE_ID = "commlink";
const DEVICE_WIDTH = 1536;
const DEVICE_HEIGHT = 1024;
const ASPECT = DEVICE_WIDTH / DEVICE_HEIGHT;
const NAME_RE = /commlink|kommlink/i;
const FALLBACK_IMG = "icons/svg/mystery-man.svg";
const DIE_STEPS = [4, 6, 8, 10, 12];
const DEFAULT_DIE = 4;
const TYPE_SUGGESTIONS = ["Schieber", "Johnson", "Informant", "Barman", "Lonestar Cop"];
const COST_KEYS = ["general", "special", "sensitive", "legal_day", "illegal_clean", "illegal_trace", "arrest"];
const COST_AMOUNTS = {
  general: 100,
  special: 250,
  sensitive: 500,
  legal_day: 500,
  illegal_clean: 500,
  illegal_trace: 5000,
  arrest: 10000
};
const INFO_COST_KEYS = new Set(["general", "special", "sensitive"]);
const FAVOR_MODS = {
  general: [0],
  special: [0],
  sensitive: [-2, -4],
  legal_day: [0],
  illegal_clean: [-2],
  illegal_trace: [-4, -6],
  arrest: [-8]
};
const RISK_LEVELS = [
  { value: 0, labelKey: "COMMLINK.Service.Risk.None" },
  { value: -2, labelKey: "COMMLINK.Service.Risk.Low" },
  { value: -4, labelKey: "COMMLINK.Service.Risk.Raised" },
  { value: -6, labelKey: "COMMLINK.Service.Risk.High" },
  { value: -8, labelKey: "COMMLINK.Service.Risk.Extreme" }
];
const TRAIT_TN = 4;
const DESIGNS = {
  renraku: {
    id: "renraku",
    src: `modules/${MODULE_ID}/assets/asset-renraku-commlink_v2.png`,
    labelKey: "COMMLINK.Design.Renraku"
  },
  sony: {
    id: "sony",
    src: `modules/${MODULE_ID}/assets/asset-sony-commlink_v1.png`,
    labelKey: "COMMLINK.Design.Sony"
  },
  shiawase: {
    id: "shiawase",
    src: `modules/${MODULE_ID}/assets/asset-shiawase-commlink_v1.png`,
    labelKey: "COMMLINK.Design.Shiawase"
  },
  aztechnology: {
    id: "aztechnology",
    src: `modules/${MODULE_ID}/assets/asset-aztechnology-commlink_v1.png`,
    labelKey: "COMMLINK.Design.Aztechnology"
  }
};

function getDesign(item) {
  const id = item?.getFlag(MODULE_ID, "design");
  return DESIGNS[id] ?? DESIGNS.renraku;
}

async function setDesign(item, id) {
  if (!item || !DESIGNS[id] || !canEdit(item)) return;
  await item.setFlag(MODULE_ID, "design", id);
}

async function pickDesign(item) {
  if (!canEdit(item)) return;
  const current = getDesign(item).id;
  const options = Object.values(DESIGNS).map(design => {
    const selected = design.id === current ? " selected" : "";
    return `<option value="${design.id}"${selected}>${game.i18n.localize(design.labelKey)}</option>`;
  }).join("");
  let id;
  try {
    id = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("COMMLINK.Design.Title") },
      content: `<p>${game.i18n.localize("COMMLINK.Design.Hint")}</p><select name="design">${options}</select>`,
      ok: {
        label: game.i18n.localize("COMMLINK.Design.Apply"),
        callback: (_event, button) => button.form.elements.design.value
      }
    });
  } catch {
    return;
  }
  if (id) await setDesign(item, id);
}

const { ApplicationV2 } = foundry.applications.api;

function isCommlink(item) {
  if (!item) return false;
  if (item.getFlag(MODULE_ID, "enabled") === true) return true;
  if (item.getFlag(MODULE_ID, "enabled") === false) return false;
  return NAME_RE.test(item.name ?? "");
}

function canOpen(item) {
  return Boolean(item) && (game.user.isGM || item.isOwner);
}

function canEdit(item) {
  return canOpen(item);
}

function itemFromSheetEl(el) {
  const id = el.dataset?.documentId ?? el.dataset?.entryId ?? el.dataset?.itemId;
  return id ? game.items.get(id) : null;
}

function defaultSize() {
  const maxW = Math.floor(window.innerWidth * 0.72);
  const maxH = Math.floor(window.innerHeight * 0.72);
  const scale = Math.min(maxW / DEVICE_WIDTH, maxH / DEVICE_HEIGHT, 1) * 0.5;
  return {
    width: Math.max(240, Math.round(DEVICE_WIDTH * scale)),
    height: Math.max(160, Math.round(DEVICE_HEIGHT * scale))
  };
}

function stripHtml(value) {
  const html = String(value ?? "").trim();
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent.replace(/\s+/g, " ").trim();
}

function normalizeCostKey(value) {
  return COST_KEYS.includes(value) ? value : "";
}

function formatYen(amount) {
  return `${new Intl.NumberFormat(game.i18n.lang || "de").format(amount)}¥`;
}

function formatCost(key) {
  const amount = COST_AMOUNTS[key];
  if (!Number.isFinite(amount)) return "";
  const yen = formatYen(amount);
  return key === "legal_day" ? `${yen}/${game.i18n.localize("COMMLINK.Service.Day")}` : yen;
}

function costLabel(key) {
  return game.i18n.localize(`COMMLINK.Service.Cost.${key}`);
}

function favorMods(key) {
  return FAVOR_MODS[key] ?? [0];
}

function formatFavorMod(key) {
  const mods = favorMods(key);
  if (mods.length === 1) return formatSigned(mods[0]);
  return `${formatSigned(mods[0])} ${game.i18n.localize("COMMLINK.Service.To")} ${formatSigned(mods[1])}`;
}

function riskLabel(value) {
  const level = RISK_LEVELS.find(entry => entry.value === Number(value));
  return level ? game.i18n.localize(level.labelKey) : formatSigned(value);
}

function ruleServices() {
  return COST_KEYS.map(costKey => ({
    costKey,
    name: costLabel(costKey),
    example: game.i18n.localize(`COMMLINK.Service.Example.${costKey}`),
    cost: formatCost(costKey),
    favor: formatFavorMod(costKey)
  }));
}

function publicBlurb(actor) {
  const details = actor?.system?.details ?? {};
  const text = stripHtml(details.appearance)
    || stripHtml(details.biography?.value)
    || stripHtml(details.biography)
    || stripHtml(actor.system?.biography);
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

function contactStore(item) {
  return item?.actor ?? item?.parent ?? item;
}

function normalizeContacts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(entry => entry && typeof entry === "object" && entry.actorUuid);
}

function getContacts(item) {
  return normalizeContacts(contactStore(item)?.getFlag(MODULE_ID, "contacts"));
}

async function saveContacts(item, contacts) {
  const store = contactStore(item);
  if (!store) return;
  await store.setFlag(MODULE_ID, "contacts", contacts);
}

async function migrateContacts(item) {
  const actor = item?.actor ?? item?.parent;
  if (!actor || actor === item) return;
  const fromItem = normalizeContacts(item.getFlag(MODULE_ID, "contacts"));
  if (!fromItem.length) return;
  const fromActor = normalizeContacts(actor.getFlag(MODULE_ID, "contacts"));
  const seen = new Set(fromActor.map(entry => entry.actorUuid));
  const merged = [...fromActor];
  for (const entry of fromItem) {
    if (seen.has(entry.actorUuid)) continue;
    merged.push(entry);
    seen.add(entry.actorUuid);
  }
  await actor.setFlag(MODULE_ID, "contacts", merged);
  await item.unsetFlag(MODULE_ID, "contacts");
}

function normalizeDie(value) {
  const n = Number(value);
  return DIE_STEPS.includes(n) ? n : DEFAULT_DIE;
}

function formatDie(value) {
  return `d${normalizeDie(value)}`;
}

function dieOptions(selected) {
  const current = normalizeDie(selected);
  return DIE_STEPS.map(step => {
    const mark = step === current ? " selected" : "";
    return `<option value="${step}"${mark}>d${step}</option>`;
  }).join("");
}

function normalizeType(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function contactDisplayName(contact) {
  const type = normalizeType(contact.connectionType);
  return type ? `${contact.name} (${type})` : contact.name;
}

async function openContactActor(contact) {
  if (!contact?.actorUuid) return;
  let actor = null;
  try {
    actor = worldActor(await fromUuid(contact.actorUuid));
  } catch {
    actor = null;
  }
  if (!actor?.sheet) {
    ui.notifications.warn(game.i18n.localize("COMMLINK.Call.NoActor"));
    return;
  }
  actor.sheet.render(true);
}

function worldActor(doc) {
  if (!doc) return null;
  if (doc.documentName === "Token") {
    return doc.baseActor ?? game.actors.get(doc.actorId) ?? doc.actor ?? null;
  }
  if (doc.documentName !== "Actor") return doc.actor?.documentName === "Actor" ? worldActor(doc.actor) : null;
  if (doc.isToken) return doc.token?.baseActor ?? game.actors.get(doc.id) ?? doc;
  return doc;
}

function actorPortrait(actor) {
  const source = worldActor(actor) ?? actor;
  return source?._source?.img || source?.img || FALLBACK_IMG;
}

function contactFromActor(actor) {
  const source = worldActor(actor) ?? actor;
  return {
    id: foundry.utils.randomID(),
    actorUuid: source.uuid,
    name: source.name,
    img: actorPortrait(source),
    blurb: publicBlurb(source),
    professionalism: DEFAULT_DIE,
    loyalty: DEFAULT_DIE,
    connectionType: ""
  };
}

async function actorFromDrop(event) {
  const TextEditor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  const data = TextEditor.getDragEventData(event);
  if (!data?.uuid) return null;
  const doc = await fromUuid(data.uuid);
  const actor = worldActor(doc);
  return actor?.documentName === "Actor" ? actor : null;
}

async function resolveContact(entry) {
  let actor = null;
  try {
    actor = await fromUuid(entry.actorUuid);
  } catch {
    actor = null;
  }
  actor = worldActor(actor);
  if (actor?.documentName !== "Actor") actor = null;
  return {
    id: entry.id,
    actorUuid: entry.actorUuid,
    name: actor?.name || entry.name || game.i18n.localize("COMMLINK.Call.Unknown"),
    img: actor ? actorPortrait(actor) : (entry.img || FALLBACK_IMG),
    blurb: actor ? publicBlurb(actor) : (entry.blurb || ""),
    professionalism: normalizeDie(entry.professionalism),
    loyalty: normalizeDie(entry.loyalty),
    connectionType: normalizeType(entry.connectionType),
    services: ruleServices(),
    missing: !actor
  };
}

async function addContact(item, actor) {
  if (!item || !actor || actor.documentName !== "Actor") {
    ui.notifications.warn(game.i18n.localize("COMMLINK.Contacts.NotActor"));
    return null;
  }
  const contacts = getContacts(item);
  if (contacts.some(entry => entry.actorUuid === actor.uuid)) {
    ui.notifications.info(game.i18n.localize("COMMLINK.Contacts.Exists"));
    return null;
  }
  contacts.push(contactFromActor(actor));
  await saveContacts(item, contacts);
  return contacts.at(-1);
}

async function removeContact(item, contactId) {
  const contacts = getContacts(item).filter(entry => entry.id !== contactId);
  await saveContacts(item, contacts);
}

async function setContactDie(item, contactId, field, value) {
  if (!item || !canEdit(item) || !["professionalism", "loyalty"].includes(field)) return;
  const contacts = getContacts(item);
  const entry = contacts.find(contact => contact.id === contactId);
  if (!entry) return;
  entry.professionalism = normalizeDie(entry.professionalism);
  entry.loyalty = normalizeDie(entry.loyalty);
  entry[field] = normalizeDie(value);
  await saveContacts(item, contacts);
}

async function setContactType(item, contactId, value) {
  if (!item || !canEdit(item)) return;
  const contacts = getContacts(item);
  const entry = contacts.find(contact => contact.id === contactId);
  if (!entry) return;
  const connectionType = normalizeType(value);
  if (normalizeType(entry.connectionType) === connectionType) return;
  entry.connectionType = connectionType;
  await saveContacts(item, contacts);
}

function formatSigned(value) {
  const n = Number(value) || 0;
  if (n < 0) return `−${Math.abs(n)}`;
  return `+${n}`;
}

function faceValue(die, result) {
  let value = Number(result?.result);
  if (!Number.isFinite(value)) return 0;
  const faces = Number(die?.faces) || 0;
  if (faces === 10 && value === 0) return 10;
  return value;
}

function rollPartFaces(part) {
  const faces = [];
  for (const die of part?.dice ?? []) {
    for (const res of die.results ?? []) {
      if (res.discarded) continue;
      faces.push(faceValue(die, res));
    }
  }
  return faces;
}

function rollPartTotal(part) {
  const fromDice = rollPartFaces(part).reduce((sum, value) => sum + value, 0);
  if (fromDice) return fromDice;
  return Number(part?.total) || 0;
}

function formatExploded(faces, fallback) {
  if (!faces.length) return String(fallback ?? 0);
  if (faces.length === 1) return String(faces[0]);
  return `${faces.join("+")}=${faces.reduce((sum, value) => sum + value, 0)}`;
}

function swadeOutcome(total, traitRaw, wildRaw) {
  const critfail = traitRaw === 1 && wildRaw === 1;
  if (critfail || total < TRAIT_TN) {
    return { success: false, raises: 0, critfail };
  }
  return {
    success: true,
    raises: Math.floor((total - TRAIT_TN) / TRAIT_TN),
    critfail: false
  };
}

function modifierFormula(mods) {
  return (mods ?? []).filter(mod => mod.value && !mod.ignore).reduce((acc, mod) => {
    const raw = String(mod.value);
    const signed = /^[+-]/.test(raw) ? raw : `+${raw}`;
    return acc + `${signed}[${mod.label}]`;
  }, "");
}

function buildWildcardRoll(sides, mods) {
  const faces = normalizeDie(sides);
  return new Roll(`{1d${faces}x, 1d6x}kh${modifierFormula(mods)}`);
}

async function showDice3d(roll) {
  if (!roll || !game.dice3d?.showForRoll) return false;
  await game.dice3d.showForRoll(roll, game.user, true);
  return true;
}

async function promptModifier({ title, die, preset = 0, hint = "" }) {
  try {
    const value = await foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: [
        `<p>${hint || game.i18n.format("COMMLINK.Service.ModHint", {
          trait: title,
          die: formatDie(die)
        })}</p>`,
        `<div class="form-group">`,
        `<label>${game.i18n.localize("COMMLINK.Service.Modifier")}</label>`,
        `<input type="number" name="modifier" value="${preset}" step="1">`,
        `</div>`
      ].join(""),
      ok: {
        label: game.i18n.localize("COMMLINK.Service.Roll"),
        callback: (_event, button) => Number(button.form.elements.modifier.value)
      }
    });
    return Number.isFinite(value) ? value : 0;
  } catch {
    return null;
  }
}

async function promptFavorRisk({ die, costKey }) {
  const suggested = favorMods(costKey);
  const preset = suggested[0] ?? 0;
  const options = RISK_LEVELS.map(level => {
    const selected = level.value === preset ? " selected" : "";
    const mark = suggested.includes(level.value)
      ? ` — ${game.i18n.localize("COMMLINK.Service.Suggested")}`
      : "";
    return `<option value="${level.value}"${selected}>${escapeHtml(game.i18n.localize(level.labelKey))} (${escapeHtml(formatSigned(level.value))})${escapeHtml(mark)}</option>`;
  }).join("");
  try {
    const value = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("COMMLINK.Connection.Loyalty") },
      content: [
        `<p>${game.i18n.format("COMMLINK.Service.FavorHint", {
          die: formatDie(die),
          favor: formatFavorMod(costKey)
        })}</p>`,
        `<div class="form-group">`,
        `<label>${game.i18n.localize("COMMLINK.Service.Risk.Label")}</label>`,
        `<select name="risk">${options}</select>`,
        `</div>`
      ].join(""),
      ok: {
        label: game.i18n.localize("COMMLINK.Service.Roll"),
        callback: (_event, button) => Number(button.form.elements.risk.value)
      }
    });
    return Number.isFinite(value) ? value : 0;
  } catch {
    return null;
  }
}

async function rollTraitDie(sides, modifier = 0) {
  const n = Number(modifier) || 0;
  const mods = n
    ? [{ label: game.i18n.localize("COMMLINK.Service.Modifier"), value: n }]
    : [];
  const roll = await buildWildcardRoll(sides, mods).evaluate();
  const pool = roll.terms.find(term => Array.isArray(term.rolls));
  const traitFaces = rollPartFaces(pool?.rolls?.[0]);
  const wildFaces = rollPartFaces(pool?.rolls?.[1]);
  const traitRaw = rollPartTotal(pool?.rolls?.[0]);
  const wildRaw = rollPartTotal(pool?.rolls?.[1]);
  const raw = Math.max(traitRaw, wildRaw);
  const total = Number.isFinite(roll.total) ? roll.total : raw + n;
  return {
    roll,
    sides: normalizeDie(sides),
    traitFaces,
    wildFaces,
    traitRaw,
    wildRaw,
    traitText: formatExploded(traitFaces, traitRaw),
    wildText: formatExploded(wildFaces, wildRaw),
    raw,
    total,
    modifier: n,
    ...swadeOutcome(total, traitRaw, wildRaw)
  };
}

function commlinkOwner(item) {
  return item?.actor ?? item?.parent ?? game.user.character ?? null;
}

function canPayFrom(actor) {
  return Boolean(actor) && (game.user.isGM || actor.isOwner);
}

function detailGradeKey(raises) {
  if (raises >= 2) return "Raise2";
  if (raises === 1) return "Raise1";
  return "Success";
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function rollOutcome(result) {
  if (result.critfail) return game.i18n.localize("COMMLINK.Service.Critfail");
  if (!result.success) return game.i18n.localize("COMMLINK.Service.Failure");
  if (result.raises) return game.i18n.format("COMMLINK.Service.RaiseCount", { raises: result.raises });
  return game.i18n.localize("COMMLINK.Service.Success");
}

function dieIcon(faces) {
  const n = [4, 6, 8, 10, 12, 20].includes(Number(faces)) ? Number(faces) : 6;
  return `icons/svg/d${n}-grey.svg`;
}

function dieResultClass(faces, faceList, total) {
  if (faceList?.[0] === 1) return "min";
  if (total > faces) return "exploded";
  return "";
}

function faceChipClass(faces, value) {
  if (value === 1) return "min";
  if (value === faces) return "exploded";
  return "";
}

function swadeLabel(key, fallback) {
  return game.i18n.has(key) ? game.i18n.localize(key) : fallback;
}

function dieChipHtml(faces, value, cssClass, hint = "") {
  return `<li class="die" style="background-image: url(${dieIcon(faces)});" data-tooltip="${escapeHtml(hint)}"><span class="${cssClass}">${value}</span></li>`;
}

function faceListHtml(faces, values) {
  return `<ol class="formula-list">${(values ?? []).map(value => dieChipHtml(faces, value, faceChipClass(faces, value))).join("")}</ol>`;
}

function diceVisualHtml(result, traitSides, traitHint) {
  const wildHint = swadeLabel("SWADE.WildDie", game.i18n.localize("COMMLINK.Service.WildLabel"));
  const resultHint = swadeLabel("SWADE.Rolls.RollResult", game.i18n.localize("COMMLINK.Service.RollResult"));
  const traitClass = dieResultClass(traitSides, result.traitFaces, result.traitRaw);
  const wildClass = dieResultClass(6, result.wildFaces, result.wildRaw);
  const keptWild = result.raw === result.wildRaw && result.wildRaw >= result.traitRaw;
  const keptFaces = keptWild ? 6 : traitSides;
  const keptClass = keptWild ? wildClass : traitClass;
  const keptHint = keptWild ? wildHint : traitHint;
  const formula = [
    dieChipHtml(traitSides, result.traitRaw, traitClass, traitHint),
    dieChipHtml(6, result.wildRaw, wildClass, wildHint)
  ];
  if (result.modifier) {
    formula.push(`<li data-tooltip="${escapeHtml(game.i18n.localize("COMMLINK.Service.Modifier"))}">${escapeHtml(formatSigned(result.modifier))}</li>`);
  }
  return [
    `<div class="swade-roll cl-swade-dice">`,
    `<div class="dice-roll trait-roll expanded">`,
    `<div class="dice-result">`,
    `<div class="dice-formula"><ol class="formula-list">${formula.join("")}</ol></div>`,
    `<div class="cl-dice-parts">`,
    `<div class="cl-dice-part">`,
    `<span class="cl-dice-formula">1d${traitSides}x</span>`,
    faceListHtml(traitSides, result.traitFaces),
    `<span class="cl-dice-hint">${escapeHtml(traitHint)}</span>`,
    `<span class="cl-dice-sum">${result.traitRaw}</span>`,
    `</div>`,
    `<div class="cl-dice-part">`,
    `<span class="cl-dice-formula">1dwx</span>`,
    faceListHtml(6, result.wildFaces),
    `<span class="cl-dice-hint">${escapeHtml(wildHint)}</span>`,
    `<span class="cl-dice-sum">${result.wildRaw}</span>`,
    `</div>`,
    `</div>`,
    `<div class="dice-flavor">${escapeHtml(resultHint)}</div>`,
    `<div class="dice-total"><ol class="result-list">`,
    `<li class="die" style="background-image: url(${dieIcon(keptFaces)});" data-tooltip="${escapeHtml(keptHint)}"><span class="label ${keptClass}">${result.total}</span></li>`,
    `</ol></div>`,
    `</div></div></div>`
  ].join("");
}

function rollBlockHtml(label, result, die) {
  return [
    `<div class="cl-card-roll">`,
    `<div class="cl-card-roll-label">${escapeHtml(label)}</div>`,
    diceVisualHtml(result, normalizeDie(die), label),
    `<strong class="cl-card-outcome">${escapeHtml(rollOutcome(result))}</strong>`,
    `</div>`
  ].join("");
}

function costLineHtml(costText) {
  if (!costText) return "";
  return `<div class="cl-card-cost">${escapeHtml(game.i18n.format("COMMLINK.Service.FeeDue", { cost: costText }))}</div>`;
}

function serviceCardHtml(data) {
  const parts = [
    `<div class="cl-card">`,
    `<header class="cl-card-head">${escapeHtml(data.contactName)}</header>`,
    `<div class="cl-card-service"><strong>${escapeHtml(data.serviceName)}</strong></div>`
  ];
  if (data.pro.success && data.detail) {
    parts.push(`<p class="cl-card-detail">${escapeHtml(data.detail)}</p>`);
  }
  parts.push(costLineHtml(data.costText));
  parts.push(rollBlockHtml(game.i18n.localize("COMMLINK.Connection.Professionalism"), data.pro, data.pro.sides));
  if (data.pro.success && data.mode === "fee") {
    const label = data.paid
      ? game.i18n.localize("COMMLINK.Service.Paid")
      : game.i18n.format("COMMLINK.Service.Deduct", { cost: data.costText });
    parts.push(`<button type="button" class="cl-pay-btn" data-action="pay"${data.paid ? " disabled" : ""}>${escapeHtml(label)}</button>`);
  } else if (data.pro.success) {
    parts.push(rollBlockHtml(game.i18n.localize("COMMLINK.Connection.Loyalty"), data.loy, data.loy.sides));
    if (data.favorModText) {
      parts.push(`<div class="cl-card-mod">${escapeHtml(data.favorModText)}</div>`);
    }
    parts.push(`<p class="cl-card-note">${escapeHtml(game.i18n.localize(data.loy.success ? "COMMLINK.Service.FavorYes" : "COMMLINK.Service.FavorNo"))}</p>`);
  }
  parts.push(`</div>`);
  return parts.join("");
}

async function requestService(commlink, contact, costKey) {
  if (!commlink || !canOpen(commlink) || !normalizeCostKey(costKey)) return;
  const serviceName = costLabel(costKey);

  let choice;
  try {
    choice = await foundry.applications.api.DialogV2.wait({
      window: { title: serviceName },
      content: `<p>${game.i18n.format("COMMLINK.Service.RequestHint", {
        name: serviceName,
        cost: formatCost(costKey),
        favor: formatFavorMod(costKey)
      })}</p>`,
      buttons: [
        {
          action: "fee",
          label: game.i18n.localize("COMMLINK.Service.Fee"),
          default: true
        },
        {
          action: "favor",
          label: game.i18n.localize("COMMLINK.Service.Favor")
        }
      ]
    });
  } catch {
    return;
  }
  if (choice !== "fee" && choice !== "favor") return;

  const proLabel = game.i18n.localize("COMMLINK.Connection.Professionalism");
  const proMod = await promptModifier({
    title: proLabel,
    die: contact.professionalism
  });
  if (proMod === null) return;
  const pro = await rollTraitDie(contact.professionalism, proMod, proLabel);

  let loy = null;
  let loyMod = 0;
  if (pro.success && choice === "favor") {
    loyMod = await promptFavorRisk({
      die: contact.loyalty,
      costKey
    });
    if (loyMod === null) return;
    loy = await rollTraitDie(contact.loyalty, loyMod);
  }

  const owner = commlinkOwner(commlink);
  const costText = formatCost(costKey);
  const paid = false;
  const html = serviceCardHtml({
    contactName: contactDisplayName(contact),
    serviceName,
    costText,
    mode: choice,
    pro,
    detail: pro.success && INFO_COST_KEYS.has(costKey)
      ? game.i18n.localize(`COMMLINK.Service.Detail.${detailGradeKey(pro.raises)}`)
      : "",
    paid,
    favorModText: loy
      ? game.i18n.format("COMMLINK.Service.FavorMod", {
        risk: riskLabel(loyMod),
        mod: formatSigned(loyMod)
      })
      : "",
    loy
  });

  const flags = { [MODULE_ID]: {} };
  if (choice === "fee" && pro.success) {
    flags[MODULE_ID].pay = {
      actorUuid: owner?.uuid ?? "",
      amount: COST_AMOUNTS[costKey],
      paid: false
    };
  }

  let shown3d = false;
  for (const roll of [pro.roll, loy?.roll].filter(Boolean)) {
    shown3d = await showDice3d(roll) || shown3d;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: owner }),
    content: html,
    sound: shown3d ? null : CONFIG.sounds.dice,
    flags
  });
}

async function actorFromPayFlag(message) {
  const pay = message?.getFlag(MODULE_ID, "pay");
  if (pay?.actorUuid) {
    try {
      const doc = await fromUuid(pay.actorUuid);
      const actor = worldActor(doc);
      if (actor?.documentName === "Actor") return actor;
    } catch {
      /* fall through */
    }
  }
  return message?.speakerActor ?? game.user.character ?? null;
}

async function deductServiceCost(message) {
  const pay = message?.getFlag(MODULE_ID, "pay");
  if (!pay || pay.paid) return;
  const actor = await actorFromPayFlag(message);
  if (!actor || actor.documentName !== "Actor") {
    ui.notifications.warn(game.i18n.localize("COMMLINK.Service.NoPayer"));
    return;
  }
  if (!canPayFrom(actor)) {
    ui.notifications.warn(game.i18n.localize("COMMLINK.NoPermission"));
    return;
  }
  const current = Number(actor.system?.details?.currency);
  if (!Number.isFinite(current)) {
    ui.notifications.warn(game.i18n.localize("COMMLINK.Service.NoCurrency"));
    return;
  }
  await actor.update({ "system.details.currency": current - pay.amount });
  const next = { ...pay, paid: true };
  await message.setFlag(MODULE_ID, "pay", next);
  const button = document.querySelector(`.chat-message[data-message-id="${message.id}"] .cl-pay-btn`);
  if (button) {
    button.disabled = true;
    button.textContent = game.i18n.localize("COMMLINK.Service.Paid");
  }
  ui.notifications.info(game.i18n.format("COMMLINK.Service.Deducted", {
    name: actor.name,
    cost: formatYen(pay.amount)
  }));
}

function bindPayButton(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelector) return;
  const pay = message.getFlag(MODULE_ID, "pay");
  if (!pay) return;
  let button = root.querySelector(".cl-pay-btn");
  if (!button) {
    const card = root.querySelector(".cl-card") ?? root.querySelector(".message-content");
    if (!card) return;
    button = document.createElement("button");
    button.type = "button";
    button.className = "cl-pay-btn";
    button.dataset.action = "pay";
    card.append(button);
  }
  button.textContent = pay.paid
    ? game.i18n.localize("COMMLINK.Service.Paid")
    : game.i18n.format("COMMLINK.Service.Deduct", { cost: formatYen(pay.amount) });
  button.disabled = Boolean(pay.paid);
  if (pay.paid) return;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.busy) return;
    button.dataset.busy = "1";
    deductServiceCost(message).finally(() => {
      delete button.dataset.busy;
    });
  });
}

class CommlinkApp extends ApplicationV2 {
  constructor(item) {
    const size = defaultSize();
    super({
      id: `${MODULE_ID}-${item.id}`,
      window: { title: item.name || "COMMLINK.Title" },
      position: { width: size.width, height: size.height }
    });
    this.item = item;
    this.#page = "list";
    this.#callId = null;
  }

  #page;
  #callId;
  #hooks = [];

  static DEFAULT_OPTIONS = {
    classes: ["commlink-app"],
    window: {
      icon: "fa-solid fa-mobile-screen",
      resizable: true,
      minimizable: false
    },
    position: { width: 384, height: 256 }
  };

  setPosition(position = {}) {
    if (Number.isFinite(position.width)) {
      position.height = Math.round(position.width / ASPECT);
    } else if (Number.isFinite(position.height)) {
      position.width = Math.round(position.height * ASPECT);
    }
    return super.setPosition(position);
  }

  async _renderHTML() {
    const root = document.createElement("div");
    root.className = "cl-device";

    const img = document.createElement("img");
    img.className = "cl-chrome";
    img.src = getDesign(this.item).src;
    img.alt = this.item.name || game.i18n.localize("COMMLINK.Title");
    img.draggable = false;
    root.dataset.design = getDesign(this.item).id;

    const screen = document.createElement("div");
    screen.className = "cl-screen";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "cl-close";
    close.dataset.action = "close";
    close.dataset.tooltip = game.i18n.localize("COMMLINK.Close");
    close.setAttribute("aria-label", game.i18n.localize("COMMLINK.Close"));
    close.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    root.append(img, screen, close);
    if (canEdit(this.item)) {
      const design = document.createElement("button");
      design.type = "button";
      design.className = "cl-design";
      design.dataset.action = "design";
      design.dataset.tooltip = game.i18n.localize("COMMLINK.Design.Title");
      design.setAttribute("aria-label", game.i18n.localize("COMMLINK.Design.Title"));
      design.innerHTML = '<i class="fa-solid fa-palette"></i>';
      root.append(design);
    }
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.querySelector(".cl-device")?.addEventListener("pointerdown", event => this.#onPointerDown(event));
    this.element.querySelector(".cl-screen")?.addEventListener("click", event => this.#onScreenClick(event));
    this.element.querySelector(".cl-screen")?.addEventListener("change", event => this.#onScreenChange(event));
    this.element.querySelector(".cl-design")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      pickDesign(this.item);
    });

    const DragDrop = foundry.applications?.ux?.DragDrop?.implementation;
    if (DragDrop) {
      new DragDrop({
        dropSelector: ".cl-screen",
        callbacks: { drop: event => this.#onDrop(event) }
      }).bind(this.element);
    } else {
      this.element.querySelector(".cl-screen")?.addEventListener("drop", event => this.#onDrop(event));
    }

    this.#watch("updateItem", doc => {
      if (doc.uuid !== this.item.uuid) return;
      this.item = doc;
      this.#applyChrome();
      this.#paint();
    });
    this.#watch("updateActor", actor => {
      const owner = contactStore(this.item);
      if (owner?.documentName === "Actor" && actor.id === owner.id) {
        this.#paint();
        return;
      }
      if (!getContacts(this.item).some(entry => entry.actorUuid === actor.uuid)) return;
      this.#paint();
    });
    this.#watch("deleteActor", actor => {
      if (!getContacts(this.item).some(entry => entry.actorUuid === actor.uuid)) return;
      this.#paint();
    });
    this.#paint();
  }

  #watch(event, fn) {
    Hooks.on(event, fn);
    this.#hooks.push([event, fn]);
  }

  async close(options) {
    for (const [event, fn] of this.#hooks) Hooks.off(event, fn);
    this.#hooks = [];
    return super.close(options);
  }

  #applyChrome() {
    const design = getDesign(this.item);
    const device = this.element?.querySelector(".cl-device");
    const img = this.element?.querySelector(".cl-chrome");
    if (device) device.dataset.design = design.id;
    if (img) img.src = design.src;
  }

  async #paint() {
    const screen = this.element?.querySelector(".cl-screen");
    if (!screen) return;
    screen.replaceChildren(this.#page === "call" ? await this.#buildCall() : await this.#buildList());
  }

  async #buildList() {
    const app = document.createElement("div");
    app.className = "cl-app cl-contacts";

    const bar = document.createElement("div");
    bar.className = "cl-app-bar";
    const title = document.createElement("span");
    title.textContent = game.i18n.localize("COMMLINK.Contacts.Title");
    bar.append(title);
    if (canEdit(this.item)) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "cl-icon-btn";
      add.dataset.action = "add";
      add.dataset.tooltip = game.i18n.localize("COMMLINK.Contacts.Add");
      add.setAttribute("aria-label", game.i18n.localize("COMMLINK.Contacts.Add"));
      add.innerHTML = '<i class="fa-solid fa-plus"></i>';
      bar.append(add);
    }
    app.append(bar);

    const contacts = await Promise.all(getContacts(this.item).map(resolveContact));
    contacts.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

    if (!contacts.length) {
      const empty = document.createElement("div");
      empty.className = "cl-empty";
      empty.textContent = game.i18n.localize(
        canEdit(this.item) ? "COMMLINK.Contacts.Empty" : "COMMLINK.Contacts.EmptyView"
      );
      app.append(empty);
      return app;
    }

    const list = document.createElement("ul");
    list.className = "cl-list";
    for (const contact of contacts) {
      const row = document.createElement("li");
      row.className = "cl-row";
      if (contact.missing) row.classList.add("is-missing");
      row.dataset.action = "call";
      row.dataset.contactId = contact.id;

      const photo = document.createElement("img");
      photo.src = contact.img;
      photo.alt = "";
      photo.draggable = false;

      const name = document.createElement("span");
      name.className = "cl-row-name";
      name.textContent = contactDisplayName(contact);

      const dice = document.createElement("span");
      dice.className = "cl-row-dice";
      dice.textContent = `${formatDie(contact.professionalism)} · ${formatDie(contact.loyalty)}`;
      dice.dataset.tooltip = [
        `${game.i18n.localize("COMMLINK.Connection.Professionalism")} ${formatDie(contact.professionalism)}`,
        `${game.i18n.localize("COMMLINK.Connection.Loyalty")} ${formatDie(contact.loyalty)}`
      ].join(", ");

      row.append(photo, name, dice);
      if (canEdit(this.item)) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "cl-icon-btn";
        remove.dataset.action = "remove";
        remove.dataset.contactId = contact.id;
        remove.dataset.tooltip = game.i18n.localize("COMMLINK.Contacts.Remove");
        remove.setAttribute("aria-label", game.i18n.localize("COMMLINK.Contacts.Remove"));
        remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        row.append(remove);
      }
      list.append(row);
    }
    app.append(list);
    return app;
  }

  async #buildCall() {
    const entry = getContacts(this.item).find(contact => contact.id === this.#callId);
    const contact = entry ? await resolveContact(entry) : null;
    const app = document.createElement("div");
    app.className = "cl-app cl-call";

    const bar = document.createElement("div");
    bar.className = "cl-app-bar";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "cl-icon-btn";
    back.dataset.action = "back";
    back.dataset.tooltip = game.i18n.localize("COMMLINK.Call.Back");
    back.setAttribute("aria-label", game.i18n.localize("COMMLINK.Call.Back"));
    back.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    const title = document.createElement(contact && !contact.missing ? "button" : "span");
    title.className = "cl-app-title";
    title.textContent = contact ? contactDisplayName(contact) : game.i18n.localize("COMMLINK.Call.Unknown");
    if (title.tagName === "BUTTON") {
      title.type = "button";
      title.dataset.action = "open-actor";
      title.dataset.tooltip = game.i18n.localize("COMMLINK.Call.OpenActor");
    }
    bar.append(back, title);
    app.append(bar);

    if (!contact) {
      const empty = document.createElement("div");
      empty.className = "cl-empty";
      empty.textContent = game.i18n.localize("COMMLINK.Call.Unknown");
      app.append(empty);
      return app;
    }

    const photo = document.createElement("img");
    photo.className = "cl-call-photo";
    photo.src = contact.img;
    photo.alt = contact.name;
    photo.draggable = false;

    const blurb = document.createElement("div");
    blurb.className = "cl-call-blurb";
    blurb.textContent = contact.blurb || game.i18n.localize("COMMLINK.Call.NoBlurb");

    const meta = document.createElement("div");
    meta.className = "cl-call-meta";
    meta.append(this.#buildTraits(contact), blurb);

    if (contact.services.length) {
      const services = document.createElement("div");
      services.className = "cl-services";
      const heading = document.createElement("div");
      heading.className = "cl-services-title";
      heading.textContent = game.i18n.localize("COMMLINK.Call.Services");
      const list = document.createElement("div");
      list.className = "cl-services-list";
      contact.services.forEach(service => {
        const row = document.createElement("div");
        row.className = "cl-service-row";
        const link = document.createElement("button");
        link.type = "button";
        link.className = "cl-service-link";
        link.dataset.action = "service";
        link.dataset.costKey = service.costKey;
        link.dataset.tooltip = service.example;
        const title = document.createElement("span");
        title.className = "cl-service-name";
        title.textContent = `${service.name} (${service.cost})`;
        const example = document.createElement("span");
        example.className = "cl-service-example";
        example.textContent = service.example;
        const favor = document.createElement("span");
        favor.className = "cl-service-favor";
        favor.textContent = game.i18n.format("COMMLINK.Service.FavorCost", { favor: service.favor });
        link.append(title, example, favor);
        row.append(link);
        list.append(row);
      });
      services.append(heading, list);
      meta.append(services);
    }

    const head = document.createElement("div");
    head.className = "cl-call-head";
    head.append(photo, meta);

    const body = document.createElement("div");
    body.className = "cl-call-body";
    body.append(head);
    app.append(body);
    return app;
  }

  #onScreenClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    const contactId = event.target.closest("[data-contact-id]")?.dataset.contactId;
    if (action === "call" && contactId) {
      this.#page = "call";
      this.#callId = contactId;
      this.#paint();
      return;
    }
    if (action === "back") {
      this.#page = "list";
      this.#callId = null;
      this.#paint();
      return;
    }
    if (action === "open-actor") {
      const entry = getContacts(this.item).find(contact => contact.id === this.#callId);
      if (entry) resolveContact(entry).then(openContactActor);
      return;
    }
    if (action === "remove" && contactId && canEdit(this.item)) {
      removeContact(this.item, contactId);
      if (this.#callId === contactId) {
        this.#page = "list";
        this.#callId = null;
      }
      return;
    }
    if (action === "add" && canEdit(this.item)) this.#pickActor();
    if (action === "service") {
      const costKey = event.target.closest("[data-cost-key]")?.dataset.costKey;
      const entry = getContacts(this.item).find(contact => contact.id === this.#callId);
      if (!entry || !costKey) return;
      resolveContact(entry).then(contact => requestService(this.item, contact, costKey));
    }
  }

  #onScreenChange(event) {
    if (!this.#callId || !canEdit(this.item)) return;
    const select = event.target.closest("select.cl-trait-select");
    if (select) {
      setContactDie(this.item, this.#callId, select.dataset.field, select.value);
      return;
    }
    const type = event.target.closest("input.cl-type-input");
    if (type) setContactType(this.item, this.#callId, type.value);
  }

  #buildTraits(contact) {
    const wrap = document.createElement("div");
    wrap.className = "cl-traits";
    wrap.append(
      this.#buildTrait("professionalism", contact.professionalism, "COMMLINK.Connection.Professionalism"),
      this.#buildTrait("loyalty", contact.loyalty, "COMMLINK.Connection.Loyalty"),
      this.#buildType(contact.connectionType)
    );
    return wrap;
  }

  #buildType(value) {
    const trait = document.createElement("label");
    trait.className = "cl-trait cl-type";
    const caption = document.createElement("span");
    caption.textContent = game.i18n.localize("COMMLINK.Connection.Type");
    trait.append(caption);
    if (canEdit(this.item)) {
      const listId = `${MODULE_ID}-types-${this.id}`;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "cl-type-input";
      input.setAttribute("list", listId);
      input.value = value;
      input.placeholder = game.i18n.localize("COMMLINK.Connection.TypeHint");
      const list = document.createElement("datalist");
      list.id = listId;
      for (const suggestion of TYPE_SUGGESTIONS) {
        const option = document.createElement("option");
        option.value = suggestion;
        list.append(option);
      }
      trait.append(input, list);
    } else {
      const text = document.createElement("span");
      text.className = "cl-trait-die";
      text.textContent = value || "—";
      trait.append(text);
    }
    return trait;
  }

  #buildTrait(field, value, labelKey) {
    const trait = document.createElement("label");
    trait.className = "cl-trait";
    const caption = document.createElement("span");
    caption.textContent = game.i18n.localize(labelKey);
    trait.append(caption);
    if (canEdit(this.item)) {
      const select = document.createElement("select");
      select.className = "cl-trait-select";
      select.dataset.field = field;
      select.innerHTML = dieOptions(value);
      trait.append(select);
    } else {
      const die = document.createElement("span");
      die.className = "cl-trait-die";
      die.textContent = formatDie(value);
      trait.append(die);
    }
    return trait;
  }

  async #onDrop(event) {
    event.preventDefault();
    if (!canEdit(this.item)) return;
    const actor = await actorFromDrop(event);
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("COMMLINK.Contacts.NotActor"));
      return;
    }
    await addContact(this.item, actor);
  }

  async #pickActor() {
    const actors = game.actors.filter(actor => game.user.isGM || actor.testUserPermission(game.user, "OBSERVER"));
    if (!actors.length) {
      ui.notifications.warn(game.i18n.localize("COMMLINK.Contacts.NoneVisible"));
      return;
    }
    actors.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    const options = actors.map(actor => `<option value="${actor.uuid}">${foundry.utils.escapeHTML(actor.name)}</option>`).join("");
    const content = `<p>${game.i18n.localize("COMMLINK.Contacts.PickHint")}</p><select name="uuid">${options}</select>`;
    let uuid;
    try {
      uuid = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("COMMLINK.Contacts.Add") },
        content,
        ok: {
          label: game.i18n.localize("COMMLINK.Contacts.Add"),
          callback: (_event, button) => button.form.elements.uuid.value
        }
      });
    } catch {
      return;
    }
    if (!uuid) return;
    const actor = await fromUuid(uuid);
    if (actor) await addContact(this.item, actor);
  }

  #onPointerDown(event) {
    if (event.button !== 0) return;
    if (event.target.closest(".cl-screen, .cl-close, .cl-design, .window-resize-handle")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const { left, top } = this.position;
    const device = this.element.querySelector(".cl-device");
    device?.classList.add("is-dragging");

    const onMove = ev => {
      super.setPosition({
        left: left + ev.clientX - startX,
        top: top + ev.clientY - startY
      });
    };
    const onUp = () => {
      device?.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
}

async function openCommlink(itemOrUuid) {
  const item = typeof itemOrUuid === "string" ? await fromUuid(itemOrUuid) : itemOrUuid;
  if (!item) return null;
  if (!canOpen(item)) {
    ui.notifications.warn(game.i18n.localize("COMMLINK.NoPermission"));
    return null;
  }
  await migrateContacts(item);
  const id = `${MODULE_ID}-${item.id}`;
  const existing = foundry.applications.instances.get(id);
  if (existing) {
    existing.bringToFront?.();
    existing.render({ force: true });
    return existing;
  }
  const app = new CommlinkApp(item);
  app.render({ force: true });
  return app;
}

async function toggleCommlink(item) {
  if (!item || !game.user.isGM) return;
  const next = item.getFlag(MODULE_ID, "enabled") !== true;
  await item.setFlag(MODULE_ID, "enabled", next);
}

function addSheetControls(app, controls) {
  const item = app.document;
  if (!item) return;
  if (isCommlink(item) && canOpen(item)) {
    controls.unshift({
      label: "COMMLINK.Open",
      icon: "fa-solid fa-mobile-screen",
      onClick: () => openCommlink(item)
    });
  }
  if (isCommlink(item) && canEdit(item)) {
    controls.unshift({
      label: "COMMLINK.Design.Title",
      icon: "fa-solid fa-palette",
      onClick: () => pickDesign(item)
    });
  }
  if (game.user.isGM) {
    const marked = item.getFlag(MODULE_ID, "enabled") === true;
    controls.unshift({
      label: marked ? "COMMLINK.ToggleOff" : "COMMLINK.ToggleOn",
      icon: marked ? "fa-solid fa-toggle-on" : "fa-solid fa-toggle-off",
      onClick: () => toggleCommlink(item)
    });
  }
}

function injectHeaderButton(app, element) {
  const item = app.document;
  if (!isCommlink(item) || !canOpen(item)) return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  const header = root?.querySelector?.(".window-header");
  if (!header || header.querySelector(".commlink-open")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-control icon fa-solid fa-mobile-screen commlink-open";
  button.dataset.tooltip = game.i18n.localize("COMMLINK.Open");
  button.setAttribute("aria-label", game.i18n.localize("COMMLINK.Open"));
  button.addEventListener("click", event => {
    event.preventDefault();
    openCommlink(item);
  });

  const close = header.querySelector("[data-action='close']");
  if (close) close.before(button);
  else header.append(button);
}

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = {
    open: openCommlink,
    isCommlink,
    canOpen,
    addContact,
    setContactDie,
    setContactType,
    requestService,
    getDesign,
    setDesign
  };
});

Hooks.once("ready", () => {
  game.commlink = game.modules.get(MODULE_ID).api;

  Hooks.on("getHeaderControlsSwadeItemSheetV2", addSheetControls);
  Hooks.on("getHeaderControlsItemSheet", addSheetControls);
  Hooks.on("renderSwadeItemSheetV2", injectHeaderButton);
  Hooks.on("renderItemSheet", injectHeaderButton);
  Hooks.on("renderItemSheetV2", injectHeaderButton);
  Hooks.on("renderChatMessageHTML", (message, html) => bindPayButton(message, html));

  Hooks.on("getItemDirectoryEntryContext", (_html, options) => {
    options.push({
      name: "COMMLINK.Open",
      icon: '<i class="fa-solid fa-mobile-screen"></i>',
      condition: el => {
        const item = itemFromSheetEl(el?.[0] ?? el);
        return isCommlink(item) && canOpen(item);
      },
      callback: el => openCommlink(itemFromSheetEl(el?.[0] ?? el))
    });
  });
});
