/**
 * The bounded pipeline universe and its behavior classes.
 *
 * The validators need to know, for a candidate machine, whether a simpler pipeline
 * behaves identically to it and how many distinct rules a player could still believe
 * after seeing the examples. Answering those questions by re-running every possible
 * pipeline on demand would be slow, so this module precomputes the answer space once
 * per generator version. It enumerates every type valid numeric pipeline up to three
 * operations with every parameter combination, runs each over the fixed probe battery,
 * and groups pipelines that produce identical probe outputs into a behavior class. Two
 * pipelines in the same class compute the same function, so collapse detection and
 * ambiguity scoring reduce to looking a candidate up by its fingerprint and reasoning
 * about classes rather than about individual pipelines.
 *
 * The numeric universe is the primary one: a pipeline begins with a list of numbers,
 * applies zero or more list to list operations, and may end in a single reducer to a
 * number. A parallel word universe begins with a list of words, applies a word
 * operation, and may flow into the numeric operations once a word operation has
 * produced numbers, so word machines receive the same collapse and ambiguity reasoning
 * as numeric machines. The two universes are built and cached independently.
 *
 * Each class keeps its simplest member as the representative, where simpler means
 * fewer operations and then a lower top rung. Collapse asks whether a class has a
 * member simpler than the candidate, and ambiguity reasons about one representative
 * per class rather than about every parameter and ordering variant.
 */

import { compose, execute, type PipelineStep } from "./compose";
import { fingerprint, fingerprintOver, WORD_PROBE_BATTERY } from "./fingerprint";
import { getOp, REGISTRY } from "./ops";
import {
  TYPE_NUM,
  TYPE_NUM_LIST,
  TYPE_WORD_LIST,
  type ParamSpec,
  type Params,
  type ValueType,
} from "./ops-types";

/** A bound op instance: an operation identifier with one fixed parameter binding. */
interface OpInstance {
  readonly opId: string;
  readonly params: Params;
}

/** A pipeline recipe is the ordered pool of instances allowed at each position. */
type PipelineRecipe = readonly (readonly OpInstance[])[];

/** The complexity of a pipeline, ordered by operation count and then by top rung. */
export interface Complexity {
  readonly length: number;
  readonly maxRung: number;
}

/**
 * A class of pipelines that compute the same function, identified by the shared
 * fingerprint and represented by the simplest pipeline in the class.
 */
export interface BehaviorClass {
  readonly representative: readonly PipelineStep[];
  readonly length: number;
  readonly maxRung: number;
}

/**
 * Enumerates every parameter combination an operation can take within its declared
 * ranges.
 * @param specs The parameter specifications of an operation.
 * @returns Every parameter binding, with a single empty binding when there are none.
 */
function paramCombinations(specs: readonly ParamSpec[]): Params[] {
  let combinations: Record<string, number>[] = [{}];
  for (const spec of specs) {
    const extended: Record<string, number>[] = [];
    for (const combination of combinations) {
      for (let value = spec.min; value <= spec.max; value++) {
        extended.push({ ...combination, [spec.name]: value });
      }
    }
    combinations = extended;
  }
  return combinations;
}

/**
 * Expands the operations of one signature into their bound instances.
 * @param inputType The required input type.
 * @param outputType The required output type.
 * @returns Every bound instance of every matching operation.
 */
function instancesOfSignature(inputType: string, outputType: string): OpInstance[] {
  return REGISTRY.filter((op) => op.inputType === inputType && op.outputType === outputType).flatMap((op) =>
    paramCombinations(op.params).map((params) => ({ opId: op.id, params })),
  );
}

/** The list to list operations, the chainable middle of a numeric pipeline. */
const LIST_INSTANCES: readonly OpInstance[] = instancesOfSignature(TYPE_NUM_LIST, TYPE_NUM_LIST);

/** The reducer operations, which may terminate a numeric pipeline. */
const REDUCER_INSTANCES: readonly OpInstance[] = instancesOfSignature(TYPE_NUM_LIST, TYPE_NUM);

/** Every operation instance that can appear as the lone step of a pipeline. */
const SINGLE_STEP_INSTANCES: readonly OpInstance[] = [...LIST_INSTANCES, ...REDUCER_INSTANCES];

/** The largest number of operations a pipeline in this universe may have. */
const MAX_PIPELINE_LENGTH = 3;

/**
 * Converts a bound instance into a pipeline step.
 * @param instance The bound instance.
 * @returns The pipeline step.
 */
function toStep(instance: OpInstance): PipelineStep {
  return { opId: instance.opId, params: instance.params };
}

/** Builds the recipe for every pipeline length in the numeric universe. */
function recipeOfLength(length: number): PipelineRecipe {
  if (length === 1) {
    return [SINGLE_STEP_INSTANCES];
  }

  const prefix = Array.from({ length: length - 1 }, () => LIST_INSTANCES);
  return [...prefix, SINGLE_STEP_INSTANCES];
}

/**
 * Returns the highest rung among the operations of a pipeline.
 * @param steps The pipeline steps.
 * @returns The top rung.
 */
export function maxRungOf(steps: readonly PipelineStep[]): number {
  return Math.max(...steps.map((pipelineStep) => getOp(pipelineStep.opId).rung));
}

/**
 * Returns the complexity of a pipeline.
 * @param steps The pipeline steps.
 * @returns The operation count and top rung.
 */
export function complexityOf(steps: readonly PipelineStep[]): Complexity {
  return { length: steps.length, maxRung: maxRungOf(steps) };
}

/**
 * Reports whether one complexity is strictly simpler than another, comparing
 * operation count first and then top rung.
 * @param a The candidate simpler complexity.
 * @param b The complexity to compare against.
 * @returns True when a is strictly simpler than b.
 */
