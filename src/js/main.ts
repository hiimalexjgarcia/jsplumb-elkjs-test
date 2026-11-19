import './ui/graph-node-element'
import 'bootstrap/dist/css/bootstrap.css'
import '../scss/styles.scss'
import { GraphEditor } from './app/graph-editor'
import { sampleGraph } from './fixtures/sample-graph'

const root = document.querySelector<HTMLElement>('#graph-editor')
if (!root) {
  throw new Error('Graph editor root element not found')
}

new GraphEditor(root, sampleGraph).mount()
