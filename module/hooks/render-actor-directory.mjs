import MinaxamsToolbox from "../applications/minaxams-toolbox.mjs";

/**
 *
 * @param {foundry.applications.sidebar.tabs.ActorDirectory} directory - The Application instance being rendered
 * @param {HTMLElement} element - The inner HTML of the document that will be displayed and may be modified
 * @param {foundry.applications.types.ApplicationRenderContext} _context - The application rendering context data
 * @param {foundry.applications.types.ApplicationRenderOptions} _options - The application rendering options
 */
export default function onRenderActorDirectory(
  directory,
  element,
  _context,
  _options
) {

  if(!game.user.isGM) return;

  Object.defineProperty(directory, "minaxamasToolbox", {
    get() {
      if (!this._minaxamasToolbox) {
        /**@type {typeof MinaxamsToolbox} */
        const AppClass = MINAXAMS.applications.MinaxamsToolbox;
        this._minaxamasToolbox = new AppClass();
      }
      return this._minaxamasToolbox;
    },
    configurable: true,
  });

  const div = element.querySelector(".directory-header .header-actions");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "minaxamas-gruop-btn icon fa-solid fa-people-group";
  btn.dataset.tooltip = "Open Minaxamas Toolbox";

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    /**@type {MinaxamsToolbox} */
    const toolbox = directory.minaxamasToolbox;
    toolbox.render({ force: true });
  });
  div.append(btn);
}
