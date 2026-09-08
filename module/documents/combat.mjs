import { CNS5 } from "../config.mjs";

/**
 * A combatant, whose initiative *is* its Action Point pool.
 *
 * Holding the two as one number is deliberate. The tracker already shows
 * initiative and already sorts on it, so a pool kept anywhere else would mean
 * two numbers that must agree and a tracker that shows the wrong one. Spending
 * Action Points lowers initiative, which is exactly what the rules describe:
 * the order of play is the order of remaining pool, and it changes as the round
 * is spent.
 */
export class CnS5Combatant extends Combatant {
  /** @returns {number} Action Points left this round. */
  get pool() {
    return this.initiative ?? 0;
  }

  /** @returns {boolean} whether this combatant has held over and is done. */
  get held() {
    return this.getFlag("cns5", "held") === true;
  }

  /** @returns {boolean} whether this combatant has acted in the current phase. */
  get acted() {
    return this.getFlag("cns5", "acted") === true;
  }

  /** @returns {number} Base Action Points, the ceiling on what may be held over. */
  get bap() {
    return this.actor?.system?.bap ?? 0;
  }

  /**
   * What is added to the d10 at the start of a round: Base Action Points, the
   * armour modifier, and the exhaustion penalty.
   * @returns {number}
   */
  get roundBonus() {
    return this.actor?.system?.actionPoints?.bonus ?? 0;
  }

  /** @returns {boolean} whether this combatant can still act this round. */
  get active() {
    return !this.held && this.pool > 0;
  }
}

/* -------------------------------------------- */

/**
 * A Combat Round of Action Points (p268).
 *
 * The round is not a list of turns taken once each. It is a series of Action
 * Phases: within a phase everyone acts once in order of remaining pool, and
 * when the phase ends the order is worked out again from what everyone has
 * left. A round continues until every combatant has spent their pool or held
 * what remains of it over.
 *
 * The order is deliberately frozen for the length of a phase. Re-sorting the
 * moment someone spends would move people around the list while it is being
 * worked through, and nobody could tell who had yet to act. So each combatant
 * carries the index it was given when the phase opened, and that is what the
 * tracker sorts on until the phase closes.
 */
export class CnS5Combat extends Combat {
  /* -------------------------------------------- */

