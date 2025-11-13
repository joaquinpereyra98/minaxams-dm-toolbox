import { TEMPLATE_PATH, MODULE_ID, FLAGS } from "../constants.mjs";
import { renderList, splitSegments, parseHeight } from "../utils.mjs";
import SpellList from "./spell-list.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 *  @import {ApplicationClickAction} from "@client/applications/_types.mjs";
 */

export default class MinaxamsToolbox extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "minaxams-toolbox",
    classes: [
      "minaxams-dm-toolbox",
      "minaxams-toolbox",
      "standard-form",
      "dnd5e2",
    ],
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
      selectActor: MinaxamsToolbox.#onSelectActor,
    },
    position: {
      width: 450,
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

  /**@type {foundry.documents.Actor[]} */
  get actors() {
    return game.users
      .filter((u) => u.active && u.character)
      .map((u) => u.character);
  }

  _spellList;

  /**@type {ApplicationV2} */
  get spellList() {
    return this._spellList;
  }

  /**@type {foundry.documents.Actor}  */
  _selectedActor;

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _onRender(context, options) {
    await super._onRender(context, options);

    for (const input of this.element.querySelectorAll(
      "input.member-hp-input"
    )) {
      input.addEventListener("change", (event) => {
        this.#onChangeMemberHPInput.call(this, event);
      });
    }

    for (const actor of this.actors) {
      if (!actor.apps[this.id]) actor.apps[this.id] = this;
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
    for (const actor of this.actors) {
      delete actor.apps[this.id];
    }

    if (this.spellList) this.spellList.close();
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.members = this.actors.map((a) => foundry.utils.deepClone(a));
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
      case "tools":
        await this._prepareToolsPartContext(context, options);
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

  async _prepareToolsPartContext(context, _options) {
    const actor = this._selectedActor || null;
    context.selectedActor = actor;

    if (!actor) {
      // default values
      context.exceedingCarryingCapacity = false;
      context.stringHeight = `0'0"`;
      context.heightFeet = 0;
      context.str = { value: 0, mod: 0 };
      context.jumpingTable = {
        running: { high: 0, long: 0 },
        standing: { high: 0, long: 0 },
        limits: {
          runningVertical: 0,
          standingVertical: 0,
          runningObstacle: 0,
          standingObstacle: 0,
        },
      };
      return;
    }

    context.exceedingCarryingCapacity = actor.statuses?.has(
      "exceedingCarryingCapacity"
    );

    const rawHeight = (actor.system?.details?.height || "").trim();
    context.stringHeight = rawHeight || `0'0"`;
    const heightFeet = parseHeight(context.stringHeight);
    context.heightFeet = heightFeet;

    const { value: strScore = 0, mod: strMod = 0 } =
      actor.system?.abilities?.str || {};
    context.str = { value: strScore, mod: strMod };

    const runningHigh = Math.max(0, 3 + strMod);

    context.jumpingTable = {
      running: {
        high: runningHigh,
        long: strScore,
      },
      standing: {
        high: runningHigh * 0.5,
        long: strScore * 0.5,
      },
      limits: {
        runningVertical: runningHigh + 1.5 * heightFeet,
        standingVertical: runningHigh * 0.5 + 1.5 * heightFeet,
        runningObstacle: strScore * 0.25,
        standingObstacle: strScore * 0.5 * 0.25,
      },
    };
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
    return this.actors.find((a) => a.id === id);
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

    const ensureArray = (value) =>
      (Array.isArray(value) ? value : [value]).filter(Boolean);

    data.skills = ensureArray(data.skills);
    data.spells = ensureArray(data.spells);

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

  /**
   *
   * @type {ApplicationClickAction}
   * @this {MinaxamsToolbox}
   */
  static #onSelectActor() {
    const token = canvas.tokens.controlled[0];
    if (!token?.actor) {
      return void ui.notifications.warn("Please select a token with actor");
    }

    this._selectedActor = token.actor;
    this.render({ parts: ["tools"] });
  }
}
