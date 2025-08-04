/**
 * List of global state references that are used within layout or filter properties.
 * Collects the names of global state properties that affect layout or filter expressions.
 * This is used to determine if layer source needs to be reloaded when global state property changes.
 */
export class LayoutAffectingGlobalRefs extends Set<string> {}

/**
 * List of global state references that are used within paint properties.
 * Maps the name of the global state property to an array of property name / value pairs.
 * This is used to determine if layer needs to be repainted when global state property changes.
 */
export class PaintAffectingGlobalStateRefs extends Map<string, Array<{name: string; value: any}>> {}
