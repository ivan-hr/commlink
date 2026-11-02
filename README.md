# Commlink

A Foundry VTT module for **SWADE**. It turns a marked item into a commlink device window: contacts, connection services, professionalism and loyalty rolls, fees and favors.

The module is built for Savage Worlds (SWADE) with Shadowrun-style connections. It has only been tested with SWADE.

## What you get

- Device window with Renraku, Sony, Shiawase or Aztechnology casing (per item)
- Contact list on the commlink, with professionalism, loyalty and connection type
- Seven connection services with yen costs and favor risk modifiers
- Wildcard trait rolls (trait die + Wild Die d6, exploding, keep highest, TN 4)
- Chat cards with SWADE-style dice, success or failure, and a **pay cost** button
- Contacts stored on the **character**, not on the item, so deleting the commlink does not wipe the list

## Usage

Mark an item as a commlink (name matching `commlink` / `kommlink`, or the GM toggle on the item sheet). Open it from the item sheet header, the sheet controls, or the item directory context menu.

Drag actors onto the screen to add contacts. Set professionalism and loyalty dice and a connection type on the detail view. Click the name in the header to open that actor’s sheet.

### Connection services

A contact can provide the seven rule services (general intel through high-risk illegal help). Choose **pay a fee** or **call in a favor**.

- **Professionalism** is rolled first (wildcard). A failure has no cost.
- On a fee, a successful roll posts a chat card with **{cost} Kosten abziehen**. Clicking it deducts yen from the character.
- On a favor, **Loyalty** is rolled against TN 4. The GM picks a risk modifier (`+0` through `−8`) using the suggested range for that service.

### Storage

- **Casing** lives on the commlink item (`flags.commlink.design`).
- **Contacts** live on the owning actor (`flags.commlink.contacts`). Opening a commlink that still has old item-side contacts migrates them once.

## API

```js
const api = game.modules.get("commlink").api;

api.open(item);                 // item document or uuid
api.isCommlink(item);
api.canOpen(item);
api.addContact(item, actor);
api.setContactDie(item, contactId, "professionalism", 10);
api.setContactType(item, contactId, "Informantin");
api.requestService(item, contact, "general");
api.getDesign(item);
api.setDesign(item, "sony");
```

`game.commlink` is the same object after `ready`.

## Installation

To install, import this manifest into the module browser.

**Manifest URL:**
`https://raw.githubusercontent.com/ivan-hr/commlink/main/module.json`

## Requirements

- Foundry VTT v13 or newer (verified on v14)
- SWADE 5.2.0 or newer (verified on 6.0.4)

## License

MIT
