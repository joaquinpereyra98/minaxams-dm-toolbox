import { TEMPLATE_PATH } from "../constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Displays a list of spells with quick access to their sheets.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export default class SpellList extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  constructor(options = {}) {
    super(options);

    /** @type {foundry.documents.Item[]} */
    this.#spells = options.spells ?? [];
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["minaxams-dm-toolbox", "spell-list", "dnd5e2"],
    window: {
      resizable: true,
      title: "Spell List",
    },
    actions: {
      openDocument: SpellList.#onOpenDocument,
    },
  };
  /** @override */
  static PARTS = {
    list: {
      template: `${TEMPLATE_PATH}/spell-list/list.hbs`,
    },
  };

  /**@type {foundry.documents.Item[]} */
  #spells;

  /** @returns {foundry.documents.Item[]} */
  get spells() {
    return this.#spells;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**@inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if ("spells" in options) this.#spells = options.spells;
    context.spells = this.spells;
    context.label = options.label;
    return context;
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Open the sheet for a document.
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static async #onOpenDocument(_, target) {
    const { docUuid } = target.dataset;
    const doc = await fromUuid(docUuid);
    doc.sheet.render({ force: true });
  }
}
