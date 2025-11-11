import { TEMPLATE_PATH, MODULE_ID, FLAGS } from "../constants.mjs";
import { renderList, splitSegments } from "../utils.mjs";
import SpellList from "./spell-list.mjs";
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
    window: {
      resizable: true,
    },
    actions: {
      toggleAccordion: MinaxamsToolbox.#onToggleAccordion,
      toggleSegment: MinaxamsToolbox.#onToggleSegment,
      setHP: MinaxamsToolbox.#onSetHP,
      openActorListConfig: MinaxamsToolbox.#onOpenActorListConfig,
      openPreparedSpells: MinaxamsToolbox.#onOpenPreparedSpells,
      requestRoll: MinaxamsToolbox.#onRequestRoll,
    },
    position: {
      width: 420,
    },
  };

  /** @override */
  static TABS = {
    primmary: {
      initial: "party",
      tabs: [
        { id: "party", label: "Party Overview" },
        { id: "stats", label: "Important Stats" },
        { id: "tools", label: "GM Tools" },
      ],
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
    tools: {
      template: `${TEMPLATE_PATH}/minaxams-toolbox/tools.hbs`,
      scrollable: [""],
    },
  };

  /**
   * @type {foundry.documents.Actor}
   */
  get party() {
    return this._party;
  }

  _spellList;

  /**@type {ApplicationV2} */
  get spellList() {
    return this._spellList;
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

  async _onRender(context, options) {
    await super._onRender(context, options);

    for (const input of this.element.querySelectorAll(
      "input.member-hp-input"
    )) {
      input.addEventListener("change", (event) => {
        this.#onChangeMemberHPInput.call(this, event);
      });
    }
  }

  /** @inheritDoc */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);

    for (const oldAcc of priorElement.querySelectorAll(
      `[data-application-part="${partId}"] .accordion[data-actor-id]`
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
    context.members = foundry.utils.deepClone(this.party.system.creatures);
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
      case "stats":
        await this._prepareStatsPartContext(context, options);
        break;
    }

    return context;
  }

  async _preparePartyPartContext(context, _options) {
    context.members.forEach((a) => {
      const { effectiveMax, value } = a.system.attributes.hp;
      if (!effectiveMax) return;
      const segments = Array.from({ length: effectiveMax }, (_, i) => ({
        bool: i < value,
        index: i + 1,
      }));
      a.barSegments = splitSegments(segments);
    });
    return context;
  }

  async _prepareStatsPartContext(context, _options) {
    context.members.forEach((a) => {
      a.labels.class = Object.values(a.classes)
        .sort((a, b) => {
          return b.system.levels - a.system.levels;
        })
        .map((c) => `${c.name} ${c.system.levels}`)
        .join(" / ");

      a.skills = Object.entries(a.system.skills)
        .filter(([key]) =>
          (a.getFlag(MODULE_ID, FLAGS.SKILLS) ?? []).includes(key)
        )
        .map(([key, skillData]) => {
          const config = CONFIG.DND5E.skills[key];
          return {
            key,
            value: skillData.total,
            passive: skillData.passive,
            label: config?.label ?? key,
            icon: config?.icon ?? "",
          };
        });

      a.spells = Object.entries(a.system.spells)
        .filter(([key]) =>
          (a.getFlag(MODULE_ID, FLAGS.SPELLS) ?? []).includes(key)
        )
        .map(([key, spellData]) => {
          return {
            key,
            type: spellData.type,
            value: spellData.value,
            max: spellData.max,
            label: spellData.label ?? key,
            level: spellData.level,
          };
        });
    });
  }

  /* -------------------------------------------- */
  /*  Private API                                 */
  /* -------------------------------------------- */

  /**
   *
   * @param {String} id
   * @returns {foundry.documents.Actor}
   */
  #getActorById(id) {
    return this.party.system.creatures.find((a) => a.id === id);
  }

  /**
   * @param {foundry.documents.Actor} actor
   */
  async #openConfig(actor) {
    const { skills } = CONFIG.DND5E;

    const skillFlag = actor.getFlag(MODULE_ID, FLAGS.SKILLS) ?? [];
    const spellFlag = actor.getFlag(MODULE_ID, FLAGS.SPELLS) ?? [];

    const skillList = Object.entries(skills).map(
      ([value, { label, icon }]) => ({ value, label, icon })
    );
    const spellList = Object.entries(actor.system.spells)
      .filter(([, { max }]) => !!max)
      .map(([value, { label }]) => ({ value, label }));

    const content = `
    <div class="colums">
      <div class="skills-container">${renderList(
        skillList,
        skillFlag,
        "skills"
      )}</div>
      ${
        spellList.length
          ? `<hr class="vertical"> <div class="spells-container">${renderList(
              spellList,
              spellFlag,
              "spells"
            )}</div>`
          : ""
      }
    </div>`;

    const data = await foundry.applications.api.Dialog.input({
      position: { width: 450 },
      content,
      classes: ["actor-list-config", "minaxams-dm-toolbox"],
    });

    if (!data) return null;

    // Clean empty values
    data.skills = data.skills?.filter(Boolean);
    data.spells = data.spells?.filter(Boolean);

    return data;
  }

  /* -------------------------------------------- */
  /*  Action Event Handlers                       */
  /* -------------------------------------------- */

  /**
   * @param {Event} event
   */
  #onChangeMemberHPInput(event) {
    const input = event.currentTarget;
    const actorId = input.closest("[data-actor-id]").dataset.actorId;
    const actor = this.#getActorById(actorId);

    let value = input.value.trim();
    if (!value.startsWith("+") && !value.startsWith("-")) value = `-${value}`;
    const delta = Number(value);

    actor.update({
      "system.attributes.hp.value": actor.system.attributes.hp.value + delta,
    });
  }

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
    const idx = Number(target.dataset.index);

    const { actorId } = target.closest("[data-actor-id]").dataset;
    const actor = this.#getActorById(actorId);

    const hp = actor.system.attributes.hp.value;
    await actor.update({
      "system.attributes.hp.value": idx === hp ? hp - 1 : idx,
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
    const actor = this.#getActorById(actorId);
    const hp = actor.system.attributes.hp.value;
    await actor.update({
      "system.attributes.hp.value": isAddMode
        ? hp + Number(value)
        : Number(value),
    });
  }

  /**
   *
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static async #onOpenActorListConfig(event, target) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const { actorId } = target.closest("[data-actor-id]").dataset;
    const actor = this.#getActorById(actorId);

    const data = await this.#openConfig(actor);

    if (data === null) return;

    await actor.update({
      [`flags.${MODULE_ID}.${FLAGS.SKILLS}`]: data.skills,
      [`flags.${MODULE_ID}.${FLAGS.SPELLS}`]: data.spells,
    });
  }

  /**
   *
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static #onOpenPreparedSpells(_, target) {
    const level = Number(target.dataset.level);
    const { label, type } = target.dataset;

    const { actorId } = target.closest("[data-actor-id]").dataset;
    const actor = this.#getActorById(actorId);

    const spells = actor.itemTypes.spell.filter((s) => {
      const lvl = s.system.level;
      const isPrepared = s.system.prepared !== 0;
      const isCantrip = level === 0;

      const matchesLevel = type === "pact" ? lvl <= level : lvl === level;

      return matchesLevel && !isCantrip && isPrepared;
    });

    if (!this.spellList) this._spellList = new SpellList({ spells, label });
    this.spellList.render({ force: true, spells, label });
  }

  /**
   *
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static async #onRequestRoll(_, target) {
    const { skillKey } = target.dataset;

    const { actorId } = target.closest("[data-actor-id]").dataset;
    const actor = this.#getActorById(actorId);

    const ability =
      actor.system.skills[skillKey]?.ability ??
      CONFIG.DND5E.skills[skillKey].ability;

    const dataset = {
      type: "skill",
      skill: skillKey,
      ability,
    };

    const user =
      game.users.getDesignatedUser(
        (user) =>
          user.active && !user.isGM && actor.testUserPermission(user, "OWNER")
      ) ?? game.users.activeGM;

    const MsgCls = foundry.documents.ChatMessage.implementation;
    const { renderTemplate } = foundry.applications.handlebars;
    const chatData = {
      user: game.user.id,
      content: await renderTemplate(
        "systems/dnd5e/templates/chat/roll-request-card.hbs",
        {
          buttons: [
            {
              buttonLabel: dnd5e.enrichers.createRollLabel({
                ...dataset,
                format: "short",
                icon: true,
              }),
              hiddenLabel: dnd5e.enrichers.createRollLabel({
                ...dataset,
                format: "short",
                icon: true,
                hideDC: true,
              }),
              dataset: { ...dataset, action: "rollRequest", visibility: "all" },
            },
          ],
        }
      ),
      flavor: game.i18n.localize("EDITOR.DND5E.Inline.RollRequest"),
      speaker: MsgCls.getSpeaker({
        user: game.user,
      }),
      whisper: [user],
    };
    await MsgCls.create(chatData);
  }
}
