/**
 * Type checked pipeline construction and execution.
 *
 * A machine is a pipeline of operations applied in order. This module turns a list of
 * steps, each naming an operation and its bound parameters, into a compiled pipeline
 * whose value types line up from one operation to the next, and it runs that pipeline
 * over an input. A machine's signature is the signature of the composition: the input
 * type of the first operation and the output type of the last.
 *
 * Composition is where the difficulty grammar is enforced structurally. Pipelines are
 * type checked left to right: each operation must accept the type the previous
 * operation produced, so a reducer that yields a single number cannot be followed by
 * a map that expects a list. A mismatch, an empty pipeline, an unknown operation, or a
 * missing parameter is rejected at construction rather than surfacing as a wrong
 * answer at run time. Execution is pure: operations never mutate their input, so the
 * same pipeline on the same input always yields the same result.
 */

import { getOp } from "./ops";
import type { OpDef, OpMeta, Params, Value, ValueType } from "./ops-types";

/** One step of a pipeline: the operation to apply and the parameters bound to it. */
export interface PipelineStep {
  readonly opId: string;
  readonly params: Params;
}

/**
 * A compiled pipeline. The steps are the serializable description, the ops are the
 * resolved definitions parallel to the steps, and the input and output types are the
 * signature of the whole composition.
 */
export interface Pipeline {
  readonly steps: readonly PipelineStep[];
  readonly ops: readonly OpDef[];
  readonly inputType: ValueType;
  readonly outputType: ValueType;
}

const ERROR_EMPTY_PIPELINE = "a pipeline must contain at least one operation";
const ERROR_TYPE_MISMATCH = "pipeline type mismatch: ";
const ERROR_MISSING_PARAM = "missing parameter ";
const PHRASE_EXPECTS = " expects ";
const PHRASE_RECEIVES = " but receives ";
const PHRASE_FOR = " for ";

/**
 * Builds a pipeline step from an operation descriptor and its parameters.
 * @param op The operation descriptor.
 * @param params The parameters to bind, empty by default for operations that take none.
 * @returns The pipeline step.
 */
export function step(op: OpMeta, params: Params = {}): PipelineStep {
  return { opId: op.id, params };
}

/**
 * Verifies that a step supplies every parameter the operation declares.
 * @param op The resolved operation.
 * @param params The parameters bound to the step.
 */
function requireParams(op: OpDef, params: Params): void {
  for (const spec of op.params) {
    if (params[spec.name] === undefined) {
      throw new Error(ERROR_MISSING_PARAM + spec.name + PHRASE_FOR + op.id);
    }
  }
}

/**
 * Resolves and type checks a list of steps into a compiled pipeline. Looks up 
 * each operation, confirms its declared parameters are present, and walks the 
 * chain so that each operation accepts the type the previous one produced. 
 * Rejects an empty pipeline, a missing parameter, an unknown operation, or a 
 * type mismatch by throwing a named error.
 * @param steps The ordered steps describing the pipeline.
 * @returns The compiled pipeline with its resolved operations and signature.
 */
export function compose(steps: readonly PipelineStep[]): Pipeline {
  if (steps.length === 0) throw new Error(ERROR_EMPTY_PIPELINE);

  const ops = steps.map((pipelineStep) => getOp(pipelineStep.opId));
  ops.forEach((op, index) => requireParams(op, steps[index].params));

  const inputType = ops[0].inputType;
  let current: ValueType = inputType;
  for (const op of ops) {
    if (op.inputType !== current) {
      throw new Error(ERROR_TYPE_MISMATCH + op.id + PHRASE_EXPECTS + op.inputType + PHRASE_RECEIVES + current);
    }
    current = op.outputType;
  }

  return { steps, ops, inputType, outputType: current };
}

/**
 * Runs a compiled pipeline over an input, applying each operation in order.
 * The input is never mutated.
 * @param pipeline The compiled pipeline.
 * @param input The value to feed in, matching the pipeline input type.
 * @returns The value the pipeline produces, matching the pipeline output type.
 */
export function execute(pipeline: Pipeline, input: Value): Value {
  let value = input;
  pipeline.ops.forEach((op, index) => {
    value = op.apply(value, pipeline.steps[index].params);
  });
  return value;
}

/**
 * Composes and runs a list of steps in one call.
 * @param steps The ordered steps describing the pipeline.
 * @param input The value to feed in.
 * @returns The value the pipeline produces.
 */
export function run(steps: readonly PipelineStep[], input: Value): Value {
  return execute(compose(steps), input);
}
