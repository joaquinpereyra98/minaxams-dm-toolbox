import { TEMPLATE_PATH } from "../constants.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 *  @import {ApplicationClickAction} from "@client/applications/_types.mjs";
 */

export default class MinaxamsToolbox extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  constructor(options = {}) {
    super(options);
    this._party = options.party;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "minaxams-toolbox",
    classes: ["minaxams-dm-toolbox", "minaxams-toolbox", "dnd5e2"],
    tag: "form",
    window: {
      resizable: true,
    },
    actions: {
      toggleAccordion: MinaxamsToolbox.#onToggleAccordion,
      toggleSegment: MinaxamsToolbox.#onToggleSegment,
      setHP: MinaxamsToolbox.#onSetHP,
    },
    form: {
      handler: undefined,
      submitOnChange: true,
    },
  };

  /** @override */
  static TABS = {
    primmary: {
      initial: "party",
      tabs: [{ id: "party", label: "Party Overview" }],
    },
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: "systems/dnd5e/templates/shared/horizontal-tabs.hbs",
      templates: ["templates/generic/tab-navigation.hbs"],
    },
    party: {
      template: `${TEMPLATE_PATH}/minaxams-toolbox/party.hbs`,
      scrollable: [""],
    },
    stats: {
      template: `${TEMPLATE_PATH}/minaxams-toolbox/stats.hbs`,
      scrollable: [""],
    },
  };

  /**
   * @type {foundry.documents.Actor}
   */
  get party() {
    return this._party;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.party.apps[this.id] = this;
    for (const actor of this.party.system.creatures) {
      actor.apps[this.id] = this;
    }
  }

  /** @inheritDoc */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);

    for (const oldAcc of priorElement.querySelectorAll(
      ".accordion[data-actor-id]"
    )) {
      newElement
        .querySelector(`.accordion[data-actor-id="${oldAcc.dataset.actorId}"]`)
        ?.classList.toggle("close", oldAcc.classList.contains("close"));
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    delete this.party.apps[this.id];
    for (const actor of this.party.system.creatures) {
      delete actor.apps[this.id];
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.members = this.party.system.creatures;
    return context;
  }

  /**@inheritdoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    if (partId in context.tabs) context.tab = context.tabs[partId];

    switch (partId) {
      case "party":
        await this._preparePartyPartContext(context, options);
        break;
    }

    return context;
  }

  async _preparePartyPartContext(context, _options) {
    context.members.forEach((a) => {
      const { effectiveMax, value } = a.system.attributes.hp;
      if (!effectiveMax) return;
      a.barSegments = Array.from({ length: effectiveMax }, (_, i) => i < value);
    });
    return context;
  }

  /* -------------------------------------------- */
  /*  Private API                                 */
  /* -------------------------------------------- */

  /**
   *
   * @param {String} id
   */
  getActorById(id) {
    return this.party.system.creatures.find((a) => a.id === id);
  }

  /* -------------------------------------------- */
  /*  Action Event Handlers                       */
  /* -------------------------------------------- */

  /**
   * Toggle Accordion Element
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static #onToggleAccordion(_event, target) {
    const accordion = target.closest(".accordion");
    accordion.classList.toggle("close");
  }

  /**
   * Toggle Segment Bar
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static async #onToggleSegment(_event, target) {
    const idx = +target.dataset.index;
    const actor = this.getActorById(target.dataset.actorId);
    const hp = actor.system.attributes.hp.value;

    await actor.update({
      "system.attributes.hp.value": idx + 1 === hp ? hp - 1 : idx + 1,
    });
  }

  /**
   *
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static async #onSetHP(_event, target) {
    const isAddMode = target.dataset.mode === "add";
    const value = Number(target.dataset.value);
    const { actorId } = target.closest("[data-actor-id]").dataset;
    const actor = this.getActorById(actorId);
    const hp = actor.system.attributes.hp.value;
    await actor.update({
      "system.attributes.hp.value": isAddMode
        ? hp + Number(value)
        : Number(value),
    });
  }
}
