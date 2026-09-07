import { CnS5PhysicalItem } from "./item-physical.mjs";

/**
 * Ordinary gear: everything carried that is not a weapon or armour.
 *
 * It adds nothing to the physical item base. The separate type exists so the
 * Personal Chattel tab can list gear apart from arms, and so a future
 * equipment compendium has somewhere to land.
 */
export class CnS5Equipment extends CnS5PhysicalItem {}
