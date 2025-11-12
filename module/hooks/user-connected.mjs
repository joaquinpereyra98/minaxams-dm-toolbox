/**
 * 
 * @param {foundry.documents.User} user - The User who has connected or disconnected
 * @param {Boolean} _connected Is the user now connected (true) or disconnected (false)
 */
export default function onUserConnected(_user, _connected) {
  ui.actors.minaxamasToolbox.render();
}