  /**
   * Sort by the order fixed when the phase opened.
   *
   * Foundry calls this as a bare comparator, so it cannot read anything off the
   * combat itself — which is why the index lives on each combatant rather than
   * in one array on the encounter.
   *
   * @inheritDoc
   */
  _sortCombatants(a, b) {
    const orderA = a.getFlag("cns5", "order") ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.getFlag("cns5", "order") ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name ?? "").localeCompare(b.name ?? "");
  }

  /* -------------------------------------------- */

  /**
   * Work out the order for a new Action Phase and write it to the combatants.
   *
   * Highest remaining pool goes first. Anyone who has held over sinks below
   * everyone still in play, because they are out until the next round.
   *
   * @returns {Promise<void>}
   */
  async #reorder() {
    const ranked = [...this.combatants].sort((a, b) => {
      if (a.held !== b.held) return a.held ? 1 : -1;
      if (a.pool !== b.pool) return b.pool - a.pool;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    await this.updateEmbeddedDocuments(
      "Combatant",
      ranked.map((c, index) => ({ _id: c.id, "flags.cns5.order": index }))
    );
  }

  /* -------------------------------------------- */

  /** @returns {CnS5Combatant[]} everyone who can still act this round. */
  get available() {
    return this.combatants.filter((c) => c.active);
  }

  /** @returns {CnS5Combatant[]} everyone yet to act in the current phase. */
  get pending() {
    return this.combatants.filter((c) => c.active && !c.acted);
  }

  /* -------------------------------------------- */

  /**
   * Roll a combatant's Action Point pool for the round.
   * @inheritDoc
   */
  async rollInitiative(ids, options = {}) {
    await super.rollInitiative(ids, options);
    await this.#reorder();
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Begin the encounter: everyone rolls, the order is worked out, and the
   * highest pool takes the first turn.
   *
   * @inheritDoc
   */
  async startCombat() {
    await this.rollAll();
    await super.startCombat();
    return this.#openPhase();
  }

  /* -------------------------------------------- */

  /**
   * Ask the active combatant what they are doing, then move on.
   *
   * The prompt comes at the end of the turn rather than the start, because a
   * player does not know what they have spent until they have done it. They
   * move, strike, cast, and then say what it cost.
   *
   * @inheritDoc
   */
  async nextTurn() {
    const combatant = this.combatant;
    if (!combatant) return this.#advance();

    const choice = await CnS5Combat.promptTurn(combatant);
    if (choice === null) return this;

    if (choice.action === "hold") {
      // Only Base Action Points' worth may be carried over; the rest is lost.
      const kept = Math.min(combatant.pool, combatant.bap);
      await combatant.update({
        initiative: kept,
        "flags.cns5.held": true,
        "flags.cns5.acted": true
      });
      ui.notifications.info(
        game.i18n.format("CNS5.Combat.heldOver", { name: combatant.name, ap: kept })
      );
    } else {
      const spent = choice.action === "pass" ? 0 : choice.spent;
      await combatant.update({
        initiative: Math.max(0, combatant.pool - spent),
        "flags.cns5.acted": true
      });
    }

    return this.#advance();
  }

  /* -------------------------------------------- */

  /**
   * Move to the next combatant still to act, or close the phase.
   * @returns {Promise<Combat>}
   */
  async #advance() {
    if (this.pending.length) {
      // The order is fixed for the phase, so the next to act is simply the
      // next one along the list that has not acted and is still in play.
      const index = this.turns.findIndex((c) => c.active && !c.acted);
      return this.update({ turn: index });
    }

    // Everyone has acted. If nobody can act again, the round is over.
    if (!this.available.length) return this.nextRound();

    await this.resetPhase();
    return this.#openPhase();
  }

  /* -------------------------------------------- */

  /** Clear the phase marks and work out the order afresh. */
  async resetPhase() {
    await this.updateEmbeddedDocuments(
      "Combatant",
      this.combatants.map((c) => ({ _id: c.id, "flags.cns5.acted": false }))
    );
    await this.#reorder();
  }

  /**
   * Put the turn on whoever now stands at the top.
   * @returns {Promise<Combat>}
   */
  async #openPhase() {
    const index = this.turns.findIndex((c) => c.active);
    return this.update({ turn: Math.max(0, index) });
  }

  /* -------------------------------------------- */

  /**
   * Begin a new Combat Round.
   *
   * Held Action Points carry over and are added to a fresh d10 and the round
   * bonus. Points that were neither spent nor held are simply gone.
   *
   * @inheritDoc
   */
  async nextRound() {
    const updates = [];
    for (const combatant of this.combatants) {
      const carried = combatant.held ? Math.min(combatant.pool, combatant.bap) : 0;
      const roll = await new Roll(CNS5.initiativeDie).evaluate();
      updates.push({
        _id: combatant.id,
        initiative: Math.max(0, carried + roll.total + combatant.roundBonus),
        "flags.cns5.held": false,
        "flags.cns5.acted": false,
        "flags.cns5.carried": carried
      });
    }
    await this.updateEmbeddedDocuments("Combatant", updates);
    await this.#reorder();

    await super.nextRound();
    return this.#openPhase();
  }

  /* -------------------------------------------- */

  /**
   * Ask what the active combatant did with their turn.
   *
   * @param {CnS5Combatant} combatant
   * @returns {Promise<{action: string, spent: number}|null>} null if dismissed
   */
  static async promptTurn(combatant) {
    const pool = combatant.pool;
    const holdable = Math.min(pool, combatant.bap);

    const content = `
      <div class="cns5-prompt">
        <p>${game.i18n.format("CNS5.Combat.poolRemaining", { name: combatant.name, ap: pool })}</p>
        <label for="cns5-spent">${game.i18n.localize("CNS5.Combat.apSpent")}</label>
        <input id="cns5-spent" type="number" name="spent" value="0" min="0" max="${pool}" autofocus>
        <p class="hint">${game.i18n.format("CNS5.Combat.apSpentHint", { max: CNS5.maxApPerAction })}</p>
        <p class="hint">${game.i18n.format("CNS5.Combat.holdHint", { ap: holdable, bap: combatant.bap })}</p>
      </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.format("CNS5.Combat.turnTitle", { name: combatant.name }) },
      content,
      buttons: [
        {
          action: "act",
          label: game.i18n.localize("CNS5.Combat.act"),
          default: true,
          callback: (event, button) => ({
            action: "act",
            spent: Math.clamp(Number(button.form.elements.spent.value) || 0, 0, pool)
          })
        },
        {
          action: "pass",
          label: game.i18n.localize("CNS5.Combat.pass"),
          callback: () => ({ action: "pass", spent: 0 })
        },
        {
          action: "hold",
          label: game.i18n.localize("CNS5.Combat.hold"),
          callback: () => ({ action: "hold", spent: 0 })
        }
      ],
      rejectClose: false
    });
  }
}
