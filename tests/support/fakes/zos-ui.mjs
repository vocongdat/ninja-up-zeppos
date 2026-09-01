export const registry = { widgets: [], nextId: 1, deletes: 0, doubleDeletes: 0, setPropsAfterDelete: [], createsWhileFrozen: [], frozen: false, frozenLabel: null };
export function resetRegistry() {
  registry.widgets = []; registry.nextId = 1; registry.deletes = 0; registry.doubleDeletes = 0;
  registry.setPropsAfterDelete = []; registry.createsWhileFrozen = []; registry.frozen = false; registry.frozenLabel = null;
}
export function live() { return registry.widgets.filter((w) => w.alive); }
export function liveByType() { const o = {}; for (const w of live()) o[w.type] = (o[w.type] || 0) + 1; return o; }
class Widget {
  constructor(type, props) { this.id = registry.nextId++; this.type = type; this.props = Object.assign({}, props); this.alive = true; this.visible = undefined; this.setPropertyCalls = []; this.zIndex = this.id; }
  setProperty(key, value) {
    if (!this.alive) { registry.setPropsAfterDelete.push({ id: this.id, type: this.type, key, value }); throw new Error("setProperty on deleted widget " + this.id); }
    this.setPropertyCalls.push([key, value]);
    if (key === "VISIBLE") this.visible = value;
    if (key === "TEXT") this.props.text = value;
    if (key === "SOURCE") this.props.source = value;
    if (key === "X") this.props.x = value;
    if (key === "Y") this.props.y = value;
  }
  getProperty(key) {
    if (key === "TEXT") return this.props.text;
    if (key === "SOURCE") return this.props.source;
    if (key === "VISIBLE") return this.visible;
    if (key === "X") return this.props.x;
    if (key === "Y") return this.props.y;
    return undefined;
  }
}
const hmUI = {
  widget: { FILL_RECT: "FILL_RECT", TEXT: "TEXT", BUTTON: "BUTTON", CIRCLE: "CIRCLE", IMG: "IMG", QRCODE: "QRCODE" },
  prop: { VISIBLE: "VISIBLE", TEXT: "TEXT", SOURCE: "SOURCE", X: "X", Y: "Y", MORE: "MORE" },
  align: { LEFT: "LEFT", CENTER_H: "CENTER_H", RIGHT: "RIGHT", CENTER_V: "CENTER_V" },
  text_style: { NONE: "NONE", WRAP: "WRAP", ELLIPSIS: "ELLIPSIS" },
  reset() { resetRegistry(); },
  live() { return live(); },
  createWidget(type, props) { const w = new Widget(type, props); registry.widgets.push(w); if (registry.frozen) registry.createsWhileFrozen.push({ id: w.id, type, where: registry.frozenLabel }); return w; },
  deleteWidget(w) { registry.deletes++; if (!w || !w.alive) { registry.doubleDeletes++; return; } w.alive = false; },
};
export function setStatusBarVisible(v) { hmUI.__statusBar = v; }
export default hmUI;
