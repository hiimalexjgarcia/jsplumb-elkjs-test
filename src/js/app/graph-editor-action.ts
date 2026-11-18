import type { GraphPosition } from '../graph/graph'

export type GraphEditorAction =
  | { type: 'edit-node'; nodeId: string }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'delete-edge'; edgeId: string }
  | { type: 'add-node'; position: GraphPosition }