export function isStrictlySimpler(a: Complexity, b: Complexity): boolean {
  if (a.length !== b.length) return a.length < b.length;
  return a.maxRung < b.maxRung;
}

/**
 * Computes the behavior fingerprint of a pipeline by running it over the probe
 * battery.
 * @param steps The pipeline steps.
 * @returns The fingerprint of the pipeline behavior.
 */
export function fingerprintOfSteps(steps: readonly PipelineStep[]): string {
  const pipeline = compose(steps);
  return fingerprint((probe) => execute(pipeline, [...probe]));
}

let cachedClasses: Map<string, BehaviorClass> | null = null;

/**
 * Records a pipeline under its fingerprint in the class map, keeping the simplest
 * member of each class as its representative.
 * @param classes The class map being built.
 * @param steps The pipeline to record.
 * @param key The behavior fingerprint the pipeline is recorded under.
 */
function recordClass(
  classes: Map<string, BehaviorClass>,
  steps: readonly PipelineStep[],
  key: string,
): void {
  const length = steps.length;
  const maxRung = maxRungOf(steps);
  const existing = classes.get(key);
  if (!existing || isStrictlySimpler({ length, maxRung }, existing)) {
    classes.set(key, { representative: steps, length, maxRung });
  }
}

/**
 * Records a numeric pipeline in the class map under its numeric fingerprint.
 * @param classes The class map being built.
 * @param steps The pipeline to record.
 */
function recordPipeline(classes: Map<string, BehaviorClass>, steps: readonly PipelineStep[]): void {
  recordClass(classes, steps, fingerprintOfSteps(steps));
}

/**
 * Records every pipeline described by one recipe of allowed instance pools.
 * @param classes The class map being built.
 * @param recipe The ordered pools of instances for each pipeline position.
 */
function recordRecipe(classes: Map<string, BehaviorClass>, recipe: PipelineRecipe): void {
  const build = (index: number, steps: readonly PipelineStep[]): void => {
    if (index >= recipe.length) {
      recordPipeline(classes, steps);
      return;
    }

    for (const instance of recipe[index]) {
      build(index + 1, [...steps, toStep(instance)]);
    }
  }

  build(0, []);
}

/**
 * Builds the behavior class map by enumerating every numeric pipeline up to the
 * maximum length and grouping them by fingerprint.
 * @returns The class map keyed by fingerprint.
 */
function buildClasses(): Map<string, BehaviorClass> {
  const classes = new Map<string, BehaviorClass>();

  for (let length = 1; length <= MAX_PIPELINE_LENGTH; length++) {
    recordRecipe(classes, recipeOfLength(length));
  }

  return classes;
}

/**
 * Returns the behavior class map, building it once and caching it for reuse.
 * @returns The class map keyed by fingerprint.
 */
export function behaviorClasses(): Map<string, BehaviorClass> {
  cachedClasses ??= buildClasses();
  return cachedClasses;
}

let cachedWordInstances: Map<ValueType, readonly OpInstance[]> | null = null;

/**
 * Groups every bound operation instance by the value type it consumes, so the word
 * enumeration can extend a pipeline by the operations that accept the current type.
 * @returns A map from input value type to the bound instances that consume it.
 */
function instancesByInputType(): Map<ValueType, readonly OpInstance[]> {
  const grouped = new Map<ValueType, OpInstance[]>();
  for (const op of REGISTRY) {
    const bucket = grouped.get(op.inputType) ?? [];
    for (const params of paramCombinations(op.params)) {
      bucket.push({ opId: op.id, params });
    }
    grouped.set(op.inputType, bucket);
  }
  return grouped;
}

/**
 * Computes the behavior fingerprint of a word pipeline by running it over the word
 * probe battery.
 * @param steps The pipeline steps, beginning with a word operation.
 * @returns The fingerprint of the pipeline behavior over word inputs.
 */
export function fingerprintWordSteps(steps: readonly PipelineStep[]): string {
  const pipeline = compose(steps);
  return fingerprintOver(WORD_PROBE_BATTERY, (probe) => execute(pipeline, [...probe]));
}

/**
 * Records a word pipeline in the class map under its word fingerprint.
 * @param classes The class map being built.
 * @param steps The pipeline to record.
 */
function recordWordPipeline(classes: Map<string, BehaviorClass>, steps: readonly PipelineStep[]): void {
  recordClass(classes, steps, fingerprintWordSteps(steps));
}

let cachedWordClasses: Map<string, BehaviorClass> | null = null;

/**
 * Builds the word behavior class map by enumerating every pipeline that begins with a
 * word operation, follows the value type flow through later operations up to the
 * maximum length, and groups them by their behavior over the word probe battery.
 * @returns The word class map keyed by fingerprint.
 */
function buildWordClasses(): Map<string, BehaviorClass> {
  const classes = new Map<string, BehaviorClass>();
  cachedWordInstances ??= instancesByInputType();
  const instances = cachedWordInstances;

  const extend = (currentType: ValueType, steps: readonly PipelineStep[]): void => {
    if (steps.length >= 1) recordWordPipeline(classes, steps);
    if (steps.length >= MAX_PIPELINE_LENGTH) return;
    for (const instance of instances.get(currentType) ?? []) {
      extend(getOp(instance.opId).outputType, [...steps, toStep(instance)]);
    }
  };

  extend(TYPE_WORD_LIST, []);
  return classes;
}

/**
 * Returns the word behavior class map, building it once and caching it for reuse.
 * @returns The word class map keyed by fingerprint.
 */
export function wordBehaviorClasses(): Map<string, BehaviorClass> {
  cachedWordClasses ??= buildWordClasses();
  return cachedWordClasses;
}
